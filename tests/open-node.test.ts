import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";

const root = join(import.meta.dir, "..");

describe("node open", () => {
  test("CLI source does not call Bun", () => {
    const src = readFileSync(join(root, "apps/cli/src/main.ts"), "utf8") + readFileSync(join(root, "apps/cli/src/serve.ts"), "utf8");
    expect(src.includes("Bun.")).toBe(false);
    expect(/import\.meta\.dir(?!name)/.test(src)).toBe(false);
  });

  test("workspace package name does not shadow npx htmlark", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name: string };
    expect(pkg.name).not.toBe("htmlark");
  });

  test("node bundle open does not throw Bun is not defined", () => {
    const dir = mkdtempSync(join(tmpdir(), "htmlark-open-"));
    const bundle = join(dir, "htmlark.mjs");
    const build = spawnSync("bun", ["build", join(root, "apps/cli/src/main.ts"), "--target", "node", "--outfile", bundle], {
      cwd: root,
      encoding: "utf8",
    });
    expect(build.status).toBe(0);
    const home = join(dir, "home");
    const page = join(dir, "page.html");
    writeFileSync(page, "<p>open</p>\n");
    const env = { ...process.env, HTMLARK_HOME: home, HTMLARK_PORT: "17421" };
    const put = spawnSync("node", [bundle, "put", "--file", page, "--key", "open-smoke", "--json"], { env, encoding: "utf8" });
    if (put.status !== 0) throw new Error(`put failed ${put.status} stdout=${put.stdout} stderr=${put.stderr} err=${put.error}`);
    expect(put.status).toBe(0);
    const body = JSON.parse(put.stdout) as { artifact: { id: string } };
    const open = spawnSync("node", [bundle, "open", "--id", body.artifact.id], { env, encoding: "utf8" });
    expect(open.stderr).not.toContain("Bun is not defined");
    expect(open.status).toBe(0);
    expect(open.stdout).toContain(`/a/${body.artifact.id}`);
  });
});
