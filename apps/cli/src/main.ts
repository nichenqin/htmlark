#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import {
  HtmlarkError,
  PutOptsSchema,
  RecipeV0Schema,
  diffArtifacts,
  getArtifactCommand,
  importArtifact,
  listArtifacts,
  publishArtifact,
  putArtifact,
  restoreArtifact,
  sha256Hex,
  unpublishArtifact,
} from "@htmlark/core";
import { inspectArtifact } from "@htmlark/runtime";
import { prefetchFromContent, vendorGet } from "./adapters/vendor-cache.ts";
import { COMMAND_CATALOG } from "./catalog.ts";
import { openStore, printJson } from "./context.ts";
import { doctorHome } from "./doctor.ts";
import { SKILL_MD } from "./embedded.ts";
import { htmlarkHome } from "./home.ts";
import { runMcp } from "./mcp.ts";
import { HttpPublisher, getRemote, saveRemote, writeRemoteScaffold } from "./remotes.ts";
import { HTMLARK_VERSION, htmlarkSpawn } from "./self.ts";
import { ensureServer, startServer } from "./serve.ts";

function fail(err: unknown, json: boolean): never {
  if (err instanceof HtmlarkError) {
    if (json) process.stdout.write(`${JSON.stringify(err.toJSON())}\n`);
    else process.stderr.write(`${err.code}: ${err.message}\n`);
    process.exit(err.exitCode);
  }
  const message = err instanceof Error ? err.message : String(err);
  if (json) process.stdout.write(`${JSON.stringify({ ok: false, error: message, code: "INTERNAL" })}\n`);
  else process.stderr.write(`${message}\n`);
  process.exit(1);
}

function previewOf(result: Record<string, unknown>): string {
  const preview = result["preview"];
  return typeof preview === "string" ? preview : "";
}

function artifactIdOf(result: Record<string, unknown>): string {
  const artifact = result["artifact"];
  if (artifact && typeof artifact === "object" && "id" in artifact && typeof artifact.id === "string") {
    return artifact.id;
  }
  return "";
}

const put = defineCommand({
  meta: { name: "put", description: "Create or update an artifact by key" },
  args: {
    key: { type: "string", description: "logical key" },
    file: { type: "string", description: "path to html/md" },
    name: { type: "string", description: "display name" },
    type: { type: "string", description: "html|markdown" },
    id: { type: "string", description: "artifact id" },
    json: { type: "boolean", description: "JSON output", default: false },
    force: { type: "boolean", description: "store dirty on gate failure", default: false },
    "base-version": { type: "string", description: "expected head" },
  },
  async run({ args }) {
    try {
      const { home, repo, registry, projectRoot } = openStore();
      const file = args.file as string | undefined;
      if (!file) throw new HtmlarkError("VALIDATION", "--file required");
      const content = readFileSync(file, "utf8");
      const parsed = PutOptsSchema.parse({
        key: args.key,
        id: args.id,
        name: args.name,
        type: args.type === "markdown" ? "markdown" : "html",
        content,
        force: Boolean(args.force),
        baseVersion: args["base-version"] ? Number(args["base-version"]) : undefined,
        projectRoot,
      });
      await prefetchFromContent(home, parsed.type ?? "html", parsed.content);
      const result = await putArtifact(repo, registry, parsed);
      const id = artifactIdOf(result);
      const { url } = await ensureServer({ repo, registry, projectRoot });
      printJson(result, Boolean(args.json), `${id}\n${url}/a/${id}`);
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const get = defineCommand({
  meta: { name: "get", description: "Get artifact JSON" },
  args: {
    id: { type: "string", required: true },
    version: { type: "string" },
    full: { type: "boolean", default: false },
    out: { type: "string" },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const { repo } = openStore();
      const result = await getArtifactCommand(repo, {
        id: args.id as string,
        version: args.version ? Number(args.version) : undefined,
        full: Boolean(args.full) || Boolean(args.out),
      });
      if (args.out) writeFileSync(String(args.out), previewOf(result));
      printJson(result, Boolean(args.json), previewOf(result));
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const list = defineCommand({
  meta: { name: "list", description: "List artifacts" },
  args: {
    search: { type: "string" },
    tag: { type: "string" },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const { repo } = openStore();
      const result = await listArtifacts(repo, { search: args.search as string | undefined, tag: args.tag as string | undefined, limit: 50, offset: 0 });
      const lines = ((result["artifacts"] as { id: string; name: string; version: number }[]) ?? [])
        .map((a) => `${a.id}  ${a.name}  v${a.version}`)
        .join("\n");
      printJson(result, Boolean(args.json), lines || "(empty)");
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const diff = defineCommand({
  meta: { name: "diff", description: "Source diff two versions" },
  args: {
    id: { type: "string", required: true },
    from: { type: "string", required: true },
    to: { type: "string", required: true },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const { repo } = openStore();
      const result = await diffArtifacts(repo, { id: args.id as string, from: Number(args.from), to: Number(args.to) });
      printJson(result, Boolean(args.json), String((result as { diff?: string }).diff ?? "identical"));
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const restore = defineCommand({
  meta: { name: "restore", description: "Restore a version by appending" },
  args: {
    id: { type: "string", required: true },
    version: { type: "string", required: true },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const { repo } = openStore();
      const result = await restoreArtifact(repo, { id: args.id as string, version: Number(args.version) });
      printJson(result, Boolean(args.json), "restored");
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const openCmd = defineCommand({
  meta: { name: "open", description: "Open viewer; start serve if needed" },
  args: { id: { type: "string", required: true }, version: { type: "string" } },
  async run({ args }) {
    const { repo, registry, projectRoot } = openStore();
    const { url } = await ensureServer({ repo, registry, projectRoot });
    const v = args.version ? `?v=${args.version}` : "";
    const target = `${url}/a/${args.id}${v}`;
    Bun.spawn(["open", target], { stdout: "ignore", stderr: "ignore" });
    process.stdout.write(`${target}\n`);
  },
});

const serve = defineCommand({
  meta: { name: "serve", description: "Loopback HTTP" },
  args: {
    port: { type: "string" },
    bind: { type: "string" },
  },
  async run({ args }) {
    const { repo, registry, projectRoot } = openStore();
    const started = await startServer({
      repo,
      registry,
      projectRoot,
      port: args.port ? Number(args.port) : undefined,
      bind: args.bind as string | undefined,
    });
    process.stdout.write(`htmlark listening ${started.url}\n`);
    await new Promise(() => undefined);
  },
});

const exportCmd = defineCommand({
  meta: { name: "export", description: "Write authored bytes to a file" },
  args: {
    id: { type: "string", required: true },
    out: { type: "string", required: true },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const { repo } = openStore();
      const result = await getArtifactCommand(repo, { id: args.id as string, full: true });
      writeFileSync(String(args.out), previewOf(result));
      printJson({ ok: true, out: args.out }, Boolean(args.json), String(args.out));
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const importCmd = defineCommand({
  meta: { name: "import", description: "Import file (may be dirty)" },
  args: {
    file: { type: "string", required: true },
    key: { type: "string" },
    name: { type: "string" },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const { repo, registry, projectRoot } = openStore();
      const content = readFileSync(String(args.file), "utf8");
      const result = await importArtifact(repo, registry, {
        content,
        key: args.key as string | undefined,
        name: args.name as string | undefined,
        projectRoot,
      });
      printJson(result, Boolean(args.json), "imported");
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const setup = defineCommand({
  meta: { name: "setup", description: "Install skill pack and print MCP snippet" },
  args: { json: { type: "boolean", default: false } },
  run({ args }) {
    const home = htmlarkHome();
    const destDir = join(home, "skills", "htmlark-authoring");
    mkdirSync(destDir, { recursive: true });
    const dest = join(destDir, "SKILL.md");
    writeFileSync(dest, SKILL_MD);
    const spawn = htmlarkSpawn(["mcp"]);
    const mcp = { mcpServers: { htmlark: { command: spawn.command, args: spawn.args } } };
    printJson({ ok: true, skill: dest, mcp }, Boolean(args.json), `Skill: ${dest}\n${JSON.stringify(mcp, null, 2)}`);
  },
});

const check = defineCommand({
  meta: { name: "check", description: "Sanity check home dir" },
  run() {
    const { home } = openStore();
    process.stdout.write(`HTMLARK_HOME=${home}\nok\n`);
  },
});

const recipe = defineCommand({
  meta: { name: "recipe" },
  subCommands: {
    validate: defineCommand({
      args: { file: { type: "string", required: true }, json: { type: "boolean", default: false } },
      run({ args }) {
        const content = readFileSync(String(args.file), "utf8");
        if (content.trim().startsWith("{")) {
          const parsed = RecipeV0Schema.safeParse(JSON.parse(content));
          if (!parsed.success) {
            printJson({ ok: false, errors: parsed.error.issues }, Boolean(args.json), "invalid recipe");
            process.exit(2);
          }
          printJson({ ok: true, recipe: parsed.data }, Boolean(args.json), "ok");
          return;
        }
        const result = inspectArtifact({ type: "html", content });
        printJson(
          { ok: !result.rejected, rejected: result.rejected, warnings: result.warnings, errors: result.errors },
          Boolean(args.json),
          result.rejected ? result.errors.join("\n") : "ok",
        );
        if (result.rejected) process.exit(2);
      },
    }),
  },
});

const doctor = defineCommand({
  meta: { name: "doctor" },
  args: { json: { type: "boolean", default: false } },
  async run({ args }) {
    const { home } = openStore();
    const report = await doctorHome(home);
    printJson(report, Boolean(args.json), report.ok ? `ok ${home}` : `doctor failed missing=${report.missing.length} orphans=${report.orphans.length}`);
    if (!report.ok) process.exit(2);
  },
});

const mcp = defineCommand({
  meta: { name: "mcp", description: "stdio MCP" },
  async run() {
    await runMcp();
  },
});

const catalog = defineCommand({
  meta: { name: "catalog", description: "Print command catalog JSON" },
  run() {
    printJson({ ok: true, commands: COMMAND_CATALOG }, true, "");
  },
});

const remote = defineCommand({
  meta: { name: "remote" },
  subCommands: {
    init: defineCommand({
      args: {
        url: { type: "string", default: "https://a.htmlark.com" },
        json: { type: "boolean", default: false },
      },
      run({ args }) {
        const token = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("hex");
        const url = String(args.url);
        const home = htmlarkHome();
        saveRemote("origin", { url, token });
        const scaffold = writeRemoteScaffold(home);
        printJson({ ok: true, name: "origin", url, scaffold }, Boolean(args.json), `origin ${url}\nscaffold ${scaffold}\ntoken written to remotes.json`);
      },
    }),
  },
});

const publishCmd = defineCommand({
  meta: { name: "publish", description: "Push a version to a remote" },
  args: {
    id: { type: "string", required: true },
    remote: { type: "string", default: "origin" },
    version: { type: "string" },
    "follow-latest": { type: "boolean", default: false },
    password: { type: "string" },
    "source-private": { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const { home, repo } = openStore();
      const remoteCfg = getRemote(String(args.remote));
      const id = args.id as string;
      const version = args.version ? Number(args.version) : undefined;
      const ver = await repo.readVersion(id, version ?? (await repo.getArtifact(id)).headVersion);
      const vendors: Record<string, string> = {};
      for (const spec of ver.vendorSpecs) {
        const bytes = vendorGet(home, spec);
        if (bytes) vendors[spec] = Buffer.from(bytes).toString("base64");
      }
      const result = await publishArtifact(repo, new HttpPublisher(remoteCfg), {
        id,
        version,
        followLatest: Boolean(args["follow-latest"]) || !args.version,
        vendors,
        sourcePublic: !args["source-private"],
        passwordHash: args.password ? await sha256Hex(String(args.password)) : null,
      });
      printJson(result, Boolean(args.json), String(result["url"] ?? "published"));
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const unpublishCmd = defineCommand({
  meta: { name: "unpublish", description: "Remove a published artifact" },
  args: {
    id: { type: "string", required: true },
    remote: { type: "string", default: "origin" },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const result = await unpublishArtifact(new HttpPublisher(getRemote(String(args.remote))), args.id as string);
      printJson(result, Boolean(args.json), "unpublished");
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const forkCmd = defineCommand({
  meta: { name: "fork", description: "Copy a public artifact into a new local id" },
  args: {
    url: { type: "string", required: true },
    key: { type: "string", required: true },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const { repo, registry, projectRoot } = openStore();
      const page = new URL(String(args.url));
      const found = String(args.url).match(/art_[0-9A-HJKMNP-TV-Z]{22}/);
      const id = found?.[0];
      if (!id) throw new HtmlarkError("VALIDATION", "url missing artifact id");
      const metaRes = await fetch(new URL(`/v1/artifacts/${id}`, page.origin));
      const meta = (await metaRes.json()) as { artifact?: { version?: number }; preview?: string; error?: string };
      if (!metaRes.ok) throw new HtmlarkError("NOT_FOUND", meta.error ?? "fork source missing", { id });
      const version = meta.artifact?.version ?? 1;
      const rawRes = await fetch(new URL(`/v1/artifacts/${id}/versions/${version}/raw`, page.origin));
      if (!rawRes.ok) throw new HtmlarkError("VALIDATION", "source is private or missing", { id, version });
      const content = await rawRes.text();
      const result = await putArtifact(repo, registry, {
        key: String(args.key),
        content,
        name: String(args.key),
        type: "html",
        projectRoot,
      });
      printJson(result, Boolean(args.json), artifactIdOf(result));
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});

const undelete = defineCommand({
  meta: { name: "undelete", description: "Clear deleted_at" },
  args: {
    id: { type: "string", required: true },
    json: { type: "boolean", default: false },
  },
  async run({ args }) {
    try {
      const { repo } = openStore();
      await repo.undelete(args.id as string);
      printJson({ ok: true, id: args.id }, Boolean(args.json), "undeleted");
    } catch (err) {
      fail(err, Boolean(args.json));
    }
  },
});
const versionCmd = defineCommand({
  meta: { name: "version", description: "Print htmlark version" },
  run() {
    process.stdout.write(`${HTMLARK_VERSION}\n`);
  },
});

const main = defineCommand({
  meta: { name: "htmlark", description: "Local-first artifact runtime", version: HTMLARK_VERSION },
  subCommands: {
    put,
    get,
    list,
    diff,
    restore,
    undelete,
    fork: forkCmd,
    open: openCmd,
    serve,
    export: exportCmd,
    import: importCmd,
    setup,
    check,
    recipe,
    doctor,
    mcp,
    catalog,
    remote,
    publish: publishCmd,
    unpublish: unpublishCmd,
    version: versionCmd,
  },
});

await runMain(main);
