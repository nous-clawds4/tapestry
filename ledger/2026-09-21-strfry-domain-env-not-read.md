# Setting STRFRY_DOMAIN in the environment does not choose an instance shape for a hermetic run

**Id:** 2026-09-21-strfry-domain-env-not-read
**Type:** meta
**Opened:** 2026-09-21 (assistant-profile #4 review, harness friction 1)
**Status:** OPEN
**Done:** —

**What happens.** `getConfigFromFile` reads only `/etc/brainstorm.conf` (`src/utils/config.js:16-66`), and
never the environment. With no file — a dev host, a scratch export, CI — `describeInstance()` reports an
unconfigured, non-public instance, whatever the environment says. The assistant-profile #4 reviewer tried
it. With `STRFRY_DOMAIN=staging.brainstorm.world`, and again with `STRFRY_DOMAIN=192.168.1.50:7777`, the real
status handler still answered `isPublicInstance: false`.

**Why it matters.**

- Story 3's review (`engineering-team/reviews/done/assistant-profile/3-one-default-assistant-profile.md`,
  "Quality gates") reports the real handler passing for three instance shapes. One of them is
  "`STRFRY_DOMAIN=staging.brainstorm.world` (public)", with "only the key store and the owner lookup" faked.
- If the variable was set this way, that review's public and LAN runs repeated the unconfigured one.
- Nothing ended up uncovered: story 3's stack-free suite pins the public and LAN shapes through injected
  config.
- The trap is in the verification step, where a reviewer believes they checked a shape they did not.

**Fix shape.**

- Document one hermetic way to pick an instance shape: inject `getConfigFromFile` into `describeInstance`,
  or inject `describeInstance` through the handler seams, as the suites already do.
- Say that the environment does not reach `getConfigFromFile`.
- Put this where reviewers look: AGENTS.md or the reviewer role's gate notes.

**Pointer:** `engineering-team/reviews/done/assistant-profile/4-my-assistant-page.md`, "Harness friction" 1.
