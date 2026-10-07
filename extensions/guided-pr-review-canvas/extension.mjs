import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { CanvasError, createCanvas, joinSession } from "@github/copilot-sdk/extension";

const bundledRenderer = new URL("../../scripts/render.mjs", import.meta.url);
const copilotHome = process.env.COPILOT_HOME || join(homedir(), ".copilot");
const installedRenderer = pathToFileURL(join(copilotHome, "skills", "guided-pr-review", "scripts", "render.mjs"));
const rendererUrl = existsSync(fileURLToPath(bundledRenderer)) ? bundledRenderer : installedRenderer;
const { renderHtml } = await import(rendererUrl.href);

const exec = promisify(execFile);
const servers = new Map();

async function loadReview(input) {
  const prDataPath = input?.prDataPath;
  const analysisPath = input?.analysisPath;
  if (!prDataPath || !analysisPath) {
    throw new CanvasError("review_input_missing", "prDataPath and analysisPath are required");
  }

  let pr;
  let analysis;
  try {
    [pr, analysis] = await Promise.all([
      readFile(prDataPath, "utf8").then(JSON.parse),
      readFile(analysisPath, "utf8").then(JSON.parse),
    ]);
  } catch (error) {
    throw new CanvasError("review_read_failed", `Could not read review data: ${error.message}`);
  }

  if (!pr?.owner || !pr?.repo || !pr?.number || !Array.isArray(pr.files)) {
    throw new CanvasError("review_data_invalid", "The PR data file is invalid");
  }
  if (!Array.isArray(analysis?.chapters) || !Array.isArray(analysis?.orderedFiles)) {
    throw new CanvasError("review_analysis_invalid", "The analysis file is invalid");
  }
  return { pr, analysis };
}

function getEntry(instanceId) {
  const entry = servers.get(instanceId);
  if (!entry) throw new CanvasError("review_not_open", "Open the guided review canvas first");
  return entry;
}

async function runGh(args) {
  try {
    const { stdout } = await exec("gh", args, { maxBuffer: 16 * 1024 * 1024 });
    return stdout ? JSON.parse(stdout) : {};
  } catch (error) {
    const detail = String(error.stderr || error.message || "").trim();
    throw new CanvasError("github_request_failed", detail || "GitHub request failed");
  }
}

function requireLine(review, input) {
  const path = String(input?.path || "");
  const side = input?.side === "LEFT" ? "LEFT" : input?.side === "RIGHT" ? "RIGHT" : "";
  const line = Number(input?.line);
  if (!review.pr.files.some((file) => file.path === path)) {
    throw new CanvasError("line_path_invalid", "The selected path is not in this pull request");
  }
  if (!side || !Number.isInteger(line) || line < 1) {
    throw new CanvasError("line_location_invalid", "A valid diff side and line number are required");
  }
  return { path, side, line };
}

async function askAboutLine(entry, input) {
  const location = requireLine(entry.review, input);
  const question = String(input?.question || "What should I understand about this line?").trim();
  const code = String(input?.code || "").slice(0, 4000);
  const context = String(input?.context || "").slice(0, 12000);
  const prompt = [
    "This is a focused line-level question from the already-open Guided PR Review canvas.",
    "Do not invoke guided-pr-review and do not open another canvas. Answer only this question using the supplied PR diff context.",
    "",
    `Pull request: ${entry.review.pr.owner}/${entry.review.pr.repo}#${entry.review.pr.number} — ${entry.review.pr.title}`,
    `File: ${location.path}`,
    `Line: ${location.side} ${location.line}`,
    `Code: ${code}`,
    context ? `Nearby diff:\n${context}` : "",
    "",
    `Question: ${question}`,
  ].filter(Boolean).join("\n");

  const response = await session.sendAndWait({ prompt }, 120000);
  return {
    answer: response?.data?.content || "Copilot completed the request without a text response.",
  };
}

async function addLineComment(entry, input) {
  const location = requireLine(entry.review, input);
  const body = String(input?.body || "").trim();
  if (!body) throw new CanvasError("comment_empty", "Comment text is required");
  if (!entry.review.pr.headSha) {
    throw new CanvasError("head_sha_missing", "The PR data does not include a head commit SHA");
  }

  const comment = await runGh([
    "api",
    "--method", "POST",
    `repos/${entry.review.pr.owner}/${entry.review.pr.repo}/pulls/${entry.review.pr.number}/comments`,
    "-f", `body=${body}`,
    "-f", `commit_id=${entry.review.pr.headSha}`,
    "-f", `path=${location.path}`,
    "-F", `line=${location.line}`,
    "-f", `side=${location.side}`,
  ]);
  return { url: comment.html_url, id: comment.id };
}

async function addPrComment(entry, input) {
  const body = String(input?.body || "").trim();
  if (!body) throw new CanvasError("comment_empty", "Comment text is required");
  const comment = await runGh([
    "api",
    "--method", "POST",
    `repos/${entry.review.pr.owner}/${entry.review.pr.repo}/issues/${entry.review.pr.number}/comments`,
    "-f", `body=${body}`,
  ]);
  return { url: comment.html_url, id: comment.id };
}

async function readJson(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 64 * 1024) throw new CanvasError("request_too_large", "Request body is too large");
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new CanvasError("request_invalid", "Request body must be valid JSON");
  }
}

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

async function startServer(instanceId, review) {
  let origin = "";
  const entry = { server: null, url: "", review };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", origin || "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/") {
        const html = renderHtml(entry.review.pr, entry.review.analysis, { interactive: true });
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; script-src 'unsafe-inline'; connect-src 'self'; img-src https: data:; font-src https://fonts.gstatic.com; form-action 'none'",
          "Cache-Control": "no-store",
        });
        res.end(html);
        return;
      }
      if (req.method !== "POST") {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      if (req.headers.origin && req.headers.origin !== origin) {
        sendJson(res, 403, { error: "Origin rejected" });
        return;
      }

      const input = await readJson(req);
      const active = getEntry(instanceId);
      let result;
      if (url.pathname === "/ask") result = await askAboutLine(active, input);
      else if (url.pathname === "/comment/line") result = await addLineComment(active, input);
      else if (url.pathname === "/comment/pr") result = await addPrComment(active, input);
      else {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      sendJson(res, 200, result);
    } catch (error) {
      if (!res.headersSent) {
        sendJson(res, 400, { error: error.message || "Request failed", code: error.code || "request_failed" });
      } else {
        res.end();
      }
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  origin = `http://127.0.0.1:${port}`;
  entry.server = server;
  entry.url = `${origin}/`;
  return entry;
}

let session;
session = await joinSession({
  canvases: [
    createCanvas({
      id: "guided-pr-review",
      displayName: "Guided PR Review",
      description: "Interactive guided pull request walkthrough with line-level Copilot questions and GitHub comments.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          prDataPath: { type: "string", minLength: 1 },
          analysisPath: { type: "string", minLength: 1 },
        },
        required: ["prDataPath", "analysisPath"],
      },
      actions: [
        {
          name: "ask_about_line",
          description: "Ask Copilot a focused question about a line in the open pull request diff.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              path: { type: "string" },
              side: { type: "string", enum: ["LEFT", "RIGHT"] },
              line: { type: "integer", minimum: 1 },
              code: { type: "string" },
              context: { type: "string" },
              question: { type: "string" },
            },
            required: ["path", "side", "line", "question"],
          },
          handler: (ctx) => {
            const entry = getEntry(ctx.instanceId);
            const location = requireLine(entry.review, ctx.input);
            return {
              pr: `${entry.review.pr.owner}/${entry.review.pr.repo}#${entry.review.pr.number}`,
              ...location,
              code: String(ctx.input?.code || ""),
              context: String(ctx.input?.context || ""),
              question: String(ctx.input?.question || ""),
              instruction: "Answer the focused question using this diff-line context.",
            };
          },
        },
        {
          name: "add_line_comment",
          description: "Post an inline GitHub pull request review comment on a selected diff line.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              path: { type: "string" },
              side: { type: "string", enum: ["LEFT", "RIGHT"] },
              line: { type: "integer", minimum: 1 },
              body: { type: "string", minLength: 1 },
            },
            required: ["path", "side", "line", "body"],
          },
          handler: async (ctx) => addLineComment(getEntry(ctx.instanceId), ctx.input),
        },
        {
          name: "add_pr_comment",
          description: "Post a general comment on the open GitHub pull request.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: { body: { type: "string", minLength: 1 } },
            required: ["body"],
          },
          handler: async (ctx) => addPrComment(getEntry(ctx.instanceId), ctx.input),
        },
      ],
      open: async (ctx) => {
        const review = await loadReview(ctx.input);
        const existing = servers.get(ctx.instanceId);
        if (existing) {
          existing.review = review;
          return { title: `${review.pr.owner}/${review.pr.repo}#${review.pr.number}`, url: existing.url };
        }
        const entry = await startServer(ctx.instanceId, review);
        servers.set(ctx.instanceId, entry);
        return {
          title: `${review.pr.owner}/${review.pr.repo}#${review.pr.number}`,
          status: `${review.analysis.chapters.length} chapters · ${review.pr.files.length} files`,
          url: entry.url,
        };
      },
      onClose: async (ctx) => {
        const entry = servers.get(ctx.instanceId);
        if (!entry) return;
        servers.delete(ctx.instanceId);
        await new Promise((resolve) => entry.server.close(resolve));
      },
    }),
  ],
});
