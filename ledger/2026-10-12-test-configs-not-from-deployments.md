# Tests that depend on instance settings use invented values, never a deployment's real ones

**Id:** 2026-10-12-test-configs-not-from-deployments
**Type:** meta
**Opened:** 2026-10-12 (book `duty-menu-public-relay` close, §7 finding 1)
**Status:** OPEN
**Done:** —

**What happened.** Book `assistant-duty-menu` took "this instance's public relay" from `BRAINSTORM_RELAY_URL`. Every
test configured that as a public URL. Every Docker deployment sets it to the container-internal `ws://localhost:7777`
(`docker/entrypoint.sh:9`), so the rule never fired in production. It passed two reviews, and the owner found it by
publishing a menu that had no Scores or Lists.

**Fix shape.**
- A shared fixture of the reference deployment's real config, the values `config/brainstorm.conf.template` renders on
  Docker (`BRAINSTORM_RELAY_URL`, `STRFRY_DOMAIN`, the NIP-85 home relay, …).
- A Test Design pitfall in `workflows/3-test-design.md`: when a story reads instance config, at least one test uses the
  deployed values.

**Pointer:** `engineering-team/audits/duty-menu-public-relay/audit.md` §7.
