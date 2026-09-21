# Indigo links on the Brainstorm Search pages turn sky blue on hover, because the global `a:hover` colour outranks their class colour

**Id:** 2026-09-21-bs-link-hover-turns-sky-blue
**Type:** cleanup
**Opened:** 2026-09-21 (setup-page-scaffold #1 review, non-blocking 1)
**Status:** OPEN
**Done:** —

`ui/src/styles.css:35–36` sets `a { color: var(--accent) }` and `a:hover { color: var(--accent-hover) }`
(#79c0ff). The Brainstorm Search pages colour their links indigo (#a5b4fc) through a class
(`.bs-tagindex-link`, `.bs-setup-back`, …) and set only `text-decoration` on hover. `a:hover`
(specificity 0,1,1) outranks the class rule (0,1,0), so the link changes hue when hovered:
`rgb(165,180,252)` → `rgb(121,192,255)`, measured on the `/setup/*` "← Back to setup" link at the
setup-page-scaffold #1 review. `.bs-tagindex-link` on `/tags` falls to the same cascade. The setup
checklist's cards had the same leak on their body text, which was fixed before commit
(`.bs-setup-step:hover { color: inherit }`).

**Fix shape.** Decide the intended hover look for links on the `bsp-` shell once, then write it once:
a hover colour on each link class, or one shared rule such as `.bsp-page a[class]:hover`. A one-off
patch to the setup back link alone would leave the Tags page behaving differently.

**Pointer:** `ui/src/styles.css:35–36`; the `.bs-setup-back` and `.bs-tagindex-link` rules;
`engineering-team/reviews/setup-page-scaffold/1-setup-page-and-placeholders.md`.
