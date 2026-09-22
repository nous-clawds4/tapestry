# For a filter or deny rule, the acceptance criteria describe the happy path — both defects that mattered in `site-trust-signals` #1 were found only by probing past them

**Id:** 2026-09-22-rule-stories-need-bypass-probing
**Type:** meta
**Opened:** 2026-09-22 (site-trust-signals book close, retro §7)
**Status:** OPEN
**Done:** —

`site-trust-signals` #1 shipped a deny rule (`isBlockedProbePath`) and a deploy-time flag
(`ALLOW_INDEXING`). Its review found the two defects that mattered, and neither one violated an
acceptance criterion as written:

- **Encoding bypass.** Express does not percent-decode `req.path`. So `/%2Eenv`, `/wp-login%2Ephp`
  and `/config%2Ejson` answered `200` with the SPA shell, which is exactly the signal the story
  existed to remove. AC-7 names `/.env` and `/wp-login.php`; the encoded forms were nobody's case
  until the reviewer tried them.
- **Config passthrough.** `docker-compose.yml` never forwarded `ALLOW_INDEXING`. Setting the flag on
  the production droplet would not have reached the Node process, so production would have kept
  serving `Disallow: /`, with no symptom anywhere locally. Test S5 now pins it.

The review's verdict says so plainly: "the ACs described the happy path competently and neither
defect violated one as written." The planned tests pinned what the story said. The defects were in
what an adversary, or the deploy, would actually do.

Nothing asks for this today. There is no mention of bypass inputs or adversarial probing in:
- `roles/reviewer.md`
- `roles/tester.md`
- `workflows/5-review.md`
- `templates/review-checklist.md`
- the edge-case section of `templates/test-plan.md`

The `nip05-ssrf-guard` review shows the same practice paying off with no rule behind it: its
adversarial pass over alternate IP encodings added test B6 during Review.

**Fix shape.** For any story whose deliverable is an allow, deny or classify rule:
- In the test-plan template's edge cases, add one prompt: list the bypass inputs (percent- and
  mixed-encoding, case, alternate IP forms, trailing dots and slashes, traversal) and assert each.
- In the review checklist, add one line: probe a rule-shaped change with bypass inputs before PASS.
- For a new environment flag, show that it reaches the running process, not just the config file.

**Ports to Direction mode:** yes, unchanged. A gate judge audits against the same ACs, so a bypass
they don't name passes there too.

**Related:** OPEN.md rows 169, 174 and 175 are the same family: a test that asserts a proxy or mere
presence rather than the property itself.

**Pointer:** `engineering-team/reviews/done/site-trust-signals/1-security-txt-and-honest-404s.md`
(Findings, Blocking 1, and the Verdict); `engineering-team/audits/site-trust-signals/audit.md` §7.
