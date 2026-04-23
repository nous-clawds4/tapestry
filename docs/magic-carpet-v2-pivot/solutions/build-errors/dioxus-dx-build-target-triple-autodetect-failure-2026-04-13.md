---
title: "Dioxus dx build fails with 'Could not automatically detect target triple' when multiple renderer features present"
date: 2026-04-13
category: build-errors
module: carpet-ui
problem_type: build_error
component: tooling
severity: high
symptoms:
  - "dx build fails with 'Could not automatically detect target triple'"
  - "dx build fails with 'Could not automatically detect bundle format'"
  - "dx build panics at workspace.rs:325 when run from crate subdirectory"
root_cause: config_error
resolution_type: code_fix
tags:
  - dioxus
  - dx-build
  - platform-detection
  - cargo-features
  - fullstack
  - docker
  - target-triple
  - bundle-format
---

# Dioxus dx build fails with "Could not automatically detect target triple" when multiple renderer features present

## Problem

`dx build -p carpet-ui --release` fails during Docker image build with "Could not automatically detect target triple" because the crate declares multiple non-server renderer features (`web` and `desktop`), and dioxus-cli 0.7.5's auto-detection algorithm requires exactly one.

## Symptoms

- `dx build` inside Docker buildx fails with:
  ```
  ERROR dx build: Could not automatically detect target triple
  ```
- Earlier flag combinations produced a different error:
  ```
  ERROR dx build: Could not automatically detect bundle format
  ```
- Running `dx build` from a workspace member subdirectory (`WORKDIR /app/crates/carpet-ui`) causes a panic:
  ```
  panicked at workspace.rs:325: called `Result::unwrap()` on an `Err` value:
  Os { code: 2, kind: NotFound, message: "No such file or directory" }
  ```

## What Didn't Work

Seven approaches were tried across five sessions before the root cause was found by reading the dioxus-cli source code:

1. **WORKDIR to crate directory, drop `-p` flag** (session history): Set `WORKDIR /app/crates/carpet-ui` and ran `dx build --release`. dx panicked at `workspace.rs:325` — running dx from inside a workspace member subdirectory is broken.

2. **Remove `--target` flag** (still in crate dir): Same `workspace.rs:325` panic. The panic was caused by the WORKDIR location, not `--target`.

3. **Copy `Dioxus.toml` to workspace root, use `-p` from `/app`**: Changed the error to "Could not automatically detect target triple" — progress. Bundle format was now detected from the copied `Dioxus.toml`, but triple detection still failed.

4. **Copy `Dioxus.toml` + explicit `--target x86_64-unknown-linux-gnu`**: Regressed to "Could not automatically detect bundle format". The `--target` flag breaks bundle format detection even when `Dioxus.toml` is present — it overrides the detection pipeline in clap parsing.

5. **`--fullstack` flag + `@server --target`**: "Could not automatically detect target triple". `--fullstack` fixed bundle format but `@server --target` does not propagate to the top-level triple resolution.

6. **`--fullstack --target` at top level**: "Could not automatically detect bundle format". The `--target` flag at the top level overrides `--fullstack` — these two flags are mutually destructive.

7. **Cargo config `[build] target` in `.cargo/config.toml`**: "Could not automatically detect target triple". dx does not read Cargo's build config for its own platform detection.

## Solution

Remove the unused `desktop` feature from `crates/carpet-ui/Cargo.toml`.

**Before:**
```toml
[features]
default = []
web = ["dioxus/web"]
server = ["dioxus/server", "dep:axum", "dep:tokio", "dep:nostr-lib", "dep:phoenixd-lib"]
desktop = ["dioxus/desktop"]
```

**After:**
```toml
[features]
default = []
web = ["dioxus/web"]
server = ["dioxus/server", "dep:axum", "dep:tokio", "dep:nostr-lib", "dep:phoenixd-lib"]
```

**Dockerfile** simplified to a plain build command with no workarounds:
```dockerfile
RUN dx build -p carpet-ui --release
```

## Why This Works

The dx CLI 0.7.5 platform auto-detection in `request.rs:633-833` follows this sequence:

1. **`renderer_enabled_by_dioxus_dependency()`** checks the dioxus dependency's feature list. Both `"fullstack"` and `"router"` return `None` from `autodetect_from_cargo_feature()` (it only recognizes: `web`, `desktop`, `mobile`, `native`, `liveview`, `server`). Since no single renderer is found, returns `None`.

2. **`enabled_cargo_toml_default_features_renderers()`** checks `default = []` — empty, returns empty vec.

3. **`features_that_enable_renderers()`** iterates all `[features]` keys. Maps: `web` -> `Web`, `server` -> `Server`, `desktop` -> `Webview`. Returns 3 entries.

4. **Fallback logic** filters out server-type features, then checks `non_server_features.len() == 1`. With both `web` and `desktop`, length is 2 — **fails**.

5. `platform` stays `Platform::Unknown`. The match arm for `Unknown` does nothing, so `triple` remains `None`.

6. Because `using_dioxus_explicitly == true`, the code hits:
   ```rust
   triple.context("Could not automatically detect target triple")?
   ```
   and errors out.

After removing `desktop`, step 3 finds only `web` and `server`. Step 4 filters to one non-server feature (`web`), sets `platform = Platform::Web`, which resolves `triple` to `wasm32-unknown-unknown` for the client and `Triple::host()` for the server in fullstack mode.

### Additional dx bugs discovered

- **`--target` breaks `--fullstack`**: The `--target` flag at the top level of `dx build` silently overrides `--fullstack`'s bundle format setting in clap argument parsing. These flags cannot be used together.
- **`autodetect_from_cargo_feature("fullstack")` returns `None`**: The `"fullstack"` dioxus feature is not recognized during auto-detection, even though it's a primary dioxus feature.
- **Workspace subdirectory panic**: Running `dx build` from a workspace member crate directory panics at `workspace.rs:325`.

## Prevention

1. **One non-server renderer per crate**: In any Dioxus 0.7 crate built with `dx build`, define exactly one non-server renderer feature (e.g., `web` OR `desktop`, not both). If you genuinely need both, use separate crates or pass `--platform` explicitly via the `@server`/`@client` subcommands.

2. **Do not combine `--target` with `--fullstack`**: These flags are mutually destructive in dioxus-cli 0.7.5. If your environment can auto-detect the host triple (i.e., not Docker buildx cross-compiling), omit `--target` entirely.

3. **Always run `dx` from the workspace root**: Use `-p <crate>` to specify the build target. Running from a workspace member subdirectory triggers a panic.

4. **Treat `fullstack` and `router` as invisible to auto-detection**: These Cargo features are not recognized by dx's feature scanner. Platform detection depends on your own `[features]` table keys, not the dioxus dependency features.

5. **Read the dx source when debugging**: The auto-detection logic in `request.rs` is undocumented. When `dx build` fails with vague target/bundle errors, the source at `~/.cargo/registry/src/*/dioxus-cli-*/src/build/request.rs` is the only reliable reference.

## Related Issues

- [DioxusLabs/dioxus#3867](https://github.com/DioxusLabs/dioxus/issues/3867) — Closely related: `desktop` feature in Cargo.toml confuses dx's platform auto-detection
- [DioxusLabs/dioxus#3916](https://github.com/DioxusLabs/dioxus/issues/3916) — Docker + fullstack dx build issues (different root cause: read-only filesystem)
- [DioxusLabs/dioxus#3594](https://github.com/DioxusLabs/dioxus/issues/3594) — `--target` not forwarded to cargo for server builds
