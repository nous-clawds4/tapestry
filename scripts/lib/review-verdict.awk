# review-verdict.awk — the operator-ratified final-verdict rule for review files.
#
# Rule (harness-self-improvement story #1, Planning gate 2026-07-02): the LAST
# verdict-shaped token in the file wins. A token is PASS or CHANGES_REQUESTED
# (space or underscore) appearing on a heading line or a line with bold markers.
# Prints exactly one of: PASS | CR | NONE.
#
# Consumers: scripts/harness-lint.sh (L1/L4) and scripts/harness-stats.sh
# (verdict tallies). Both resolve this file relative to their own location
# (BASH_SOURCE), so fixture working directories can't break the lookup.
# Changing this rule is a harness change (see engineering-team/CHANGELOG.md).
#
# Known edge (waived, documented in story #1 Deviations): prose like
# "**PASS stands** ... cannot pass" reads as PASS-final; see the tq-#22 waiver.
/^#/ || /\*\*/ {
  line = $0
  while (match(line, /CHANGES[ _]?REQUESTED|PASS/)) {
    v = (substr(line, RSTART, 2) == "PA") ? "PASS" : "CR"
    line = substr(line, RSTART + RLENGTH)
  }
}
END { print (v == "") ? "NONE" : v }
