import { describe, expect, test } from "bun:test";
import { RecipeV0Schema } from "@htmlark/core";

describe("RecipeV0Schema", () => {
  test("accepts v0 recipe", () => {
    const parsed = RecipeV0Schema.parse({
      $schema: "./schema/recipe-v0.json",
      schemaVersion: 0,
      title: "Q3 Sales Report",
      format: "html",
      tokens: "default",
      quality: "strict",
    });
    expect(parsed.schemaVersion).toBe(0);
  });

  test("rejects fragments", () => {
    const r = RecipeV0Schema.safeParse({
      schemaVersion: 0,
      title: "x",
      format: "html",
      fragments: [],
    });
    expect(r.success).toBe(false);
  });
});
