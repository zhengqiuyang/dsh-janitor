# dsh-janitor

> **If this helps you, please give it a star** — it helps others find it. Thanks!

Deterministic artifact lifecycle for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

Agent sessions leave debris: plan docs from finished tasks, scratch scripts,
one-off fixtures. People fear agent-driven cleanup precisely because cleanup
driven by an agent is unaccountable. This plugin registers a `janitor_scan`
tool that runs the [agent-janitor](https://github.com/zhengqiuyang/agent-janitor)
engine over the workspace and returns a **reviewable cleanup plan** — every
candidate file with a deterministic verdict (protected / keep / recent /
needs-review / safe-to-remove) and the evidence behind it.

**The janitor is never an agent.** The scan and verdicts are pure
deterministic rules (reference analysis, git metadata, age thresholds); v0.1
never deletes anything — applying a reviewed plan stays with the upstream CLI
or with you, on purpose.

Family: read-guard (what agents read) · pr-gate (what they write) · attest
(what they did) · mcp-test (what they can call) · **janitor (what they leave
behind)**.

## Why now (checked 2026-10-12)

Nothing in the dsh ecosystem does deterministic workspace hygiene. The
`@goodandready/dsh-time-machine` plugin does checkpoints and rollback
(snapshot safety), which is complementary: it answers "can I undo?", this
answers "what is safe to remove?". Deterministic scan → reviewable plan →
apply as a three-step, non-agent pipeline is unowned.

## Verdicts (fixed order, first match wins)

| verdict | meaning |
|---|---|
| `protected` | exact file or directory prefix in the protected list |
| `keep` | referenced by any code file |
| `recent` | younger than `minAgeDays` (git commit time preferred) |
| `needs-review` | referenced by docs/other, or otherwise ambiguous |
| `safe-to-remove` | plan doc with task merged & zero refs, or zero refs + old enough |

## Install

```sh
dsh plugin --profile default add dsh-janitor
```

From npm — no build step, no `allowBuilds` authorization; git installs are equally prebuilt (`lib/` ships in the repo).



## Configure

```yaml
- id: dsh-janitor
  name: dsh-janitor
  config:
    minAgeDays: 14
    protectedPaths: ["plans", "docs/decisions"]   # exact file or directory prefix
```

## Compatibility

- **DSH**: verified against the 0.2.x line (source snapshot 0.2.1-alpha.2); installs on any profile via `dsh plugin add` (prebuilt `lib/`, no build approval).
- **Node**: >= 20 (CI matrix: Node 20/22/24 on Ubuntu and Windows).
- **Disposable-profile evidence (2026-10-19)**: `dsh plugin --profile <fresh> add github:zhengqiuyang/dsh-janitor` → installed in 30s; boot shows `[dsh-janitor] active: …`; `dsh plugin --profile <fresh> remove dsh-janitor` → dependencies cleared, bundles restored.

## Develop

```sh
npm install
npm test   # syncs the vendored agent-janitor engine, builds, runs fixture tests
```

The scan/verdict engine is vendored from the sibling `agent-janitor`
checkout (`npm run sync`; CI runs `sync --check`).

## Roadmap

- `janitor_apply` with an explicit per-path confirmation protocol (still
  deterministic — no agent judgment in the loop)
- Session-debris presets (`.dsh-*` ledgers, scratch plugins dirs)
- Plan archive integration with the upstream CLI's `apply`

## Kill criteria

If dsh ships first-party workspace hygiene, or time-machine-style plugins
add deterministic removal planning, this freezes at its last working version
with a postmortem here. The engine stays owned by agent-janitor either way.
