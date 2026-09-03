import { HtmlarkError } from "../errors.ts";
import type {
  AppendRecord,
  ArtifactHead,
  ArtifactRepository,
  CreateRecord,
  ListPage,
  ListQuery,
  ShareState,
  VersionRecord,
} from "../types.ts";

type Stored = {
  head: ArtifactHead;
  versions: VersionRecord[];
  blobs: Map<string, string>;
  share: boolean;
};

export class MemoryRepository implements ArtifactRepository {
  private readonly items = new Map<string, Stored>();

  async create(input: CreateRecord): Promise<ArtifactHead> {
    if (this.items.has(input.id)) {
      throw new HtmlarkError("CONFLICT", "id exists", { id: input.id });
    }
    const now = input.createdAt;
    const head: ArtifactHead = {
      id: input.id,
      name: input.name,
      type: input.type,
      headVersion: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      sourceTool: (input.provenance["agent"] as string | undefined) ?? null,
      recipeHash: input.recipeHash,
      dirty: input.dirty,
      tags: input.tags,
    };
    const ver: VersionRecord = {
      version: 1,
      blobHash: input.blobHash,
      size: input.size,
      name: input.name,
      type: input.type,
      tags: input.tags,
      recipeHash: input.recipeHash,
      vendorSpecs: input.vendorSpecs,
      createdAt: now,
      restoredFrom: null,
      dirty: input.dirty,
      provenance: input.provenance,
      warnings: input.warnings,
      content: input.content,
    };
    this.items.set(input.id, {
      head,
      versions: [ver],
      blobs: new Map([[input.blobHash, input.content]]),
      share: false,
    });
    return head;
  }

  async append(input: AppendRecord): Promise<ArtifactHead> {
    const stored = this.require(input.id);
    if (stored.head.deletedAt) throw new HtmlarkError("NOT_FOUND", "deleted", { id: input.id });
    if (stored.head.headVersion !== input.baseVersion) {
      const headVer = stored.versions.find((v) => v.version === stored.head.headVersion);
      throw new HtmlarkError("CONFLICT", "stale baseVersion", {
        id: input.id,
        head: stored.head.headVersion,
        headHash: headVer ? `sha256:${headVer.blobHash}` : undefined,
      });
    }
    const next = input.baseVersion + 1;
    const ver: VersionRecord = {
      version: next,
      blobHash: input.blobHash,
      size: input.size,
      name: input.name,
      type: input.type,
      tags: input.tags,
      recipeHash: input.recipeHash,
      vendorSpecs: input.vendorSpecs,
      createdAt: input.createdAt,
      restoredFrom: input.restoredFrom,
      dirty: input.dirty,
      provenance: input.provenance,
      warnings: input.warnings,
      content: input.content,
    };
    stored.versions.push(ver);
    stored.blobs.set(input.blobHash, input.content);
    stored.head = {
      ...stored.head,
      name: input.name,
      type: input.type,
      tags: input.tags,
      headVersion: next,
      updatedAt: input.createdAt,
      dirty: input.dirty,
      recipeHash: input.recipeHash,
    };
    return stored.head;
  }

  async readVersion(id: string, version: number): Promise<VersionRecord> {
    const stored = this.require(id);
    const ver = stored.versions.find((v) => v.version === version);
    if (!ver) throw new HtmlarkError("NOT_FOUND", "version missing", { id, version });
    return { ...ver, content: stored.blobs.get(ver.blobHash) ?? ver.content };
  }

  async getArtifact(id: string): Promise<ArtifactHead> {
    const stored = this.require(id);
    if (stored.head.deletedAt) throw new HtmlarkError("NOT_FOUND", "deleted", { id });
    return stored.head;
  }

  async list(query: ListQuery): Promise<ListPage> {
    let rows = [...this.items.values()].map((s) => s.head).filter((h) => h.deletedAt === null);
    if (query.search) {
      const q = query.search.toLowerCase();
      rows = rows.filter((h) => h.name.toLowerCase().includes(q) || h.tags.some((t) => t.toLowerCase().includes(q)));
    }
    const tag = query.tag;
    if (tag) rows = rows.filter((h) => h.tags.includes(tag));
    const total = rows.length;
    return { total, artifacts: rows.slice(query.offset, query.offset + query.limit) };
  }

  async setShare(id: string, enabled: boolean): Promise<ShareState> {
    const stored = this.require(id);
    stored.share = enabled;
    return { id, enabled };
  }

  async softDelete(id: string): Promise<void> {
    const stored = this.require(id);
    stored.head = { ...stored.head, deletedAt: Date.now() };
  }

  async undelete(id: string): Promise<void> {
    const stored = this.require(id);
    stored.head = { ...stored.head, deletedAt: null };
  }

  private require(id: string): Stored {
    const stored = this.items.get(id);
    if (!stored) throw new HtmlarkError("NOT_FOUND", "artifact missing", { id });
    return stored;
  }
}
