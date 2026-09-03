import { describe, expect, test } from "bun:test";
import { COMMAND_CATALOG } from "../apps/cli/src/catalog.ts";

describe("command catalog", () => {
  test("includes publish and unpublish", () => {
    const names = COMMAND_CATALOG.map((c) => c.name);
    expect(names).toContain("put");
    expect(names).toContain("publish");
    expect(names).toContain("unpublish");
    expect(names).toContain("remote init");
    expect(names).toContain("catalog");
  });
});
