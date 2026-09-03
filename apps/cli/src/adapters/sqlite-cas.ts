import { Database } from "bun:sqlite";
import { mkdirSync, openSync, closeSync, fsyncSync, writeSync, renameSync, chmodSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { HtmlarkError, type AppendRecord, type ArtifactHead, type ArtifactRepository, type CreateRecord, type ListPage, type ListQuery, type ShareState, type VersionRecord } from "@htmlark/core";

function writeCas(root: string, hash: string, content: string): void {
  const dir = join(root, "blobs", "sha256", hash.slice(0, 2));
  mkdirSync(dir, { recursive: true });
  const finalPath = join(dir, hash);
  if (existsSync(finalPath)) return;
  const tmp = `${finalPath}.tmp`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, finalPath);
  const dirFd = openSync(dir, "r");
  try {
    fsyncSync(dirFd);
  } finally {
    closeSync(dirFd);
  }
  try {
    chmodSync(finalPath, 0o444);
  } catch {
    /* best-effort */
  }
}

function readCas(root: string, hash: string): string {
  return readFileSync(join(root, "blobs", "sha256", hash.slice(0, 2), hash), "utf8");
}

function rowHead(r: Record<string, unknown>, tags: string[]): ArtifactHead {
  return {
    id: String(r["id"]),
    name: String(r["name"]),
    type: r["type"] as ArtifactHead["type"],
    headVersion: Number(r["head_version"]),
    createdAt: Number(r["created_at"]),
    updatedAt: Number(r["updated_at"]),
    deletedAt: r["deleted_at"] == null ? null : Number(r["deleted_at"]),
    sourceTool: r["source_tool"] == null ? null : String(r["source_tool"]),
    recipeHash: r["recipe_hash"] == null ? null : String(r["recipe_hash"]),
    dirty: Number(r["dirty"]) === 1,
    tags,
  };
}

export class SqliteCasRepository implements ArtifactRepository {
  private readonly db: Database;
  constructor(private readonly home: string) {
    mkdirSync(home, { recursive: true });
    this.db = new Database(join(home, "index.sqlite"), { create: true, strict: true });
    this.db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;");
    const ver = this.db.query("PRAGMA user_version").get() as { user_version: number };
    if (ver.user_version === 0) {
      this.db.exec(`
        CREATE TABLE artifacts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('html','markdown')),
          head_version INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER,
          source_tool TEXT,
          recipe_hash TEXT,
          dirty INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE artifact_tags (
          artifact_id TEXT NOT NULL REFERENCES artifacts(id),
          tag TEXT NOT NULL,
          PRIMARY KEY (artifact_id, tag)
        );
        CREATE TABLE versions (
          artifact_id TEXT NOT NULL REFERENCES artifacts(id),
          version INTEGER NOT NULL,
          blob_hash TEXT NOT NULL,
          size INTEGER NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('html','markdown')),
          tags_json TEXT NOT NULL DEFAULT '[]',
          recipe_hash TEXT,
          vendor_specs TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL,
          restored_from INTEGER,
          dirty INTEGER NOT NULL DEFAULT 0,
          provenance TEXT NOT NULL,
          warnings TEXT NOT NULL DEFAULT '[]',
          PRIMARY KEY (artifact_id, version)
        );
        CREATE TABLE shares (
          artifact_id TEXT PRIMARY KEY REFERENCES artifacts(id),
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL
        );
        PRAGMA user_version = 1;
      `);
    }
  }

  async create(input: CreateRecord): Promise<ArtifactHead> {
    writeCas(this.home, input.blobHash, input.content);
    const tx = this.db.transaction(() => {
      const exists = this.db.query("SELECT id FROM artifacts WHERE id = $id").get({ id: input.id });
      if (exists) throw new HtmlarkError("CONFLICT", "id exists", { id: input.id });
      this.db.query(
        `INSERT INTO artifacts (id,name,type,head_version,created_at,updated_at,source_tool,recipe_hash,dirty)
         VALUES ($id,$name,$type,1,$ca,$ua,$st,$rh,$dirty)`,
      ).run({
        id: input.id,
        name: input.name,
        type: input.type,
        ca: input.createdAt,
        ua: input.createdAt,
        st: (input.provenance["agent"] as string | undefined) ?? null,
        rh: input.recipeHash,
        dirty: input.dirty ? 1 : 0,
      });
      this.insertVersion(input.id, 1, input, null);
      this.replaceTags(input.id, input.tags);
    });
    tx();
    return this.getArtifact(input.id);
  }

  async append(input: AppendRecord): Promise<ArtifactHead> {
    writeCas(this.home, input.blobHash, input.content);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db.query("SELECT * FROM artifacts WHERE id = $id AND deleted_at IS NULL").get({ id: input.id }) as Record<string, unknown> | null;
      if (!row) throw new HtmlarkError("NOT_FOUND", "artifact missing", { id: input.id });
      const head = Number(row["head_version"]);
      if (head !== input.baseVersion) {
        const hv = this.db.query("SELECT blob_hash FROM versions WHERE artifact_id=$id AND version=$v").get({ id: input.id, v: head }) as { blob_hash: string } | null;
        throw new HtmlarkError("CONFLICT", "stale baseVersion", {
          id: input.id,
          head,
          headHash: hv ? `sha256:${hv.blob_hash}` : undefined,
        });
      }
      const next = head + 1;
      this.insertVersion(input.id, next, input, input.restoredFrom);
      this.db.query(
        `UPDATE artifacts SET name=$name, type=$type, head_version=$hv, updated_at=$ua, recipe_hash=$rh, dirty=$dirty WHERE id=$id`,
      ).run({
        name: input.name,
        type: input.type,
        hv: next,
        ua: input.createdAt,
        rh: input.recipeHash,
        dirty: input.dirty ? 1 : 0,
        id: input.id,
      });
      this.replaceTags(input.id, input.tags);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
    return this.getArtifact(input.id);
  }

  async readVersion(id: string, version: number): Promise<VersionRecord> {
    const r = this.db.query("SELECT * FROM versions WHERE artifact_id=$id AND version=$v").get({ id, v: version }) as Record<string, unknown> | null;
    if (!r) throw new HtmlarkError("NOT_FOUND", "version missing", { id, version });
    const blobHash = String(r["blob_hash"]);
    return {
      version: Number(r["version"]),
      blobHash,
      size: Number(r["size"]),
      name: String(r["name"]),
      type: r["type"] as VersionRecord["type"],
      tags: JSON.parse(String(r["tags_json"])) as string[],
      recipeHash: r["recipe_hash"] == null ? null : String(r["recipe_hash"]),
      vendorSpecs: JSON.parse(String(r["vendor_specs"])) as string[],
      createdAt: Number(r["created_at"]),
      restoredFrom: r["restored_from"] == null ? null : Number(r["restored_from"]),
      dirty: Number(r["dirty"]) === 1,
      provenance: JSON.parse(String(r["provenance"])) as Record<string, unknown>,
      warnings: JSON.parse(String(r["warnings"])) as string[],
      content: readCas(this.home, blobHash),
    };
  }

  async getArtifact(id: string): Promise<ArtifactHead> {
    const r = this.db.query("SELECT * FROM artifacts WHERE id=$id AND deleted_at IS NULL").get({ id }) as Record<string, unknown> | null;
    if (!r) throw new HtmlarkError("NOT_FOUND", "artifact missing", { id });
    return rowHead(r, this.tagsOf(id));
  }

  async list(query: ListQuery): Promise<ListPage> {
    const all = this.db.query("SELECT * FROM artifacts WHERE deleted_at IS NULL ORDER BY updated_at DESC").all() as Record<string, unknown>[];
    let rows = all.map((r) => rowHead(r, this.tagsOf(String(r["id"]))));
    if (query.search) {
      const q = query.search.toLowerCase();
      rows = rows.filter((h) => h.name.toLowerCase().includes(q) || h.tags.some((t) => t.toLowerCase().includes(q)));
    }
    const tag = query.tag;
    if (tag) rows = rows.filter((h) => h.tags.includes(tag));
    return { total: rows.length, artifacts: rows.slice(query.offset, query.offset + query.limit) };
  }

  referencedVendorSpecs(): Set<string> {
    const rows = this.db.query("SELECT vendor_specs FROM versions").all() as { vendor_specs: string }[];
    const out = new Set<string>();
    for (const row of rows) {
      const specs = JSON.parse(row.vendor_specs) as unknown;
      if (!Array.isArray(specs)) continue;
      for (const spec of specs) if (typeof spec === "string") out.add(spec);
    }
    return out;
  }

  async setShare(id: string, enabled: boolean): Promise<ShareState> {
    await this.getArtifact(id);
    const now = Date.now();
    this.db.query(
      `INSERT INTO shares (artifact_id, enabled, created_at) VALUES ($id,$en,$ca)
       ON CONFLICT(artifact_id) DO UPDATE SET enabled=$en`,
    ).run({ id, en: enabled ? 1 : 0, ca: now });
    return { id, enabled };
  }

  async softDelete(id: string): Promise<void> {
    const r = this.db.query("UPDATE artifacts SET deleted_at=$t WHERE id=$id").run({ t: Date.now(), id });
    if (r.changes === 0) throw new HtmlarkError("NOT_FOUND", "artifact missing", { id });
  }

  async undelete(id: string): Promise<void> {
    const r = this.db.query("UPDATE artifacts SET deleted_at=NULL WHERE id=$id").run({ id });
    if (r.changes === 0) throw new HtmlarkError("NOT_FOUND", "artifact missing", { id });
  }

  private tagsOf(id: string): string[] {
    const rows = this.db.query("SELECT tag FROM artifact_tags WHERE artifact_id=$id").all({ id }) as { tag: string }[];
    return rows.map((r) => r.tag);
  }

  private replaceTags(id: string, tags: string[]): void {
    this.db.query("DELETE FROM artifact_tags WHERE artifact_id=$id").run({ id });
    for (const tag of tags) {
      this.db.query("INSERT INTO artifact_tags (artifact_id, tag) VALUES ($id,$tag)").run({ id, tag });
    }
  }

  private insertVersion(id: string, version: number, input: CreateRecord | AppendRecord, restoredFrom: number | null): void {
    this.db.query(
      `INSERT INTO versions (artifact_id,version,blob_hash,size,name,type,tags_json,recipe_hash,vendor_specs,created_at,restored_from,dirty,provenance,warnings)
       VALUES ($id,$v,$bh,$sz,$name,$type,$tags,$rh,$vs,$ca,$rf,$dirty,$prov,$warn)`,
    ).run({
      id,
      v: version,
      bh: input.blobHash,
      sz: input.size,
      name: input.name,
      type: input.type,
      tags: JSON.stringify(input.tags),
      rh: input.recipeHash,
      vs: JSON.stringify(input.vendorSpecs),
      ca: input.createdAt,
      rf: restoredFrom,
      dirty: input.dirty ? 1 : 0,
      prov: JSON.stringify(input.provenance),
      warn: JSON.stringify(input.warnings),
    });
  }
}
