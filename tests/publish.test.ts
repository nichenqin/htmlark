import { describe, expect, test } from "bun:test";
import {
  HtmlarkError,
  MemoryProjectArtifactRegistry,
  MemoryPublisher,
  MemoryRepository,
  publishArtifact,
  putArtifact,
  sha256Hex,
  unpublishArtifact,
} from "@htmlark/core";
import { createPublishApp, MemoryPublishStore } from "@htmlark/http";
import type { ArtifactPublisher } from "@htmlark/core";

function publisherFor(store: MemoryPublishStore, origin: string): ArtifactPublisher {
  return {
    async publish(snapshot) {
      await store.put({
        meta: {
          id: snapshot.id,
          name: snapshot.name,
          type: snapshot.type,
          headVersion: snapshot.version,
          followLatest: snapshot.followLatest,
          sourcePublic: snapshot.sourcePublic,
          passwordHash: snapshot.passwordHash,
          dirty: snapshot.dirty,
          vendorSpecs: snapshot.vendorSpecs,
        },
        version: {
          version: snapshot.version,
          name: snapshot.name,
          type: snapshot.type,
          content: snapshot.content,
          dirty: snapshot.dirty,
        },
        vendors: snapshot.vendors,
      });
      return { id: snapshot.id, url: `${origin}/a/${snapshot.id}` };
    },
    async unpublish(id) {
      const meta = await store.getMeta(id);
      if (!meta) throw new HtmlarkError("NOT_FOUND", "not published", { id });
      await store.delete(id);
    },
  };
}

describe("J4 publish", () => {
  test("one command URL then unpublish 404", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    const store = new MemoryPublishStore();
    const origin = "https://a.htmlark.com";
    const publisher = publisherFor(store, origin);
    const created = await putArtifact(repo, registry, {
      content: "<p style='color:var(--htmlark-fg)'>ok</p>",
      type: "html",
      name: "n",
    });
    const artifact = created["artifact"];
    if (!artifact || typeof artifact !== "object" || !("id" in artifact)) throw new Error("missing id");
    const id = String(artifact.id);
    const pub = await publishArtifact(repo, publisher, { id, followLatest: true });
    expect(pub["url"]).toBe(`${origin}/a/${id}`);
    const app = createPublishApp({ store, token: "tok", origin });
    const page = await app.request(`${origin}/a/${id}`);
    expect(page.status).toBe(200);
    await unpublishArtifact(publisher, id);
    const gone = await app.request(`${origin}/a/${id}`);
    expect(gone.status).toBe(404);
  });

  test("refuses dirty", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    const publisher = new MemoryPublisher("https://a.htmlark.com");
    const created = await putArtifact(repo, registry, {
      content: `<script src="https://unpkg.com/x"></script>`,
      type: "html",
      name: "n",
      force: true,
    });
    const artifact = created["artifact"];
    if (!artifact || typeof artifact !== "object" || !("id" in artifact)) throw new Error("missing id");
    await expect(publishArtifact(repo, publisher, { id: String(artifact.id) })).rejects.toBeInstanceOf(HtmlarkError);
  });

  test("password lock and source private", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    const store = new MemoryPublishStore();
    const origin = "https://a.htmlark.com";
    const publisher = publisherFor(store, origin);
    const created = await putArtifact(repo, registry, {
      content: "<p style='color:var(--htmlark-fg)'>secret</p>",
      type: "html",
      name: "n",
    });
    const artifact = created["artifact"];
    if (!artifact || typeof artifact !== "object" || !("id" in artifact)) throw new Error("missing id");
    const id = String(artifact.id);
    const passwordHash = await sha256Hex("s3cret");
    await publishArtifact(repo, publisher, { id, passwordHash, sourcePublic: false });
    const app = createPublishApp({ store, token: "tok", origin });
    const locked = await app.request(`${origin}/a/${id}`);
    expect(locked.status).toBe(401);
    const unlock = await app.request(`${origin}/a/${id}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "s3cret" }),
    });
    expect(unlock.status).toBe(302);
    const cookie = unlock.headers.get("set-cookie") ?? "";
    const open = await app.request(`${origin}/a/${id}`, { headers: { cookie } });
    expect(open.status).toBe(200);
    const raw = await app.request(`${origin}/v1/artifacts/${id}/versions/1/raw`, { headers: { cookie } });
    expect(raw.status).toBe(403);
  });
});
