import type { ProjectArtifactRegistry } from "../types.ts";

export class MemoryProjectArtifactRegistry implements ProjectArtifactRegistry {
  private readonly keys = new Map<string, string>();

  async resolve(projectRoot: string, key: string): Promise<string | null> {
    return this.keys.get(`${projectRoot}::${key}`) ?? null;
  }

  async bind(projectRoot: string, key: string, id: string): Promise<void> {
    this.keys.set(`${projectRoot}::${key}`, id);
  }
}
