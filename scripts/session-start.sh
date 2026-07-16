#!/usr/bin/env bash
# session-start.sh — the SessionStart digest (ADR harness-self-improvement/0006).
# Fired by the hook in .claude/settings.json at every session start; also
# runnable by hand. A compact health check, NOT the full roll-up — that's
# /whats-open (which also does network: git fetch, gh pr list; this never does).
#
# ADVISORY BY CONSTRUCTION (ADR 0004): always exits 0. A red lint must inform
# the session, never brick it — SessionStart hooks cannot block, and this
# script must never give them a reason to try.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || true
LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/collect-meta.sh"

printf '━━ session-start digest — harness health (full roll-up: /whats-open) ━━\n'

# 1. Harness invariants (violations + waivers fully visible; clean = one line).
if [ -f scripts/harness-lint.sh ]; then
  printf 'harness-lint:\n'
  bash scripts/harness-lint.sh 2>&1 | sed 's/^/  /'
else
  printf 'harness-lint: script not found in this repo — skipped\n'
fi

# 2. Meta-escalation state — the shared lib owns the collector, the thresholds,
#    and the banner wording (scripts/lib/collect-meta.sh).
if [ -f "$LIB" ]; then
  . "$LIB"
  collect_meta
  if meta_escalation_fires; then
    meta_banner
  elif [ "$META_COUNT" -eq 0 ]; then
    printf 'meta inbox: 0 open (clear)\n'
  else
    printf 'meta inbox: %s open, oldest %sd\n' "$META_COUNT" "$META_MAX_AGE"
  fi
else
  printf 'meta inbox: collect-meta lib not found — skipped\n'
fi

# 3. Stack probe (≤2s; port discovery per AGENTS.md §1 — conf, else the code default).
PORT=7778
if [ -f /etc/brainstorm.conf ]; then
  conf_port=$(grep -m1 -oE 'CONTROL_PANEL_PORT=[0-9]+' /etc/brainstorm.conf | cut -d= -f2)
  [ -n "$conf_port" ] && PORT=$conf_port
fi
if command -v curl >/dev/null 2>&1 \
  && curl -sf -m 2 "http://localhost:${PORT}/api/concept-graph/summaries" -o /dev/null 2>/dev/null; then
  printf 'stack present at :%s — concept-graph API answering; AGENTS.md §1–§3 orientation applies\n' "$PORT"
else
  printf 'stack absent → use the AGENTS.md fallback ladder (§1–§2): docs + grep, no live concept graph\n'
fi

# 4. Open books.
book_count=0
book_names=""
for f in engineering-team/audits/*/book.md; do
  [ -e "$f" ] || continue
  if grep -qiE '^\*\*Status:\*\*[[:space:]]*Open' "$f"; then
    book_count=$((book_count + 1))
    book_names="${book_names:+$book_names, }$(basename "$(dirname "$f")")"
  fi
done
if [ "$book_count" -gt 0 ]; then
  printf 'open books: %s (%s)\n' "$book_count" "$book_names"
else
  printf 'open books: none\n'
fi

printf 'full roll-up: /whats-open (bash scripts/whats-open.sh) · stats: bash scripts/harness-stats.sh\n'
exit 0
