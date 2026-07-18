#!/usr/bin/env bash
# check-safe-to-merge.sh — the pre-merge deploy-safety wait-and-recheck mechanism.
#
# Asks the instance a deploy-triggering merge will redeploy whether it is safe
# to redeploy right now (GET <base>/api/deploy-safety/status — the story #1
# answer, payload per ADR deploy-safety-gate/0001), and waits-and-rechecks,
# bounded and journaled, while the verdict is unsafe. The canonical recipe —
# who runs this, against which instance, and what to do with each outcome —
# is docs/SAFE_TO_MERGE.md (ADR deploy-safety-gate/0002).
#
# Usage: scripts/check-safe-to-merge.sh <instance-base-url> [max-attempts] [interval-seconds]
#   Defaults: 45 attempts x 60 s (~45 minutes). The defaults ARE the recipe's
#   canonical numbers; the override args exist for the test suite and for an
#   operator's explicit, recorded post-stop decision only — a cycle run never
#   passes them on its own initiative.
#
# Exit codes (consumed by the cycle skills and docs/SAFE_TO_MERGE.md):
#   0  safe verdict just observed — merge may proceed immediately
#   1  bound exhausted without a safe verdict — stop; operator decides
#   2  no usable answer (3 consecutive unusable attempts) — stop; NEVER safe
#   3  usage error (missing/malformed arguments)
#
# The script branches ONLY on safeToDeploy. It must not branch on reasons,
# nextFire, or any other schedule content — the instance owns the verdict
# policy (its effective bufferMs is echoed in every response and journaled
# verbatim here); interpreting the raw schedule data would be the re-derived
# safety policy AC-1 forbids. Journal everything, interpret nothing.
#
# No JSON formatter dependency on purpose: the two load-bearing fields are
# extracted with grep/sed against the pinned compact-JSON contract, and the
# raw body is journaled verbatim, so the check cannot die on a missing tool
# at the exact moment it matters (ADR 0002 sub-decision 6).
set -uo pipefail

ATTEMPTS_DEFAULT=45
INTERVAL_DEFAULT=60
ENDPOINT_PATH="/api/deploy-safety/status"
MAX_STRIKES=3   # consecutive unusable answers before the fast no-answer exit

usage() {
  {
    echo "Usage: scripts/check-safe-to-merge.sh <instance-base-url> [max-attempts] [interval-seconds]"
    echo "  e.g. scripts/check-safe-to-merge.sh https://staging.brainstorm.world"
    echo "  Defaults: ${ATTEMPTS_DEFAULT} attempts x ${INTERVAL_DEFAULT} s. Canonical recipe: docs/SAFE_TO_MERGE.md"
  } >&2
}

BASE="${1:-}"
if [ -z "$BASE" ] || ! printf '%s' "$BASE" | grep -qE '^https?://'; then
  usage
  exit 3
fi
BASE="${BASE%/}"

ATTEMPTS="${2:-$ATTEMPTS_DEFAULT}"
INTERVAL="${3:-$INTERVAL_DEFAULT}"
if ! printf '%s' "$ATTEMPTS" | grep -qE '^[0-9]+$' || ! printf '%s' "$INTERVAL" | grep -qE '^[0-9]+$'; then
  usage
  exit 3
fi

strikes=0
last_verdict="none"
i=0
while [ "$i" -lt "$ATTEMPTS" ]; do
  i=$((i + 1))
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  body=$(curl -sf --max-time 10 "${BASE}${ENDPOINT_PATH}" 2>/dev/null)
  curl_rc=$?

  if [ "$curl_rc" -ne 0 ]; then
    last_verdict="no-answer"
    strikes=$((strikes + 1))
    echo "[$ts] attempt $i/$ATTEMPTS verdict=no-answer reasons=n/a raw=curl exit $curl_rc (connection failure, non-2xx, or timeout)"
  else
    # Single-line the body so the journal line format holds.
    flat=$(printf '%s' "$body" | tr '\n\r' '  ')
    sd=$(printf '%s' "$flat" | grep -oE '"safeToDeploy"[[:space:]]*:[[:space:]]*(true|false)' | head -n 1)
    reasons=$(printf '%s' "$flat" | grep -oE '"reasons"[[:space:]]*:[[:space:]]*\[[^]]*\]' | head -n 1 | sed -E 's/^"reasons"[[:space:]]*:[[:space:]]*//')
    [ -n "$reasons" ] || reasons="n/a"

    case "$sd" in
      *true)
        last_verdict="safe"
        echo "[$ts] attempt $i/$ATTEMPTS verdict=safe reasons=$reasons raw=$flat"
        echo "SAFE — merge may proceed (act immediately; re-run the check if more than 5 min elapse before the merge — docs/SAFE_TO_MERGE.md)."
        exit 0
        ;;
      *false)
        last_verdict="unsafe"
        strikes=0
        echo "[$ts] attempt $i/$ATTEMPTS verdict=unsafe reasons=$reasons raw=$flat"
        ;;
      *)
        # Usable connection, unusable answer (404 body, non-JSON, missing field).
        last_verdict="no-answer"
        strikes=$((strikes + 1))
        echo "[$ts] attempt $i/$ATTEMPTS verdict=no-answer reasons=n/a raw=$flat"
        ;;
    esac
  fi

  if [ "$strikes" -ge "$MAX_STRIKES" ]; then
    echo "NO USABLE ANSWER (${MAX_STRIKES} consecutive unusable attempts) — not treated as safe; the operator decides."
    exit 2
  fi

  if [ "$i" -lt "$ATTEMPTS" ]; then
    sleep "$INTERVAL"
  fi
done

echo "BOUND EXHAUSTED (${ATTEMPTS} attempts x ${INTERVAL}s) — last observed verdict: ${last_verdict}; not merging; the operator decides."
exit 1
