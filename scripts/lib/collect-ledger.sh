# collect-ledger.sh — the ONE reader of the ledger's row files (ADR
# ledger-row-identity/0001). A ledger row minted since the OPEN.md table was
# frozen is a file, ledger/<id>.md, with the fielded header the templates use
# (engineering-team/templates/open-row.md). Sourced (not executed) by:
#   scripts/lib/collect-meta.sh — open `meta` row files join the escalation state
#   scripts/whats-open.sh       — open row files join the ledger section
# The numbered table in OPEN.md is NOT read here: its readers are where they
# always were, unchanged. scripts/harness-lint.sh L15(c) checks the same header
# fields, so a row this reader would misread fails the lint first.
#
# ledger_file_rows prints one line per ledger/*.md (cwd-relative — callers cd to
# the repo root first):
#   id <TAB> type <TAB> opened <TAB> status <TAB> title
# id = the filename without .md; type and status = the first word of their
# fields; opened = the first ISO date in **Opened:**; title = the first "# "
# line. A missing field is an empty column, so consumers split with awk -F'\t'
# (a shell `read` with IFS=tab collapses empty columns). No ledger/ directory,
# or no row in it: prints nothing, returns 0. One awk for the whole directory —
# the digest runs this at every session start.
ledger_file_rows() {
  local files=(ledger/*.md)
  [ -e "${files[0]}" ] || return 0
  awk '
    function flush() {
      if (file != "") printf "%s\t%s\t%s\t%s\t%s\n", id, type, opened, status, title
    }
    function first_word(line, field,    v) {
      v = line; sub("^\\*\\*" field ":\\*\\*[ \t]*", "", v); sub(/[ \t].*$/, "", v)
      return v
    }
    FNR == 1 {
      flush()
      file = FILENAME; id = FILENAME; sub(/^.*\//, "", id); sub(/\.md$/, "", id)
      type = opened = status = title = ""; got_type = got_opened = got_status = got_title = 0
    }
    !got_title && /^# / { title = substr($0, 3); got_title = 1 }
    !got_type && /^\*\*Type:\*\*/ { type = first_word($0, "Type"); got_type = 1 }
    !got_status && /^\*\*Status:\*\*/ { status = first_word($0, "Status"); got_status = 1 }
    !got_opened && /^\*\*Opened:\*\*/ {
      got_opened = 1
      if (match($0, /20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]/)) opened = substr($0, RSTART, RLENGTH)
    }
    END { flush() }
  ' "${files[@]}"
}
