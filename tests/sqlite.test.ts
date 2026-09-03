import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { HtmlarkError, MemoryProjectArtifactRegistry, putArtifact } from "@htmlark/core";
import { SqliteCasRepository } from "../apps/cli/src/adapters/sqlite-cas.ts";

describe("SqliteCasRepository", () => {
  test("concurrent append one CONFLICT", async () => {
    const home = mkdtempSync(join(tmpdir(), "htmlark-"));
    const repo = new SqliteCasRepository(home);
    const registry = new MemoryProjectArtifactRegistry();
    const first = await putArtifact(repo, registry, {
      content: "<p style='color:var(--htmlark-fg)'>one</p>",
      type: "html",
      name: "n",
    });
    const artifact = first["artifact"];
    if (!artifact || typeof artifact !== "object" || !("id" in artifact)) throw new Error("missing id");
    const id = String(artifact.id);
    const results = await Promise.allSettled([
      putArtifact(repo, registry, {
        id,
        content: "<p style='color:var(--htmlark-fg)'>two</p>",
        type: "html",
        name: "n",
        baseVersion: 1,
      }),
      putArtifact(repo, registry, {
        id,
        content: "<p style='color:var(--htmlark-fg)'>three</p>",
        type: "html",
        name: "n",
        baseVersion: 1,
      }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const conflict = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof HtmlarkError && r.reason.code === "CONFLICT",
    ).length;
    expect(ok).toBe(1);
    expect(conflict).toBe(1);
  });
});
