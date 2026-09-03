import type { PublishStore, PublishedMeta, PublishedVersion } from "./publish.ts";

export class MemoryPublishStore implements PublishStore {
  readonly meta = new Map<string, PublishedMeta>();
  readonly versions = new Map<string, Map<number, PublishedVersion>>();
  readonly vendors = new Map<string, Uint8Array>();

  async put(input: { meta: PublishedMeta; version: PublishedVersion; vendors: Record<string, string> }): Promise<void> {
    this.meta.set(input.meta.id, input.meta);
    let vs = this.versions.get(input.meta.id);
    if (!vs) {
      vs = new Map();
      this.versions.set(input.meta.id, vs);
    }
    vs.set(input.version.version, input.version);
    for (const [spec, b64] of Object.entries(input.vendors)) {
      this.vendors.set(spec, Uint8Array.from(Buffer.from(b64, "base64")));
    }
  }

  async getMeta(id: string): Promise<PublishedMeta | null> {
    return this.meta.get(id) ?? null;
  }

  async getVersion(id: string, version: number): Promise<PublishedVersion | null> {
    return this.versions.get(id)?.get(version) ?? null;
  }

  async listVersions(id: string): Promise<number[]> {
    return [...(this.versions.get(id)?.keys() ?? [])].sort((a, b) => a - b);
  }

  async delete(id: string): Promise<void> {
    this.meta.delete(id);
    this.versions.delete(id);
  }

  async getVendor(spec: string): Promise<Uint8Array | null> {
    return this.vendors.get(spec) ?? null;
  }
}
