import type { PublishStore, PublishedMeta, PublishedVersion } from "../../../packages/http/src/publish.ts";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function d1R2Store(db: D1Database, bucket: R2Bucket): PublishStore {
  return {
    async put(input) {
      const m = input.meta;
      await db
        .prepare(
          `INSERT INTO artifacts (id,name,type,head_version,follow_latest,source_public,password_hash,dirty,vendor_specs)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name=excluded.name, type=excluded.type, head_version=excluded.head_version,
             follow_latest=excluded.follow_latest, source_public=excluded.source_public,
             password_hash=excluded.password_hash, dirty=excluded.dirty, vendor_specs=excluded.vendor_specs`,
        )
        .bind(
          m.id,
          m.name,
          m.type,
          m.headVersion,
          m.followLatest ? 1 : 0,
          m.sourcePublic ? 1 : 0,
          m.passwordHash,
          m.dirty ? 1 : 0,
          JSON.stringify(m.vendorSpecs),
        )
        .run();
      await db
        .prepare(
          `INSERT INTO versions (artifact_id, version, name, type, dirty) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(artifact_id, version) DO UPDATE SET name=excluded.name, type=excluded.type, dirty=excluded.dirty`,
        )
        .bind(m.id, input.version.version, input.version.name, input.version.type, input.version.dirty ? 1 : 0)
        .run();
      await bucket.put(`body/${m.id}/${input.version.version}`, input.version.content);
      for (const [spec, b64] of Object.entries(input.vendors)) {
        await bucket.put(`vendor/${spec}`, b64ToBytes(b64));
      }
    },
    async getMeta(id) {
      const row = await db
        .prepare(
          `SELECT id, name, type, head_version, follow_latest, source_public, password_hash, dirty, vendor_specs FROM artifacts WHERE id = ?`,
        )
        .bind(id)
        .first<{
          id: string;
          name: string;
          type: "html" | "markdown";
          head_version: number;
          follow_latest: number;
          source_public: number;
          password_hash: string | null;
          dirty: number;
          vendor_specs: string;
        }>();
      if (!row) return null;
      const meta: PublishedMeta = {
        id: row.id,
        name: row.name,
        type: row.type,
        headVersion: row.head_version,
        followLatest: row.follow_latest === 1,
        sourcePublic: row.source_public === 1,
        passwordHash: row.password_hash,
        dirty: row.dirty === 1,
        vendorSpecs: JSON.parse(row.vendor_specs) as string[],
      };
      return meta;
    },
    async getVersion(id, version) {
      const row = await db
        .prepare(`SELECT version, name, type, dirty FROM versions WHERE artifact_id = ? AND version = ?`)
        .bind(id, version)
        .first<{ version: number; name: string; type: "html" | "markdown"; dirty: number }>();
      if (!row) return null;
      const obj = await bucket.get(`body/${id}/${version}`);
      if (!obj) return null;
      const ver: PublishedVersion = {
        version: row.version,
        name: row.name,
        type: row.type,
        dirty: row.dirty === 1,
        content: await obj.text(),
      };
      return ver;
    },
    async listVersions(id) {
      const res = await db.prepare(`SELECT version FROM versions WHERE artifact_id = ? ORDER BY version`).bind(id).all<{ version: number }>();
      return (res.results ?? []).map((r) => r.version);
    },
    async delete(id) {
      await db.prepare(`DELETE FROM versions WHERE artifact_id = ?`).bind(id).run();
      await db.prepare(`DELETE FROM artifacts WHERE id = ?`).bind(id).run();
    },
    async getVendor(spec) {
      const obj = await bucket.get(`vendor/${spec}`);
      if (!obj) return null;
      return new Uint8Array(await obj.arrayBuffer());
    },
  };
}
