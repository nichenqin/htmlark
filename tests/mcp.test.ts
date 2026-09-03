import { describe, expect, test } from "bun:test";
import { MemoryProjectArtifactRegistry, MemoryRepository } from "@htmlark/core";
import { encodeMcp, handleMcpMessage } from "../apps/cli/src/mcp.ts";

describe("mcp", () => {
  test("initialize and tools/list", async () => {
    const ctx = {
      repo: new MemoryRepository(),
      registry: new MemoryProjectArtifactRegistry(),
      projectRoot: "/tmp",
    };
    const init = await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize" }, ctx);
    expect(init && typeof init === "object" && "serverInfo" in init).toBe(true);
    const listed = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ctx);
    if (!listed || typeof listed !== "object" || !("tools" in listed) || !Array.isArray(listed.tools)) {
      throw new Error("tools missing");
    }
    expect(listed.tools.some((t) => typeof t === "object" && t && "name" in t && t.name === "htmlark_put")).toBe(true);
  });

  test("Content-Length framing", () => {
    const bytes = encodeMcp({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    const text = Buffer.from(bytes).toString("utf8");
    expect(text.startsWith("Content-Length:")).toBe(true);
    expect(text.includes("\r\n\r\n")).toBe(true);
  });
});
