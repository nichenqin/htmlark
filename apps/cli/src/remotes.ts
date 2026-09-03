import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HtmlarkError, type ArtifactPublisher } from "@htmlark/core";
import { htmlarkHome } from "./home.ts";

export type Remote = { url: string; token: string };

type FileShape = { remotes: Record<string, Remote> };

function remotesPath(home = htmlarkHome()): string {
  return join(home, "remotes.json");
}

export function loadRemotes(home = htmlarkHome()): FileShape {
  const p = remotesPath(home);
  if (!existsSync(p)) return { remotes: {} };
  return JSON.parse(readFileSync(p, "utf8")) as FileShape;
}

export function saveRemote(name: string, remote: Remote, home = htmlarkHome()): void {
  mkdirSync(home, { recursive: true });
  const data = loadRemotes(home);
  data.remotes[name] = remote;
  writeFileSync(remotesPath(home), `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
}

export function getRemote(name: string, home = htmlarkHome()): Remote {
  const remote = loadRemotes(home).remotes[name];
  if (!remote) throw new HtmlarkError("NOT_FOUND", "remote missing", { name });
  return remote;
}

export class HttpPublisher implements ArtifactPublisher {
  constructor(private readonly remote: Remote) {}

  async publish(snapshot: Parameters<ArtifactPublisher["publish"]>[0]): Promise<{ id: string; url: string }> {
    const res = await fetch(new URL("/v1/publish", this.remote.url), {
      method: "POST",
      headers: { authorization: `Bearer ${this.remote.token}`, "content-type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    const body = (await res.json()) as { ok?: boolean; id?: string; url?: string; error?: string; code?: string };
    if (!res.ok || !body.id || !body.url) {
      throw new HtmlarkError("VALIDATION", body.error ?? "publish failed", { status: res.status, code: body.code });
    }
    return { id: body.id, url: body.url };
  }

  async unpublish(id: string): Promise<void> {
    const res = await fetch(new URL(`/v1/artifacts/${id}`, this.remote.url), {
      method: "DELETE",
      headers: { authorization: `Bearer ${this.remote.token}` },
    });
    if (res.status === 404) throw new HtmlarkError("NOT_FOUND", "not published", { id });
    if (!res.ok) throw new HtmlarkError("VALIDATION", "unpublish failed", { id, status: res.status });
  }
}

export function writeRemoteScaffold(home = htmlarkHome()): string {
  const dest = join(home, "remote");
  mkdirSync(dest, { recursive: true });
  const schemaSrc = new URL("../../remote/schema.sql", import.meta.url);
  writeFileSync(join(dest, "schema.sql"), readFileSync(schemaSrc));
  writeFileSync(
    join(dest, "README.md"),
    `# htmlark remote

From the htmlark checkout:

    wrangler d1 create htmlark-index
    wrangler d1 execute htmlark-index --file schema.sql --remote
    wrangler r2 bucket create htmlark-artifacts
    wrangler secret put PUBLISH_TOKEN
    wrangler deploy

Point remotes.json origin.url at the Worker origin (https://a.example.com).
GET /a/:id is public. POST /v1/publish requires Bearer PUBLISH_TOKEN.
`,
  );
  return dest;
}
