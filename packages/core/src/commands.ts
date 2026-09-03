import { inspectArtifact } from "@htmlark/runtime";
import { z } from "zod";
import { unifiedDiff } from "./diff.ts";
import { HtmlarkError } from "./errors.ts";
import { hashJson, sha256Hex } from "./hash.ts";
import { generateId, isArtifactId } from "./id.ts";
import type { ArtifactRepository, ProjectArtifactRegistry } from "./types.ts";
import { PutOptsSchema, type DiffOpts, type GetOpts, type ImportOpts, type ListOpts, type RestoreOpts } from "./schemas.ts";
function provenance(opts: { agent?: string; model?: string }): Record<string, unknown> {
  return {
    agent: opts.agent ?? "unknown",
    model: opts.model ?? null,
    host: `${process.platform}-${process.arch}`,
    cliVersion: "0.1.0",
  };
}

function artifactJson(head: {
  id: string;
  name: string;
  type: string;
  headVersion: number;
  updatedAt: number;
  createdAt: number;
  sourceTool: string | null;
  dirty: boolean;
  tags: string[];
  recipeHash: string | null;
}, extra: Record<string, unknown> = {}) {
  const bind = process.env["HTMLARK_BIND"] ?? "127.0.0.1";
  const port = process.env["HTMLARK_PORT"] ?? "7420";
  const origin = `http://${bind}:${port}`;
  return {
    id: head.id,
    name: head.name,
    type: head.type,
    version: head.headVersion,
    updatedAt: new Date(head.updatedAt).toISOString(),
    createdAt: new Date(head.createdAt).toISOString(),
    sourceTool: head.sourceTool,
    dirty: head.dirty,
    tags: head.tags,
    recipeHash: head.recipeHash,
    previewUrl: `${origin}/a/${head.id}`,
    renderUrl: `${origin}/render/${head.id}/${head.headVersion}`,
    ...extra,
  };
}

export async function putArtifact(
  repo: ArtifactRepository,
  registry: ProjectArtifactRegistry,
  raw: z.input<typeof PutOptsSchema>,
): Promise<Record<string, unknown>> {
  const opts = PutOptsSchema.parse(raw);
  const type = opts.type ?? "html";
  const inspection = inspectArtifact({ type, content: opts.content });
  const dirty = opts.force && inspection.rejected;
  if (inspection.rejected && !opts.force) {
    throw new HtmlarkError("VALIDATION", "quality gate failed", { errors: inspection.errors, warnings: inspection.warnings });
  }
  const blobHash = await sha256Hex(opts.content);
  const now = Date.now();
  const name = opts.name ?? opts.key ?? "untitled";
  const tags = opts.tags ?? [];
  const prov = provenance(opts);

  let id = opts.id;
  if (opts.key && opts.projectRoot) {
    const bound = await registry.resolve(opts.projectRoot, opts.key);
    if (bound) id = bound;
  }
  if (!id) id = generateId();
  if (!isArtifactId(id)) throw new HtmlarkError("VALIDATION", "bad id", { id });

  let head;
  try {
    head = await repo.getArtifact(id);
  } catch (err) {
    if (!(err instanceof HtmlarkError) || err.code !== "NOT_FOUND") throw err;
    head = await repo.create({
      id,
      name,
      type,
      content: opts.content,
      tags,
      provenance: prov,
      recipeHash: null,
      vendorSpecs: inspection.vendorSpecs,
      dirty,
      warnings: inspection.warnings,
      blobHash,
      size: Buffer.byteLength(opts.content, "utf8"),
      createdAt: now,
    });
    if (opts.key && opts.projectRoot) {
      try {
        await registry.bind(opts.projectRoot, opts.key, id);
      } catch {
        throw new HtmlarkError("REGISTRY", "failed to bind key", { key: opts.key, id });
      }
    }
    return {
      ok: true,
      artifact: artifactJson(head, { hash: hashJson(blobHash) }),
      warnings: inspection.warnings,
      next: `Revise with htmlark put --key ${opts.key ?? id} --json`,
    };
  }

  const base = opts.baseVersion ?? head.headVersion;
  head = await repo.append({
    id,
    content: opts.content,
    name,
    type,
    tags,
    provenance: prov,
    recipeHash: null,
    vendorSpecs: inspection.vendorSpecs,
    dirty,
    warnings: inspection.warnings,
    blobHash,
    size: Buffer.byteLength(opts.content, "utf8"),
    createdAt: now,
    baseVersion: base,
    restoredFrom: null,
  });
  return {
    ok: true,
    artifact: artifactJson(head, { hash: hashJson(blobHash) }),
    warnings: inspection.warnings,
    next: `Revise with htmlark put --key ${opts.key ?? id} --base-version ${head.headVersion} --json`,
  };
}

export async function getArtifactCommand(
  repo: ArtifactRepository,
  opts: GetOpts,
): Promise<Record<string, unknown>> {
  const head = await repo.getArtifact(opts.id);
  const ver = await repo.readVersion(opts.id, opts.version ?? head.headVersion);
  const preview = opts.full ? ver.content : ver.content.slice(0, 2048);
  return {
    ok: true,
    artifact: {
      ...artifactJson(head, { hash: hashJson(ver.blobHash), size: ver.size }),
      warnings: ver.warnings,
      provenance: ver.provenance,
      versions: [{ version: ver.version, hash: hashJson(ver.blobHash), size: ver.size, createdAt: new Date(ver.createdAt).toISOString(), restoredFrom: ver.restoredFrom, dirty: ver.dirty, warnings: ver.warnings }],
    },
    truncated: !opts.full && ver.content.length > 2048,
    preview,
  };
}

export async function listArtifacts(repo: ArtifactRepository, opts: ListOpts): Promise<Record<string, unknown>> {
  const page = await repo.list(opts);
  return {
    ok: true,
    total: page.total,
    artifacts: page.artifacts.map((a) => artifactJson(a)),
  };
}

export async function diffArtifacts(repo: ArtifactRepository, opts: DiffOpts): Promise<Record<string, unknown>> {
  const from = await repo.readVersion(opts.id, opts.from);
  const to = await repo.readVersion(opts.id, opts.to);
  const identical = from.blobHash === to.blobHash;
  if (identical) {
    return { ok: true, identical: true, from: opts.from, to: opts.to, fromHash: hashJson(from.blobHash), toHash: hashJson(to.blobHash) };
  }
  return {
    ok: true,
    identical: false,
    from: opts.from,
    to: opts.to,
    fromHash: hashJson(from.blobHash),
    toHash: hashJson(to.blobHash),
    diff: unifiedDiff(from.content, to.content, `v${opts.from}`, `v${opts.to}`),
  };
}

export async function restoreArtifact(
  repo: ArtifactRepository,
  opts: RestoreOpts,
): Promise<Record<string, unknown>> {
  const head = await repo.getArtifact(opts.id);
  const ver = await repo.readVersion(opts.id, opts.version);
  const next = await repo.append({
    id: opts.id,
    content: ver.content,
    name: ver.name,
    type: ver.type,
    tags: ver.tags,
    provenance: { ...ver.provenance, restored: true },
    recipeHash: ver.recipeHash,
    vendorSpecs: ver.vendorSpecs,
    dirty: ver.dirty,
    warnings: ver.warnings,
    blobHash: ver.blobHash,
    size: ver.size,
    createdAt: Date.now(),
    baseVersion: opts.baseVersion ?? head.headVersion,
    restoredFrom: opts.version,
  });
  return { ok: true, artifact: artifactJson(next, { hash: hashJson(ver.blobHash) }) };
}

export async function importArtifact(
  repo: ArtifactRepository,
  registry: ProjectArtifactRegistry,
  opts: ImportOpts,
): Promise<Record<string, unknown>> {
  return putArtifact(repo, registry, {
    key: opts.key,
    name: opts.name ?? opts.key ?? "imported",
    type: opts.type ?? "html",
    content: opts.content,
    force: true,
    projectRoot: opts.projectRoot,
  });
}
