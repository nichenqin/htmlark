import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { HtmlarkError } from "@htmlark/core";
import { isBlockedIp, prefetchVendor, vendorGet } from "../apps/cli/src/adapters/vendor-cache.ts";

describe("vendor SSRF", () => {
  test("blocks private and metadata IPs", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
  });

  test("rejects loopback lookup", async () => {
    const home = mkdtempSync(join(tmpdir(), "htmlark-vendor-"));
    await expect(
      prefetchVendor(home, "echarts@5.5.0/echarts.min.js", {
        lookup: async () => ["127.0.0.1"],
        fetch: async () => new Response("ok", { headers: { "content-type": "application/javascript" } }),
      }),
    ).rejects.toBeInstanceOf(HtmlarkError);
  });

  test("rejects HTML content-type", async () => {
    const home = mkdtempSync(join(tmpdir(), "htmlark-vendor-"));
    await expect(
      prefetchVendor(home, "echarts@5.5.0/echarts.min.js", {
        lookup: async () => ["1.1.1.1"],
        fetch: async () => new Response("<html></html>", { headers: { "content-type": "text/html" } }),
      }),
    ).rejects.toBeInstanceOf(HtmlarkError);
  });

  test("uncached spec is missing", () => {
    const home = mkdtempSync(join(tmpdir(), "htmlark-vendor-"));
    expect(vendorGet(home, "echarts@5.5.0/echarts.min.js")).toBeNull();
  });

  test("writes javascript cache", async () => {
    const home = mkdtempSync(join(tmpdir(), "htmlark-vendor-"));
    await prefetchVendor(home, "echarts@5.5.0/echarts.min.js", {
      lookup: async () => ["1.1.1.1"],
      fetch: async () => new Response("console.log(1)", { headers: { "content-type": "application/javascript" } }),
    });
    expect(vendorGet(home, "echarts@5.5.0/echarts.min.js")).not.toBeNull();
  });
});
