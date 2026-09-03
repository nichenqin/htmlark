import { mkdirSync, openSync, closeSync, fsyncSync, writeSync, renameSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { HtmlarkError, type ProjectArtifactRegistry } from "@htmlark/core";

type FileShape = { artifacts: Record<string, string> };

export class JsonProjectArtifactRegistry implements ProjectArtifactRegistry {
  private pathFor(projectRoot: string): string {
    return join(projectRoot, ".htmlark", "ids.json");
  }

  async resolve(projectRoot: string, key: string): Promise<string | null> {
    const p = this.pathFor(projectRoot);
    if (!existsSync(p)) return null;
    const data = JSON.parse(readFileSync(p, "utf8")) as FileShape;
    return data.artifacts[key] ?? null;
  }

  async bind(projectRoot: string, key: string, id: string): Promise<void> {
    const p = this.pathFor(projectRoot);
    mkdirSync(dirname(p), { recursive: true });
    let data: FileShape = { artifacts: {} };
    if (existsSync(p)) {
      data = JSON.parse(readFileSync(p, "utf8")) as FileShape;
      data.artifacts ??= {};
    }
    data.artifacts[key] = id;
    const tmp = `${p}.tmp`;
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, `${JSON.stringify(data, null, 2)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    try {
      renameSync(tmp, p);
    } catch {
      throw new HtmlarkError("REGISTRY", "failed to write ids.json", { key, id });
    }
  }
}
