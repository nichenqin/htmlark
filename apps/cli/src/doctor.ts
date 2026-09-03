import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "@htmlark/core";
import { Sqlite } from "./sqlite.ts";

export type DoctorReport = {
  ok: boolean;
  home: string;
  integrity: string;
  missing: { id: string; version: number; blobHash: string }[];
  hashMismatch: { id: string; version: number; blobHash: string }[];
  orphans: string[];
};

function walkBlobs(root: string): string[] {
  const blobs = join(root, "blobs", "sha256");
  if (!existsSync(blobs)) return [];
  const out: string[] = [];
  for (const shard of readdirSync(blobs)) {
    const dir = join(blobs, shard);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir)) {
      if (name.endsWith(".tmp")) continue;
      out.push(join(dir, name));
    }
  }
  return out;
}

export async function doctorHome(home: string): Promise<DoctorReport> {
  const dbPath = join(home, "index.sqlite");
  const missing: DoctorReport["missing"] = [];
  const hashMismatch: DoctorReport["hashMismatch"] = [];
  const referenced = new Set<string>();
  let integrity = "ok";
  if (existsSync(dbPath)) {
    const db = new Sqlite(dbPath);
    try {
      const row = db.query("PRAGMA integrity_check").get() as { integrity_check?: string } | string | null;
      integrity = typeof row === "string" ? row : row?.integrity_check ?? "ok";
      const versions = db.query("SELECT artifact_id, version, blob_hash FROM versions").all() as {
        artifact_id: string;
        version: number;
        blob_hash: string;
      }[];
      for (const v of versions) {
        referenced.add(v.blob_hash);
        const p = join(home, "blobs", "sha256", v.blob_hash.slice(0, 2), v.blob_hash);
        if (!existsSync(p)) {
          missing.push({ id: v.artifact_id, version: v.version, blobHash: v.blob_hash });
          continue;
        }
        const bytes = readFileSync(p);
        const hex = await sha256Hex(bytes);
        if (hex !== v.blob_hash) hashMismatch.push({ id: v.artifact_id, version: v.version, blobHash: v.blob_hash });
      }
    } finally {
      db.close();
    }
  }
  const orphans = walkBlobs(home)
    .map((p) => p.split("/").pop() ?? "")
    .filter((hash) => hash && !referenced.has(hash));
  return {
    ok: integrity === "ok" && missing.length === 0 && hashMismatch.length === 0,
    home,
    integrity,
    missing,
    hashMismatch,
    orphans,
  };
}
