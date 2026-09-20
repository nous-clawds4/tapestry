# utf8-trim.sh — the ONE trim used by the roll-up and the session-start digest
# (story rollup-scanner-fidelity #1, ADR rollup-scanner-fidelity/0001; OPEN.md
# row 290). Sourced (not executed) by:
#   scripts/lib/collect-meta.sh — the listed ledger rows
#   scripts/whats-open.sh       — the HANDOFF status lines
#
# The budget is BYTES, as `cut -c1-150` already delivered on GNU userland. What
# changes is that the budget can no longer land inside a character: a line whose
# 150th byte falls mid-character used to come out as invalid UTF-8 — harmless to
# a terminal, fatal to a strict decoder, and live today on OPEN.md row 193.
#
# Not a locale fix: GNU `cut -c` counts bytes under every locale (measured in the
# tapestry container, row 290 refinement (a)), so setting LC_ALL would cure macOS
# and change nothing on Linux. Not an awk fix either: awk's substr is byte- or
# character-based depending on which awk and which locale — the same divergence,
# relocated. This slices under LC_ALL=C, so every platform gives the same answer,
# and forks nothing (bash 3.2 parameter expansion only).
utf8_trim() { # <max-bytes> <string>
  local LC_ALL=C LANG=C max=${1:-150} s=${2-} t
  if [ "${#s}" -le "$max" ]; then printf '%s' "$s"; return 0; fi
  t=${s:0:$max}
  # The cut splits a character exactly when the NEXT byte is a continuation byte
  # (10xxxxxx). Cutting on a boundary must leave the character before it whole.
  case ${s:$max:1} in
    [$'\x80'-$'\xbf'])
      while [ -n "$t" ]; do
        case ${t: -1} in
          [$'\x80'-$'\xbf']) t=${t:0:${#t}-1} ;;   # another continuation byte
          *) t=${t:0:${#t}-1}; break ;;            # the lead byte — drop it and stop
        esac
      done
      ;;
  esac
  printf '%s' "$t"
}
