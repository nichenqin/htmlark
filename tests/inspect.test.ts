import { describe, expect, test } from "bun:test";
import { inspectArtifact } from "@htmlark/runtime";

describe("inspectArtifact", () => {
  test("rejects CDN", () => {
    const r = inspectArtifact({
      type: "html",
      content: `<script src="https://unpkg.com/foo@1.0.0/foo.js"></script>`,
    });
    expect(r.rejected).toBe(true);
    expect(r.errors.some((e) => e.includes("cdn") || e.includes("external"))).toBe(true);
  });

  test("accepts vendor pin", () => {
    const r = inspectArtifact({
      type: "html",
      content: `<script src="/vendor/echarts@5.5.0/echarts.min.js"></script><div style="color:var(--htmlark-fg)"></div>`,
    });
    expect(r.rejected).toBe(false);
    expect(r.vendorSpecs).toContain("echarts@5.5.0/echarts.min.js");
  });
});
