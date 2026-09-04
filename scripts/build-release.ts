import { chmodSync, copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HTMLARK_VERSION } from "../apps/cli/src/self.ts";

const root = join(import.meta.dir, "..");
const entry = join(root, "apps/cli/src/main.ts");
const npmDir = join(root, "dist/npm");
const binDir = join(root, "dist/bin");

mkdirSync(npmDir, { recursive: true });
mkdirSync(binDir, { recursive: true });

const web = Bun.spawnSync(["bun", "run", "build:web"], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (web.exitCode !== 0) process.exit(web.exitCode ?? 1);

const nodeOut = join(npmDir, "htmlark.mjs");
const nodeBuild = Bun.spawnSync(["bun", "build", entry, "--target", "node", "--outfile", nodeOut, "--minify"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});
if (nodeBuild.exitCode !== 0) process.exit(nodeBuild.exitCode ?? 1);
const bundled = readFileSync(nodeOut, "utf8").replace(/^(#!.*\n)+/, "");
writeFileSync(nodeOut, `#!/usr/bin/env node\n${bundled}`);
chmodSync(nodeOut, 0o755);
cpSync(join(root, "apps/web/dist"), join(npmDir, "admin"), { recursive: true });
writeFileSync(
  join(npmDir, "package.json"),
  `${JSON.stringify(
    {
      name: "htmlark",
      version: HTMLARK_VERSION,
      description:
        "Local-first library for AI agent HTML artifacts — same key on revise, sandboxed preview on your machine.",
      type: "module",
      bin: { htmlark: "htmlark.mjs" },
      engines: { node: ">=22.13.0" },
      license: "MIT",
      repository: { type: "git", url: "git+https://github.com/nichenqin/htmlark.git" },
      homepage: "https://htmlark.com",
      bugs: { url: "https://github.com/nichenqin/htmlark/issues" },
      files: ["htmlark.mjs", "admin"],
      publishConfig: { access: "public" },
      keywords: [
        "html",
        "artifacts",
        "ai",
        "agents",
        "agent",
        "local-first",
        "cli",
        "mcp",
        "sandbox",
        "preview",
        "markdown",
      ],
    },
    null,
    2,
  )}\n`,
);
copyFileSync(join(root, "LICENSE"), join(npmDir, "LICENSE"));
copyFileSync(join(root, "README.md"), join(npmDir, "README.md"));

const targets = [
  ["bun-darwin-arm64", "htmlark-darwin-arm64"],
  ["bun-darwin-x64", "htmlark-darwin-x64"],
  ["bun-linux-x64", "htmlark-linux-x64"],
  ["bun-linux-arm64", "htmlark-linux-arm64"],
  ["bun-windows-x64", "htmlark-windows-x64.exe"],
] as const;

const only = process.argv.includes("--npm-only");
if (!only) {
  for (const [target, name] of targets) {
    const proc = Bun.spawnSync(
      ["bun", "build", "--compile", `--target=${target}`, `--outfile=${join(binDir, name)}`, entry],
      { cwd: root, stdout: "inherit", stderr: "inherit" },
    );
    if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1);
  }
}

process.stdout.write(`built htmlark ${HTMLARK_VERSION}\n`);
