import { HtmlarkError } from "../errors.ts";
import type { ArtifactPublisher } from "../types.ts";

type Snap = Parameters<ArtifactPublisher["publish"]>[0];

export class MemoryPublisher implements ArtifactPublisher {
  readonly rows = new Map<string, Snap>();
  constructor(private readonly origin: string) {}

  async publish(snapshot: Snap): Promise<{ id: string; url: string }> {
    this.rows.set(snapshot.id, snapshot);
    return { id: snapshot.id, url: `${this.origin}/a/${snapshot.id}` };
  }

  async unpublish(id: string): Promise<void> {
    if (!this.rows.delete(id)) throw new HtmlarkError("NOT_FOUND", "not published", { id });
  }
}
