# Migrating your branch to epic-scoped doc folders

**What changed on `staging` (2026-06-04):** the engineering-team docs moved out of a single flat `<n>-<slug>` namespace into **per-epic folders**:

- `stories/<epic>/<n>-<slug>.md` (+ `.test-plan.md`)
- `decisions/<epic>/<NNNN>-<slug>.md`
- `reviews/<epic>/<n>-<slug>.md`
- `epics/<epic>.md` — one umbrella per epic

Numbers are now **scoped per epic** (they restart inside each folder and may repeat across epics — that's fine, paths are disjoint). This is what stops branches from colliding on the same `stories/8-*.md` path. Existing docs kept their original numbers; only *new* work follows per-epic numbering. See `engineering-team/README.md` → "Epic-scoped docs".

The mechanistic files (`README.md`, `roles/product-owner.md`, `roles/reviewer.md`, `workflows/1-planning.md`, `workflows/5-review.md`) were also updated to describe this scheme.

---

## Runbook

```bash
# 1. Get the new staging
git fetch origin staging

# 2. See what moved (optional, orienting)
git diff --stat origin/staging...HEAD -- engineering-team/

# 3. Merge staging into your branch
git merge origin/staging
```

**What to expect during the merge:**

- **Files you never touched** that staging moved → git follows the rename automatically. Clean.
- **A doc you modified** that staging moved → a conflict on the *old flat path*. Keep your content, but it belongs at the **new epic path**. (The Claude prompt below handles this.)
- **The 5 mechanistic files** → if you didn't customize them, take staging's version. If you did, merge by hand (staging's structural rules should win; layer your wording on top).
- **Your branch's own new docs** still sitting in the flat namespace (e.g. `stories/12-my-feature.md`) → these do **not** conflict (their path is unique), but they're now out of step with the convention. Move them into an epic folder (the prompt does this).

After the merge resolves, **your branch's own docs still need bucketing into epic folders.** Don't do it by hand — run the prompt.

---

## Claude Code prompt — run this after `git merge origin/staging`

Paste this into Claude Code on your branch once the merge is in progress or just completed:

> The `staging` branch reorganized `engineering-team/` docs from a flat `<n>-<slug>` namespace into per-epic folders: `stories/<epic>/`, `decisions/<epic>/`, `reviews/<epic>/`, with `epics/<epic>.md` umbrellas. I've just merged `origin/staging` into my branch. Help me finish the migration:
>
> 1. **Resolve any merge conflicts** caused by the reorg. For a doc *I* modified that staging *moved*, the rule is: keep my content, place it at staging's new epic path, and delete the old flat copy. For the 5 mechanistic files (`README.md`, `roles/product-owner.md`, `roles/reviewer.md`, `workflows/1-planning.md`, `workflows/5-review.md`), prefer staging's structural rules; preserve any intentional wording of mine on top. Don't touch source-code conflicts unrelated to docs — flag those for me.
> 2. **Find my branch's docs still in the flat namespace** — any `engineering-team/stories/*.md`, `engineering-team/decisions/*.md`, `engineering-team/reviews/*.md` sitting directly in those dirs (ignore `_intake.md` and `.gitkeep`).
> 3. **Propose an epic bucketing** for them. Reuse an existing epic folder where the work fits; otherwise propose a new `<epic-slug>` (and a matching `epics/<epic-slug>.md` stub). Show me the proposed mapping as a table and let me adjust before moving anything. Ask me whenever an item is ambiguous — these are my stories, don't guess silently.
> 4. **Execute with `git mv` only — pure move, no renumbering, no content edits.** Existing files keep their numbers (still unique within their new epic folder). Keep each story's `.md` and `.test-plan.md` together, and put its review/ADR in the same-named epic folder under `reviews/`/`decisions/`.
> 5. **Verify:** nothing left flat except `_intake.md`/`.gitkeep`, no conflict markers remain, `git status` shows only renames (R) plus the epic stubs. Then summarize what moved and stop — I'll commit and push.

---

## Why pure-move / no-renumber

Renumbering would rewrite every story↔ADR↔review cross-reference and every `**Story:**` path — error-prone and pointless. Keeping the original numbers preserves all references (and bare "ADR 0015"-style mentions still resolve), while the epic folder gives the disjoint path that actually prevents merge collisions. New work numbers per-epic from there.
