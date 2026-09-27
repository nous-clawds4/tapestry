> **Implementation note, not a NIP.** Tasks, schedules and run records live with the Assistant. None of it is published or goes into the Treasure Map.
> **Builds on:** [Treasure Maps](../protocols/drafts/treasure-maps.md) § 9 (the to-do list), [Spawning](../protocols/drafts/spawning.md) (spawners, gates, lifecycle), [Pins](../protocols/drafts/pins.md) § 6 (effective sets).
> **Mock:** Assistant Management page in `Brainstorm Setup Flow v3.dc.html`.

# Assistant Tasks — design note

## 1. What a task is

A **task** is one unit of work an Assistant performs for one observer. Normally that means computing and publishing one insight: the Assistant's duty for one exact key.

- **Where tasks come from.** For each exact key in the observer's universe, the Assistant is on duty if it is listed on the winning Treasure Map entry, as Preferred, Alternate or only provider. The universe is the supported sets expanded into spawn keys, plus the exact keys in the Map.
- **Identity.** A task's identity is its key. The same key always means the same task, so run history survives schedule changes.
- **Recomputation.** The task list is recomputed whenever the Map or a supported set changes. Tasks that disappear are handed to the retraction stage.

## 2. Stages

| Stage | Tasks | Depends on | Default schedule |
|---|---|---|---|
| 1 · Supported sets | the four supported-set lists (Spawning § 3.3) | nothing (the root rule) | when pinnings change, and before any other stage |
| 2 · Trust | native Scores on Supported Scores (`30382:rank`, …) | Supported Scores | every 6 hours |
| 3 · Trusted Lists | every spawned list (Tag-, Pin- and DList-based) | its supported set, trust | when inputs change (taggings, items, reactions) |
| 4 · Scores | the Score family of each list (`…:<metric>`) | its list, trust | daily |
| 5 · Concepts | curated copies (`39998:<d>`) | Supported Concepts, trust | daily |
| 6 · Retractions | lists that fell out of scope | stage 3 | hourly |

- Stages order the work; they are not batches. Any single task can run on its own.
- "Run its dependencies first" runs stages 1–2 (and, for a Score task, its list) before the task.

## 3. Triggers

- **Interval** — every 15 min, hourly, every 6 h, daily.
- **When inputs change** — the Assistant subscribes to the task's inputs and debounces. Inputs include `#z` on the category, taggings of the descriptor, and pinnings on the Pin.
- **Manual only.**
- A schedule is set per stage, with optional per-task overrides later.

## 4. A run record

| Field | Meaning |
|---|---|
| `at`, `duration` | when it ran, and for how long |
| `status` | `ok`, `warning` (published, with a problem such as a slow relay), `failed` (nothing published), or `dry run` |
| `members` | size of the result |
| `added`, `removed` | change since the previous run |
| `event id`, `relay` | what was published, and where |
| `method` | the Trust Determination Method used: the most specific one filed under the task's key (Treasure Maps § 9.1) |
| `error` | on failure |

Keep at least the last few runs per task, so the panel can show history and differences.

## 5. Testing one step at a time

- **Dry run.** Compute the task, show the change from what's currently on relays, and publish nothing.
- **Test relay.** Publish to a separate relay instead of the observer's relays.
- **With or without dependencies.** Run just the task, or its prerequisites first.
- **Order to bring things up:**
  1. stage 1 (dry run, then live);
  2. one stage-2 Score;
  3. one exact-key list (for example Mexican restaurants in Nashville);
  4. its Score family;
  5. one scope key (every Tag of one DList);
  6. retractions.

## 6. Open questions

1. **Per-task schedule overrides:** needed, or are per-stage schedules enough?
2. **Rate limits and cost:** a scope key can expand to hundreds of tasks. Should there be a per-observer budget?
3. **Change detection:** subscribe to relay changes live, or poll on an interval?
4. **Failure policy:** retry with backoff, and after how many failures do we alert the owner?
5. **Alternates:** does an Alternate run on the same schedule, or less often, until the Preferred provider fails?
