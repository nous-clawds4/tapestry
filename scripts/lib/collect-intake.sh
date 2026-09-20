# collect-intake.sh — the ONE reader of engineering-team/stories/_intake.md
# (story rollup-scanner-fidelity #1, ADR rollup-scanner-fidelity/0001). Sourced
# (not executed) by:
#   scripts/whats-open.sh       — the intake section + the nesting warning
#   scripts/lib/collect-meta.sh — un-marked "Meta:" entries join the escalation state
# Both used to carry their own copy of the marker regex; one copy was fixed on
# 2026-09-13 and the other was not, and they then disagreed about 6 of 33 entries.
#
# THE MARKER GRAMMAR LIVES HERE ONLY. An entry is a `## 20YY-…` heading and every
# line up to the next one. Its state comes from the first line, AT LINE START,
# that reads:
#
#   **PICKED UP…  **RESOLVED…  **DONE…  **REASSIGNED…      → retired
#   …any of those with a QUALIFIER parenthetical in its     → partial
#     first 60 characters: (partial) (in progress)
#     (Part A) (Tier 1–2)
#   **NOT PICKED UP…                                        → not a marker at all
#     (it does not start `**PICKED`), so the entry is open
#   no such line                                            → open
#
# The qualifier vocabulary is CLOSED and the window is 60 characters, so prose
# further along the line ("…is partially delivered by…", _intake.md:1847) does not
# reopen a finished entry. `partial` exists because five entries say in their own
# marker that work remains — one of them "**Part B still OPEN**" — and every reader
# retired them anyway (OPEN.md row 208).
#
# intake_entries [<path>] prints one TAB-separated line per entry (cwd-relative —
# callers cd to the repo root first):
#   state <TAB> line <TAB> heading <TAB> nested
# state = open | partial | retired; line = the heading's 1-based line number;
# heading = the whole `## …` line; nested = the entry's `### ` headings, joined
# with "; " (empty when there are none) — the blocks that vanish with a retired
# parent. No file: prints nothing, returns 0, the same silence collect-ledger.sh
# keeps.
intake_entries() { # [<path>]
  local f=${1:-engineering-team/stories/_intake.md}
  [ -f "$f" ] || return 0
  awk '
    function flush() {
      if (heading == "") return
      printf "%s\t%d\t%s\t%s\n", state, line, heading, nested
    }
    function classify(m,   head) {
      head = substr(m, 1, 60)
      if (head ~ /\((partial|in progress|Part [A-Z]|[Tt]ier)/) return "partial"
      return "retired"
    }
    /^## 20[0-9][0-9]-/ {
      flush()
      heading = $0; line = FNR; state = "open"; nested = ""; marked = 0
      next
    }
    heading != "" && !marked && /^\*\*(PICKED UP|RESOLVED|DONE|REASSIGNED)/ {
      state = classify($0); marked = 1
    }
    heading != "" && /^### / {
      nested = nested (nested == "" ? "" : "; ") substr($0, 5)
    }
    END { flush() }
  ' "$f"
}
