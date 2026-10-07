// Parse unified-diff patches (as returned by the GitHub API) into renderable
// segments: hunks of rows plus "N unmodified lines" gaps between them. When the
// head file content is available, gaps carry their real lines so they can expand.

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const MAX_GAP_EMBED = 1500;

export function parsePatch(patch) {
  if (!patch) return [];
  const hunks = [];
  let h = null;
  let oldNo = 0;
  let newNo = 0;
  for (const line of patch.split('\n')) {
    const m = line.match(HUNK_RE);
    if (m) {
      h = {
        oldStart: +m[1],
        oldLines: m[2] === undefined ? 1 : +m[2],
        newStart: +m[3],
        newLines: m[4] === undefined ? 1 : +m[4],
        section: m[5] || '',
        rows: [],
      };
      hunks.push(h);
      oldNo = h.oldStart;
      newNo = h.newStart;
      continue;
    }
    if (!h || line.startsWith('\\')) continue; // "\ No newline at end of file"
    const sign = line[0];
    const text = line.slice(1);
    if (sign === '+') h.rows.push({ type: 'add', old: null, new: newNo++, text });
    else if (sign === '-') h.rows.push({ type: 'del', old: oldNo++, new: null, text });
    else h.rows.push({ type: 'ctx', old: oldNo++, new: newNo++, text });
  }
  return hunks;
}

/**
 * Returns [{kind:'gap', count, rows|null} | {kind:'hunk', rows}] in file order.
 * Gap rows (when known) are context rows with both line numbers.
 */
export function buildSegments(file) {
  const hunks = parsePatch(file.patch);
  if (!hunks.length) return [];
  const lines = file.content != null ? file.content.replace(/\n$/, '').split('\n') : null;
  const segments = [];
  let prevNewEnd = 0; // last new-side line covered
  let prevOldEnd = 0;

  const gap = (newFrom, newTo, oldFrom) => {
    const count = newTo - newFrom + 1;
    if (count <= 0) return;
    let rows = null;
    if (lines && count <= MAX_GAP_EMBED && newTo <= lines.length) {
      rows = [];
      for (let i = 0; i < count; i++) rows.push({ type: 'ctx', old: oldFrom + i, new: newFrom + i, text: lines[newFrom - 1 + i] });
    }
    segments.push({ kind: 'gap', count, rows });
  };

  for (const h of hunks) {
    gap(prevNewEnd + 1, h.newStart - 1, prevOldEnd + 1);
    segments.push({ kind: 'hunk', section: h.section, rows: h.rows });
    prevNewEnd = h.newLines ? h.newStart + h.newLines - 1 : h.newStart;
    prevOldEnd = h.oldLines ? h.oldStart + h.oldLines - 1 : h.oldStart;
  }
  if (lines && file.status !== 'removed') gap(prevNewEnd + 1, lines.length, prevOldEnd + 1);
  return segments;
}

export function countRows(segments) {
  return segments.reduce((n, s) => n + (s.kind === 'hunk' ? s.rows.length : 0), 0);
}
