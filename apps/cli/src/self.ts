import { basename } from "node:path";

export const HTMLARK_VERSION = "0.1.0";

export function isStandaloneBinary(): boolean {
  const base = basename(process.execPath).replace(/\.exe$/i, "");
  return base === "htmlark" || base.startsWith("htmlark-");
}

export function htmlarkSpawn(subcommand: string[]): { command: string; args: string[] } {
  if (isStandaloneBinary()) return { command: process.execPath, args: subcommand };
  const self = process.argv[1];
  if (!self) return { command: process.execPath, args: subcommand };
  return { command: process.execPath, args: [self, ...subcommand] };
}
