// Fetch PR metadata, changed files, patches and (optionally) head file contents
// using the GitHub CLI (`gh`). Auth comes from `gh auth login` or GH_TOKEN.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Accepts:
 *   https://github.com/owner/repo/pull/123[/files...]
 *   owner/repo#123
 *   owner/repo/pull/123
 */
export function parsePrRef(input) {
  if (!input) throw new Error('Missing PR reference');
  const s = String(input).trim();
  let m = s.match(/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i);
  if (m) return { owner: m[1], repo: m[2], number: Number(m[3]) };
  m = s.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (m) return { owner: m[1], repo: m[2], number: Number(m[3]) };
  m = s.match(/^([\w.-]+)\/([\w.-]+)\/pull\/(\d+)$/);
  if (m) return { owner: m[1], repo: m[2], number: Number(m[3]) };
  throw new Error(`Unrecognized PR reference: "${s}". Use a PR URL or owner/repo#123.`);
}

async function gh(args, { raw = false } = {}) {
  try {
    const { stdout } = await run('gh', args, { maxBuffer: 256 * 1024 * 1024 });
    return raw ? stdout : JSON.parse(stdout);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('The GitHub CLI (`gh`) is not installed. See https://cli.github.com/');
    }
    const msg = (err.stderr || err.message || '').trim();
    throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${msg}`);
  }
}

const MAX_CONTENT_BYTES = 400_000;

export async function fetchPr(ref, { contents = true, log = () => {} } = {}) {
  const { owner, repo, number } = typeof ref === 'string' ? parsePrRef(ref) : ref;
  const base = `repos/${owner}/${repo}`;

  log(`Fetching ${owner}/${repo}#${number} metadata`);
  const pr = await gh(['api', `${base}/pulls/${number}`]);

  log('Fetching changed files');
  // --paginate with --slurp yields an array of pages
  const pages = await gh(['api', '--paginate', '--slurp', `${base}/pulls/${number}/files?per_page=100`]);
  const rawFiles = pages.flat();

  const files = rawFiles.map((f) => ({
    path: f.filename,
    previousPath: f.previous_filename || null,
    status: f.status, // added | removed | modified | renamed | copied | changed | unchanged
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null, // null for binary / too-large diffs
    content: null,
  }));

  if (contents) {
    log(`Fetching head contents for ${files.length} files (for expandable context)`);
    const headSha = pr.head.sha;
    const headRepo = pr.head.repo?.full_name || `${owner}/${repo}`;
    await mapLimit(files, 6, async (f) => {
      if (f.status === 'removed' || !f.patch) return;
      try {
        const meta = await gh(['api', `repos/${headRepo}/contents/${encodePath(f.path)}?ref=${headSha}`]);
        if (meta.type !== 'file' || meta.size > MAX_CONTENT_BYTES || meta.encoding !== 'base64') return;
        f.content = Buffer.from(meta.content, 'base64').toString('utf8');
      } catch {
        // Context expansion is a nice-to-have; ignore failures.
      }
    });
  }

  return {
    owner,
    repo,
    number,
    url: pr.html_url,
    title: pr.title,
    body: pr.body || '',
    author: { login: pr.user?.login, avatarUrl: pr.user?.avatar_url },
    state: pr.merged_at ? 'merged' : pr.state,
    createdAt: pr.created_at,
    mergedAt: pr.merged_at,
    baseRef: pr.base?.ref,
    headRef: pr.head?.ref,
    headSha: pr.head?.sha,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    files,
  };
}

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}
