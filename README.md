# htmlark

Local-first runtime for AI-generated HTML/Markdown artifacts.

Canonical site: **[htmlark.com](https://htmlark.com)**. Public artifacts: **[a.htmlark.com](https://a.htmlark.com)**. Personal project, independent of Teable. CLI is the source of truth.

DNS / Worker: [docs/dns-and-remote.md](./docs/dns-and-remote.md).

## Install / run

```bash
bun install
bun test
bun run typecheck

bun apps/cli/src/main.ts setup --json
bun apps/cli/src/main.ts put --file ./page.html --key demo --json
bun apps/cli/src/main.ts serve
bun apps/cli/src/main.ts remote init --json
bun apps/cli/src/main.ts publish --id art_… --json
bun apps/cli/src/main.ts doctor --json
```

Store: `$HTMLARK_HOME` or `~/.htmlark`. Not NFS / iCloud / Dropbox.

## Agent contract

Always `--json` and `--key`. No CDN. On `code=CONFLICT`, get, re-apply, retry with `--base-version`. Do not `--force`. Do not share loopback URLs. Public share is `htmlark publish`.

## Security

Loopback Host allowlist, JSON + `X-Htmlark-Token` on mutations, no CORS. `/render` is CSP-sandboxed. Dirty versions 409. Optional publish password. `--source-private` hides authored source on the public origin.

## Layout

- `packages/core` commands + ports
- `packages/runtime` wrap / CSP / inspect
- `packages/http` `createLocalApp` / `createPublishApp`
- `apps/cli` citty, sqlite+CAS, MCP
- `apps/remote` Cloudflare Worker D1+R2
- `apps/web` Svelte gallery
- `schema/commands.json` CLI catalog

See [PRD.md](./PRD.md).
