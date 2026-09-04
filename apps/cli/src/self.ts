import { spawn } from "node:child_process";
import { basename } from "node:path";

export const HTMLARK_VERSION = "0.1.4";

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

export function openUrl(url: string): void {
  const child =
    process.platform === "darwin"
      ? spawn("open", [url], { detached: true, stdio: "ignore" })
      : process.platform === "win32"
        ? spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" })
        : spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  child.unref();
}
