# htmlark.com DNS and v1 Worker landing

Canonical origin: **`https://htmlark.com`**. Local loopback (`127.0.0.1:7420`) is never a public DNS target.

## Now (park, do not publish)

1. Point the registrar nameservers at Cloudflare (zone `htmlark.com`).
2. Do **not** create A/AAAA to a home IP or `127.0.0.1`.
3. Optional parking only:
   - Apex `htmlark.com` — Cloudflare “parked” / placeholder page, or no records until the Worker exists.
   - `www` — CNAME flattening to apex, or omit.
4. Enable Cloudflare proxy (orange cloud) only when a Worker or Pages route exists.

## v1 (unidirectional publish)

Local sqlite+CAS stays the source of truth. The Worker is `ArtifactPublisher` (D1 index + R2 bytes), not a second repository.

| Host | Role |
| --- | --- |
| `htmlark.com` | marketing / docs later; not the artifact origin in MVP |
| `a.htmlark.com` | Worker: public `GET /a/:id`, `GET /render/:id/:version`, `GET /vendor/:spec` |
| *(no LAN, no list on the public host)* | mutations stay local CLI / future `htmlark publish` |

Cloudflare pieces when implementing PR-15–16:

- Worker route: `a.htmlark.com/*`
- D1: metadata / versions / hash pointers (no 5MB HTML in D1)
- R2: artifact bytes + vendor bytes
- Custom domain on the Worker: `a.htmlark.com`
- TLS: Cloudflare-managed

`htmlark remote init` should print this origin, not `htmlark.dev`.

## Do not

- Dual-brand `htmlark.dev` / `.app` in schemas or skill.
- Put `https://htmlark.com` into recipe `$schema` until that URL actually serves the JSON Schema.
- npm publish just because the domain exists.
