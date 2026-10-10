# A few handlers ran strfry or node through a shell string built from request values

**Id:** 2026-10-10-request-values-reached-a-shell
**Type:** bug
**Opened:** 2026-10-10 (found while sizing story 8 of `security-auth-exposure`, book `admin-action-owner-check`)
**Status:** DONE
**Done:** 2026-10-10 — `staging` `651a35f1`; PR #844 into `main` (merge `0c710d55`, deploy run 146); PR #845 into `feat/tags` (merge `ea827933`) and PR #846 into `feature-magic-carpet` (merge `9face574`), both sandbox deploys succeeded. Harmless probes on each deploy: a malformed pubkey gets 400, and a valid lookup still returns the profile.

Some handlers built a shell command string to run `strfry scan` or a node script, and request values could reach that
string; three more read paths used a quote escape that does not work inside single quotes. All of them now call
`execFile` / `execFileSync` with an argument list, and a pubkey supplied by a request must be 64 hex characters (400
otherwise). Response shapes are unchanged. The owner approved shipping it as a hotfix everywhere at once, ahead of
story 8's Architecture gate (batch 0 of the sweep).

Tests: `test/shell-input-hardening.test.js` (I1–I6). On `feature-magic-carpet` three of the files do not exist, so the
port covers the rest, plus one branch-only read path with the same broken escape.

Lesson for later work: build strfry and node invocations as argument lists (`execFile`), never as shell strings, even
when the input looks validated; a quote escape inside a shell string is easy to get wrong.

**Pointer:** PRs #844, #845, #846; `test/shell-input-hardening.test.js`.
