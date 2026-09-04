import { describe, expect, test } from "bun:test";
import { HtmlarkError, MemoryProjectArtifactRegistry, MemoryRepository, deleteArtifact, putArtifact, restoreArtifact } from "@htmlark/core";

describe("putArtifact", () => {
  test("create then update same key", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    const first = await putArtifact(repo, registry, {
      key: "q3-sales",
      content: "<!doctype html><title>a</title><div class='x' style='color:var(--htmlark-fg)'></div>",
      name: "Q3",
      type: "html",
      projectRoot: "/tmp/p",
    });
    const id = (first["artifact"] as { id: string }).id;
    const second = await putArtifact(repo, registry, {
      key: "q3-sales",
      content: "<!doctype html><title>b</title><div class='x' style='color:var(--htmlark-fg)'></div>",
      name: "Q3",
      type: "html",
      projectRoot: "/tmp/p",
    });
    expect((second["artifact"] as { id: string; version: number }).id).toBe(id);
    expect((second["artifact"] as { version: number }).version).toBe(2);
  });

  test("rejects CDN without force", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    await expect(
      putArtifact(repo, registry, {
        content: `<script src="https://cdn.jsdelivr.net/npm/x"></script>`,
        type: "html",
      }),
    ).rejects.toBeInstanceOf(HtmlarkError);
  });

  test("restore appends", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    const first = await putArtifact(repo, registry, {
      content: "<p style='color:var(--htmlark-fg)'>one</p>",
      type: "html",
      name: "n",
    });
    const id = (first["artifact"] as { id: string }).id;
    await putArtifact(repo, registry, {
      id,
      content: "<p style='color:var(--htmlark-fg)'>two</p>",
      type: "html",
      name: "n",
    });
    const restored = await restoreArtifact(repo, { id, version: 1 });
    expect((restored["artifact"] as { version: number }).version).toBe(3);
  });

  test("delete hides artifact", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    const first = await putArtifact(repo, registry, {
      content: "<p style='color:var(--htmlark-fg)'>one</p>",
      type: "html",
      name: "n",
    });
    const id = (first["artifact"] as { id: string }).id;
    await deleteArtifact(repo, id);
    await expect(repo.getArtifact(id)).rejects.toBeInstanceOf(HtmlarkError);
  });
});
