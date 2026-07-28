# Prior Art and Positioning: Second Brain (Goals, Executors, and Delegated Launch)

**Slug:** second-brain
**Date:** 2026-07-27
**Kind:** Research companion. Input to Phase-2 and Phase-3 scoping.
**Supersedes by reference:** `prd/second-brain.md` §2 (Positioning & Competitive Context, researched 2026-07-21). The PRD is immutable. Read §2 with this document beside it.

## Why this exists

The owner described a paradigm for a later phase: some sessions become **Executors** whose only job is editing the goal graph, working one goal at a time, with the power to start further Executors (each assigned a goal at birth) and to start Team sessions that carry a goal to completion.

The PRD's Policy Constitution currently forbids that. §7.3 reads: *"Sessions propose, never launch."* The brain-side launch answer sits in Phase 2 and autonomous launch sits in Phase 3 (§8.3). So the question "has this been done before?" is not idle curiosity. It decides what the Phase-2 and Phase-3 scoping conversations are allowed to assume.

A second reason. PRD §2 rests on a single research pass and states that no product combines owner-curated ontology, autonomous agent goal execution, and trust-graded sharing. A six-lineage sweep on 2026-07-27 tested that framing adversarially, by formulating falsifiable novelty claims and assigning each one a researcher whose job was to kill it. **Most of the claims died.** §2 is not wrong about the three-way combination, but it credits the product with several firsts that belong to other people. This document records what the sweep found, so the next refresh can diff against it rather than start over.

## 1. The verdict

Seven novelty claims were formulated. Six went to adversarial refutation. Four died at high confidence, one at medium, and one survived in narrowed form.

The paradigm is more trodden than the PRD's positioning suggests. A durable task store acting as the scheduler, with ephemeral workers taking one item at a time, is 2023 work. A role write-scoped to the intent store and barred from doing the work is shipped today in a competing toolkit. Recursive worker creation assigned from a shared task graph is shipped today in another. Start-time eligibility as a bounded ancestry walk to an owner-signed root, with a non-widening invariant, is a published authorization specification. Signing as private provenance rather than publication is 2013 work.

What survives is not a mechanism. It is a governance posture over intent, stated in §3.

Three parts of the design are novel for a reason worth knowing. Nobody does them because the naive version has already failed in public, not because nobody thought of them:

- **Standing derived at read time with no producer for the terminal states.** The 2023 autonomous-agent generation died of task lists that grew faster than they retired. The Second Brain currently has no way to produce "achieved" or "abandoned" at all.
- **An agent whose mandate includes editing the success criteria.** The Darwin Gödel Machine (2025) deleted the markers its own evaluation used to detect hallucination, after being instructed not to.
- **Recursive spawning with no spend ledger.** Published multi-agent research systems report roughly fifteen times the token cost of single-agent chat, and spawning dozens of workers for simple requests.

## 2. What is already other people's work

Each entry names the aspect, who got there first, and the one thing worth taking.

**A five-role pipeline handing structured artifacts between roles.** MetaGPT (2023), independently ChatDev (2023) and Self-Collaboration (2024). *Take:* they hand documents, not conversation, and they say why. Structured handoff is what stops one role's invention from becoming the next role's premise. The story-to-decision-to-test chain rests on the same property.

**Blocking human gates between phases, each producing a markdown artifact.** Amazon Kiro (2025) and GitHub Spec Kit (2025). *Take:* Kiro also shipped a mode that skips all three gates. A vendor with usage data decided an escape hatch was necessary. Expect the same pressure here, and decide in advance what the answer is.

**A written constitution governing every downstream phase.** Spec Kit's articles with their simplicity and anti-abstraction gates (2025). *Take:* it pairs the constitution with a documented path for justifying a violation. A rule with a recorded exception process survives better than a rule people quietly route around.

**Goals as first-class objects with a lifecycle and explicit deliberation.** Jadex goalbases with option, active, and suspended states and pluggable deliberation (2003). Nonlin recorded why each condition was needed (1977). *Take:* Jadex stores standing and it works. The interesting question is not whether standing is stored or derived. It is who produces the final transition.

**The store is the scheduler.** BB1 (1985) put it plainly: the scheduler holds no control knowledge of its own and adapts to the control plan recorded on the control blackboard. *Take:* the Executor and Team split being proposed is BB1's control blackboard and domain blackboard, forty-one years old. The split is sound. It is also not new, and the literature on how it fails is worth reading before rebuilding it.

**A priority agenda with a reason attached to every item, and a budget.** AM and EURISKO (1976 and 1982). *Take:* EURISKO allocated processing quanta per agenda item in proportion to priority. That is a per-goal budget ledger, in 1982, which this product does not have in 2026.

**A durable store as scheduler, with ephemeral workers taking one item at a time.** BabyAGI (2023). Formalized with typed relations, an append-only log, deterministic replay, and goal-to-model-call lineage by ActiveGraph (2026). *Take:* ActiveGraph is the closest single system found. Read it before writing more Executor design. Its stated absences are exactly where the remaining claims live: no signing, no point-of-view filtering, no human editing surface, no gates, no eligibility test.

**A role write-scoped to the intent store and forbidden to do the work.** BMAD-METHOD v6 ships a story-authoring agent whose whole command set is drafting, course-correcting, and checklisting, carrying an explicit instruction that it may never implement or modify code. *Take:* this is the Executor concept, shipped, today.

**Recursive worker creation with the assignment coming from a shared task graph.** CAMEL Workforce creates a worker for a specific task node, nests workforces inside workforces, and has children claim assignments atomically and write results back. Task Master runs an orchestrator and executor over a shared task file. Nostr's job-request pattern chains work between providers. *Take:* Task Master's weakness is the instructive part. It hands the executor a task identifier *and* a prose brief, and the prose wins. The hybrid drifts back into prompting.

**Signed records in a deliberately private single-owner store, where signing means provenance rather than publication.** Perkeep (2013). Haven ships a private relay. Anytype ships a local-only mode. *Take:* Haven and Anytype *enforce* it. The Second Brain's privacy is a stated convention with named live exceptions. Until the Phase-2 mechanism ships, this is an intention, not a property.

**Per-role tool restriction.** Standard in current agent tooling. *Take:* worth auditing which roles actually carry a restriction today, rather than assuming the pattern is applied uniformly.

## 3. What survives

One conjunction survived adversarial refutation:

> **Intent is authored permissionlessly. Ratification is a separate, optional, append-only fact. The authority to launch autonomous work from a goal is computed in code from that ratification lineage. A running launch re-reads its terms verbatim at every gate and halts on textual drift.**

Every clause carries weight, and the refuting systems show why. The authorization specifications that kill the eligibility claim on its own terms share one property: **authority is constitutive.** A delegation that does not derive from the root is simply not a capability. An unattested artifact is simply not deployable. So "is this ratified?" is a question with no well-formed negative answer. It cannot be asked, because an unratified thing does not exist as a unit of authority in the first place.

The Second Brain's goals exist unratified by construction, because the wider architecture accepts anything anyone publishes and filters later. That makes "this goal has no owner-ratified anchor" a live, meaningful refusal rather than a category error. Nobody else asks the question because nobody else lets intent exist unratified.

Two narrower elements also survive.

**A scope-narrowing test over prose, made fail-closed by an outside blinded judgment.** Every prior system's narrowing check is set arithmetic over machine-checkable structure. This one compares two natural-language boundary statements, refuses a verdict list that does not match the steps so a mistake cannot read as approval, and returns "unjudged" rather than permitting. No system found treats an undecidable natural-language check as a first-class admission guard instead of advisory review.

**A contamination-conditional, direction-asymmetric void rule.** Fresh evaluator per gate is prior art. Rejection-binding with approval-insufficient is prior art, in software admission control and in jury procedure alike. What was not found anywhere is an evaluator that *self-reports* its own broken blinding, where that self-report voids only its permissive verdict while its halting verdict still binds and still counts toward the run's stopping rules.

**Novel and valuable are different words.** The valuable part is narrower than the novel part. This is a substrate where what counts as success is a durable, human-readable, separately-governed object, distinct from who may pursue it. That separation is the thing nothing else has. It is also the only thing that makes recursive self-spawning survivable, which §6 returns to.

## 4. What prior art predicts will break

### Already covered

**Evaluator investment bias.** The blinded gate judge is an implementation of a mitigation the 2026 judge-bias literature files as future work. It has caught real breaches twice, in two different books.

**Self-ratification.** Reserving book completion and everything past staging to the owner closes a loop that competing agent-team tooling leaves open. Published documentation for at least one such system concedes that its lead agent may decide the team is finished before the work is.

**Audit reconstruction.** The research on detecting agent misbehavior finds that evidence is typically spread across multiple traces, which is the external argument for an append-only journal. This one passes the hard test: it records its own breaches.

### Not covered, in rough order of how fast each will bite

**Edits between runs are ungated.** The eligibility guards run at launch and at gate boundaries. An Executor operating between runs can rewrite any goal it did not start under. No anchor check, no staleness check, and at the current policy setting the boundary judgment never fires. This is the Darwin Gödel Machine hazard exactly, and it is the largest hole. §6 is about this.

**Nothing retires, so the graph only grows.** The terminal standings cannot currently be produced. With no retirement path, the proposer keeps nominating dead goals and orientation degrades as roots accumulate past the cap that bounds the orientation read. This is precisely how the 2023 generation died.

**There is no spend accounting anywhere.** Counters and a deadline are not a budget. Adding recursive Executors to a system with no ledger reproduces the documented amplification pattern.

**The Director is not blinded.** The judge was blinded and the party holding the deadline, the kick-back counts, and the remaining work was not. Measured exploit rates under exactly that kind of accumulating pressure rise sharply across rounds, with the first exploit arriving far earlier as pressure builds.

**The ceiling is prose, and the enforcement mechanism is available and unused.** The permission configuration currently allows the push and pull-request commands the ceiling forbids in writing, and the harness carries only a session-start hook. A deterministic external check that can veto an action exists and is not wired to the ceiling.

**The mechanical gate can report success over failure.** Three recorded instances of a full test run reporting success while actually failing, plus a fourth item recording that the documented fix for it does not work in this shell. A director trusting the notification journals a green gate that was red.

**Goal prose becomes the worker's instructions.** A run's ask, ceiling, and success criteria are taken verbatim from goal text, and goal content is readable without authentication by design. Anything writable into a goal is an instruction to a downstream worker.

**Completion detection can silently not run.** One recorded case where the check ran, found no anchor artifact, and gave no signal that it was doing nothing.

## 5. Design borrowings

Proposals only. Nothing here is a policy change, which is the owner's alone (§7.6).

### Adopt

**Rate-bounded spawning, from process supervision practice (1996).** Bound Executor creation by rate rather than depth: more than *R* restarts in *T* seconds terminates the subtree and escalates to the parent. Every agent framework in the survey uses a hardcoded depth integer. A rate bound turns runaway into a bounded upward cascade instead of an explosion. Cheap now, expensive to discover later.

**A deterministic external veto on completion claims.** The available hook mechanism is the only thing in the entire survey by which a program, not a model, can refuse an agent's claim that work is done. Wire it to the staging ceiling and to "no anchor artifact exists." Note the trap: only one specific exit status blocks. The neighbouring one is treated as non-blocking and the action proceeds.

**Content-addressed ratification.** Have the approval fact commit to a hash of the goal's terms instead of reasoning about timestamps. This removes the unknowable-timestamp branch, removes the re-signing ambiguity, and turns the drift check into a hash comparison that cannot be got subtly wrong. This is how the refuting authorization specifications handle the same problem.

**Level-triggered reconciliation for completion detection.** Hold keys, not events, and re-examine the whole world each pass. The absence of an expected object becomes an observable condition rather than a skipped branch. This directly fixes the silent no-op.

**Calibrate the judge.** Eight books of journaled verdicts already exist, and a statistics script already derives verdict and kick-back rates. Frozen rubrics give stability, which is not validity. Validate against owner labels, watch for drift across model versions, recalibrate when the rubric or the model changes. An uncalibrated evaluator used as a gate is the configuration practitioners currently advise against.

**Ship abandonment before shipping anything that creates goals automatically.** EURISKO's own 1983 retrospective concedes that its human curator pruning degenerate heuristics between runs was central to the autonomy it reported. Later program-search systems reintroduced the same idea as periodic resets. A creation path without a retirement path is the documented failure.

### Reject

**In-place record rewriting for graph refinement.** Two 2025 memory systems let a model pass rewrite existing records to refine the graph. Against an intent store, that is the Darwin Gödel Machine failure with a friendly name. Keep append-only absolutely.

**Richer spawn prompts as the alignment fix.** That is the right answer when the assignment is prose and the wrong answer when the assignment is a node. Task Master demonstrates the drift. If Executors are built, the spawn should carry a goal identifier and nothing else.

## 6. The question that decides this

**Is editing the goal graph a governed act, or a free one?**

Launching is governed today. Eligibility is computed, with named refusals, failing closed. Writing is merely gated by ownership.

If Executors write freely, the result is a competing toolkit with a graph database and signed records underneath. Better engineered than most, occupying a space two shipped systems already occupy, with a documented failure mode available to any Executor that finds a goal inconvenient. That is the bespoke-reimplementation outcome, and the refutations show it is the default one.

The other branch is the new capability:

> **The authority to change what counts as success is separately and code-enforceably governed from the authority to pursue it.**

Concretely: an Executor may propose a decomposition, a re-scoping, or an abandonment. A write that would alter the terms of any goal carrying an unsuperseded approval, or that would widen any boundary, is refused by the same logic that refuses a launch. Ratification becomes the thing that freezes a subtree against its own workers, and re-ratification stays with the owner.

Nothing in the six lineages does this, because nothing else separates intent-existence from intent-ratification in the first place. That architectural choice is already made and mostly not yet cashed in. Make the write path fail closed and the paradigm is defensible on its own terms. Leave it open and every claim above collapses into a well-audited version of what shipped last year.

## 7. Sources

Method: six research lineages, each surveyed by a dedicated researcher, producing 183 catalogued systems. Seven falsifiable novelty claims were then formulated and six assigned to adversarial researchers instructed to refute them, and to default to refutation on a close match.

### The three that matter most

Examine these directly before Phase-3 design.

- **BMAD-METHOD v6** — the write-scoped story agent and the automated pipeline skill. https://github.com/bmad-code-org/BMAD-METHOD · https://docs.bmad-method.org/reference/agents/ · the prohibition quoted in §2 is in `bmad-core/agents/sm.md` at tag v4.43.1.
- **CAMEL Workforce** — worker creation against a task node, nested workforces, atomic claiming. https://docs.camel-ai.org/key_modules/workforce · https://github.com/camel-ai/camel (`camel/societies/workforce/task_channel.py`)
- **ActiveGraph**, "The Log is the Agent" (Nakajima, 2026) — the closest single system to the whole design. arXiv:2605.21997 · https://github.com/yoheinakajima/activegraph · https://activegraph.ai/

### Refuting systems by claim

- **Eligibility as bounded ancestry walk with a non-widening invariant** — UCAN v1.0. https://github.com/ucan-wg/delegation · https://github.com/ucan-wg/invocation. Corroborated by X.509 path validation (RFC 5280) and in-toto.
- **Signed private provenance rather than publication** — Perkeep (2013). https://perkeep.org/doc/overview · https://github.com/perkeep/perkeep/blob/master/doc/terms.md. Mechanism-enforced corroborators: Haven (private nostr relay) and Anytype local-only mode, https://github.com/anyproto/any-sync.
- **The store is the scheduler** — Hayes-Roth, BB1, *Artificial Intelligence* 26:251–321 (1985). https://dl.acm.org/doi/10.1016/0004-3702(85)90063-3
- **Priority agenda with per-item budget** — Lenat, AM (1976) and EURISKO (1982). https://worrydream.com/refs/Lenat_1983_-_Why_AM_and_Eurisko_Appear_to_Work.pdf
- **Task-store-as-scheduler with ephemeral workers** — BabyAGI (2023). https://github.com/yoheinakajima/babyagi
- **Role pipelines with artifact handoff** — MetaGPT, arXiv:2308.00352 (ICLR 2024 oral) · ChatDev, arXiv:2307.07924 (ACL 2024) · Self-Collaboration, arXiv:2304.07590 (TOSEM 2024).
- **Gated spec-driven development** — Amazon Kiro, https://kiro.dev/docs/specs/ (the gate-skipping mode: https://kiro.dev/docs/specs/quick-plan/) · GitHub Spec Kit, https://github.com/github/spec-kit
- **Goal lifecycle with pluggable deliberation** — Jadex (2003), https://download.actoron.com/docs/releases/jadex-0.96x/userguide/concepts.html · Nonlin/GOST, Tate, IJCAI-77, https://www.ijcai.org/Proceedings/77-2/Papers/071.pdf
- **Task identifier plus prose brief, and the resulting drift** — Task Master, https://docs.task-master.dev/capabilities/task-structure
- **Job chaining between providers** — nostr NIP-90, https://github.com/nostr-protocol/nips/blob/master/90.md (note: the spec is now marked `unrecommended`).

### Failure-mode evidence

- **Editing your own evaluation markers** — Darwin Gödel Machine, arXiv:2505.22954 · https://sakana.ai/dgm/
- **Evaluator investment and rationalization bias** — "Context Over Content: Exposing Evaluation Faking in Automated Judges", arXiv:2604.15224 · "Faithful or Fabricated? A Causal Framework for Rationalization Bias in LLM Judges", arXiv:2605.23970
- **Blind LLM-as-judge rated HOLD** — https://rubinlake.com/en/technology-radar/developer-ai-and-delivery/blind-llm-as-judge
- **Multi-agent token amplification** — https://www.anthropic.com/engineering/multi-agent-research-system
- **In-place record rewriting to reject** — A-MEM, arXiv:2502.12110 · cognee, https://github.com/topoteretes/cognee

### Borrowings

- **Rate-bounded supervision** — Erlang/OTP, https://www.erlang.org/doc/system/sup_princ.html
- **Level-triggered reconciliation** — https://kubernetes.io/docs/concepts/architecture/controller/
- **Durable execution and determinism checks** — Temporal, https://docs.temporal.io/evaluate/understanding-temporal
- **Curator pruning between runs** — Lenat's 1983 retrospective (above); island reset in FunSearch, https://www.nature.com/articles/s41586-023-06924-6

**Verification status.** Claims about this product's own build were verified directly against the working tree on 2026-07-27. External citations were reported with sources by the researchers and the load-bearing ones appear in more than one lineage. Individual URLs were not re-opened one by one for this document. Check any citation before quoting it in outward-facing material, and re-run the sweep rather than trusting this file past roughly six months.
