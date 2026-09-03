import { join } from "node:path";
import { SqliteCasRepository } from "./adapters/sqlite-cas.ts";
import { JsonProjectArtifactRegistry } from "./adapters/json-registry.ts";
import { htmlarkHome } from "./home.ts";

export function openStore() {
  const home = htmlarkHome();
  const repo = new SqliteCasRepository(home);
  const registry = new JsonProjectArtifactRegistry();
  const projectRoot = process.cwd();
  return { home, repo, registry, projectRoot };
}

export function printJson(value: unknown, json: boolean, fallback: string): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${fallback}\n`);
}
