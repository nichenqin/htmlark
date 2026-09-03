# htmlark

Local-first runtime for AI-generated HTML/Markdown artifacts.

Personal project, independent of Teable. CLI is the source of truth; loopback web is a viewer; cloud is a later remote.

## Install / run

```bash
bun install
bun test
bun run typecheck

bun apps/cli/src/main.ts setup --json
bun apps/cli/src/main.ts put --file ./page.html --key demo --json
bun apps/cli/src/main.ts serve          # 127.0.0.1:7420
bun apps/cli/src/main.ts open --id art_…
bun apps/cli/src/main.ts doctor --json
```

Store: `$HTMLARK_HOME` or `~/.htmlark` (sqlite + CAS blobs). Not NFS / iCloud / Dropbox.

## Agent contract

Always `--json` and `--key`. No CDN: pin `/vendor/pkg@x.y.z/file.js`. On `code=CONFLICT`, get, re-apply, retry with `--base-version`. Do not `--force`. Do not share loopback URLs.

Skill: `skills/htmlark-authoring/SKILL.md` (also copied by `htmlark setup`).

MCP: `bun apps/cli/src/main.ts mcp` (stdio, no `force`).

## Security model

Loopback is not "you own the machine". Host allowlist, JSON + `X-Htmlark-Token` on mutations, no CORS. `/render` is CSP-sandboxed. Dirty versions 409 on `/render` and are not executed.

## Non-goals (MVP)

Desktop, cloud publish, LAN, visual diff, URL import, FTS, SaaS MCP.

## Layout

- `packages/core` — commands + ports
- `packages/runtime` — wrap / CSP / inspect (Worker-safe)
- `packages/http` — `createLocalApp`
- `apps/cli` — citty, sqlite+CAS, vendor prefetch, MCP
- `apps/web` — Svelte 5 gallery
- `schema/recipe-v0.json`

See [PRD.md](./PRD.md).
