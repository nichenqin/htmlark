# htmlark

Local-first runtime for AI-generated HTML/Markdown artifacts.

Site: **[htmlark.com](https://htmlark.com)**. Public pages: **[a.htmlark.com](https://a.htmlark.com)**.

## Install

Node 22.13+:

```bash
npx htmlark
npx htmlark setup --json
```

Or download a binary from [GitHub Releases](https://github.com/nichenqin/htmlark/releases/latest) and put it on your `PATH`.

```bash
# macOS Apple silicon
curl -L https://github.com/nichenqin/htmlark/releases/latest/download/htmlark-darwin-arm64 -o htmlark
chmod +x htmlark
```

## Use

```bash
htmlark put --file ./page.html --key demo --json
htmlark open --id art_…
htmlark publish --id art_… --json
```

Store: `$HTMLARK_HOME` or `~/.htmlark`. Not NFS / iCloud / Dropbox.

## Agent contract

Always `--json` and `--key`. No CDN. On `code=CONFLICT`, get, re-apply, retry with `--base-version`. Do not `--force`. Do not share loopback URLs. Public share is `htmlark publish`.

Skill: `htmlark setup` writes `htmlark-authoring`. MCP: `htmlark mcp`.

## Security

Loopback Host allowlist, JSON + `X-Htmlark-Token` on mutations, no CORS. `/render` is CSP-sandboxed. Dirty versions 409.

## Layout

- `packages/core` commands + ports
- `packages/runtime` wrap / CSP / inspect
- `packages/http` `createLocalApp` / `createPublishApp`
- `apps/cli` citty, sqlite+CAS, MCP
- `apps/remote` Cloudflare Worker D1+R2
- `schema/commands.json` CLI catalog

See [PRD.md](./PRD.md).
