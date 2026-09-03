import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function htmlarkHome(): string {
  const home = process.env["HTMLARK_HOME"] ?? join(homedir(), ".htmlark");
  mkdirSync(home, { recursive: true });
  const cfg = join(home, "config.json");
  if (!existsSync(cfg)) {
    writeFileSync(
      cfg,
      `${JSON.stringify({ bind: "127.0.0.1", port: 7420, vendorCdn: "https://unpkg.com", experimental: { lan: false, visualDiff: false } }, null, 2)}\n`,
    );
  }
  return home;
}

export function defaultBind(): string {
  return process.env["HTMLARK_BIND"] ?? "127.0.0.1";
}

export function defaultPort(): number {
  return Number(process.env["HTMLARK_PORT"] ?? 7420);
}
