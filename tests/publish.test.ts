import { describe, expect, test } from "bun:test";
import {
  HtmlarkError,
  MemoryProjectArtifactRegistry,
  MemoryPublisher,
  MemoryRepository,
  publishArtifact,
  putArtifact,
  unpublishArtifact,
} from "@htmlark/core";
import { createPublishApp } from "@htmlark/http";

describe("publishArtifact", () => {
  test("publishes clean head and unpublishes", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    const publisher = new MemoryPublisher("https://a.htmlark.com");
    const created = await putArtifact(repo, registry, {
      content: "<p style='color:var(--htmlark-fg)'>ok</p>",
      type: "html",
      name: "n",
    });
    const artifact = created["artifact"];
    if (!artifact || typeof artifact !== "object" || !("id" in artifact)) throw new Error("missing id");
    const id = String(artifact.id);
    const pub = await publishArtifact(repo, publisher, { id, followLatest: true });
    expect(pub["url"]).toBe(`https://a.htmlark.com/a/${id}`);
    const app = createPublishApp({
      store: {
        put: async (r) => {
          await publisher.publish(r);
        },
        get: async (rid) => publisher.rows.get(rid) ?? null,
        delete: async (rid) => publisher.unpublish(rid),
      },
      token: "tok",
      origin: "https://a.htmlark.com",
    });
    const page = await app.request(`https://a.htmlark.com/a/${id}`);
    expect(page.status).toBe(200);
    await unpublishArtifact(publisher, id);
    const gone = await app.request(`https://a.htmlark.com/a/${id}`);
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
});
