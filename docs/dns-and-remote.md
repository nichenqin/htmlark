# htmlark.com DNS and v1 Worker landing

Canonical origin: **`https://htmlark.com`**. Local loopback (`127.0.0.1:7420`) is never a public DNS target.

## Now (parked)

Zone `htmlark.com` is **active** on Cloudflare (account `c7aabbf4ff9f13a34351cb7cf2d015d1`). NS: `gloria.ns.cloudflare.com` / `jeff.ns.cloudflare.com`.

Apex and `www` serve parking Worker `htmlark-park` (`apps/park`) on Cloudflare anycast. No home IP. No loopback. `https://htmlark.com/` is a noindex placeholder.

Do **not** add A/AAAA to a home IP or `127.0.0.1`.

## v1 (unidirectional publish)

Local sqlite+CAS stays the source of truth. The Worker is `ArtifactPublisher` (D1 index + R2 bytes), not a second repository.

| Host | Role |
| --- | --- |
| `htmlark.com` | marketing / docs later; parking page today |
| `a.htmlark.com` | future Worker: public `GET /a/:id`, `/render`, `/vendor` |
| *(no LAN, no public list)* | mutations stay local CLI / future `htmlark publish` |

When implementing PR-15–16: Worker custom domain `a.htmlark.com`, D1 for index, R2 for bytes. `htmlark remote init` should print `https://a.htmlark.com`, not `htmlark.dev`.

## Do not

- Dual-brand `htmlark.dev` / `.app` in schemas or skill.
- Put `https://htmlark.com` into recipe `$schema` until that URL actually serves the JSON Schema.
- npm publish just because the domain exists.
