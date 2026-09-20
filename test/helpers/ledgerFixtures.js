'use strict';
/**
 * Fixture text for the ledger's two homes (story ledger-row-identity #1, ADR
 * ledger-row-identity/0001): the frozen numbered table in OPEN.md, and the row files
 * under ledger/. Shared by test/harness-lint.test.js, test/session-start.test.js and
 * test/ledger-row-ids.test.js, so "a row file" and "a ledger shaped like the real one"
 * are each written down once.
 */

/**
 * A row file in the shape ADR 0001 § "A row file" gives: a title line, the fielded
 * header, a body, a pointer. Pass `null` for a field to leave its line out.
 */
function rowFile(id, over = {}) {
  const f = {
    title: 'A fixture finding',
    id,
    type: 'meta',
    opened: '2026-09-01 (fixture session)',
    status: 'OPEN',
    done: '—',
    ...over,
  };
  const header = [['Id', f.id], ['Type', f.type], ['Opened', f.opened], ['Status', f.status], ['Done', f.done]]
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `**${k}:** ${v}`)
    .join('\n');
  return `# ${f.title}\n\n${header}\n\nWhat was seen, the evidence, the fix shape.\n\n**Pointer:** fixture\n`;
}

/** One line of the numbered table. */
function tableRow(id, item = 'fixture item', { type = 'cleanup', status = 'DONE' } = {}) {
  return `| ${id} | ${type} | ${item} | 2026-06-01 | ${status} | | |`;
}

/**
 * An OPEN.md shaped like the real one: a small table of its own in the preamble (with
 * its own `|---|` line), then the Items table. `rows` are lines: table rows, and between
 * them the blank lines and `> **Numbering note …**` blockquotes the real table carried
 * until 2026-09-20 (they now sit under it; L15 must keep tolerating a stray one).
 * `frozenAt` adds the freeze marker after the last row, under one line of prose.
 */
function ledgerDoc(rows, { frozenAt } = {}) {
  const head =
    '# Open Items Ledger\n\n' +
    '| Kind of open work | Lives in |\n|---|---|\n' +
    '| Triaged-but-unbuilt work | `engineering-team/stories/_intake.md` |\n' +
    '| **Small / cross-cutting items** | **this file** |\n\n' +
    '## How to use this ledger\n- Fixture.\n\n## Items\n\n' +
    '| # | Type | Item | Opened | Status | Done | Pointer |\n|---|---|---|---|---|---|---|\n';
  const marker = frozenAt === undefined
    ? ''
    : `\nThe table is closed; new rows are files in \`ledger/\`.\n<!-- ledger-table-frozen: highest-number=${frozenAt} -->\n`;
  return `${head}${rows.join('\n')}\n${marker}`;
}

/**
 * What the real table looks like — or looked like, for the note — in nine lines: ids out
 * of order (as 7, 8, 6 are), a gap (no 6 or 8 here; 257 there), a note between two chunks
 * of rows (the real ones moved under the table on 2026-09-20), a row that quotes
 * another row's id cell and a regex with a pipe, and an escaped pipe. Highest id: 9.
 */
const REAL_SHAPE_ROWS = [
  tableRow(1),
  tableRow(2),
  tableRow(4, 'out of order, as rows 7, 8 and 6 are in the real table'),
  tableRow(3),
  '',
  '> **Numbering note (fixture):** rows **5–7** were renumbered at a merge; "row 5" means the one below.',
  '',
  tableRow(5, 'quotes another row, `| 7 | meta | something |`, and a regex `a|b`', { type: 'meta', status: 'OPEN' }),
  tableRow(7, 'plain'),
  tableRow(9, 'an escaped \\| pipe'),
];

module.exports = { rowFile, tableRow, ledgerDoc, REAL_SHAPE_ROWS };
