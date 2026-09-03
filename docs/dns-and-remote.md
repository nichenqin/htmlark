# htmlark.com DNS and v1 Worker landing

Canonical marketing origin: **`https://htmlark.com`**. Public artifacts: **`https://a.htmlark.com`**. Loopback `127.0.0.1:7420` is never a public DNS target.

Zone `htmlark.com` is active on Cloudflare. NS: `gloria.ns.cloudflare.com` / `jeff.ns.cloudflare.com`.

| Host | Role |
| --- | --- |
| `htmlark.com` | Astro marketing site (`htmlark-website`) |
| `www.htmlark.com` | same |
| `a.htmlark.com` | publish Worker: D1 index, R2 bytes, `GET /a /render /vendor` |

`htmlark remote init` writes `remotes.json` (token 0600) and `$HTMLARK_HOME/remote/schema.sql`. Publish token is `PUBLISH_TOKEN` on the Worker. No list on the public host.

Do not add A/AAAA to a home IP or `127.0.0.1`.
