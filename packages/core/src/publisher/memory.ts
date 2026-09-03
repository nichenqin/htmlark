import { HtmlarkError } from "../errors.ts";
import type { ArtifactPublisher } from "../types.ts";

type Row = {
  id: string;
  version: number;
  name: string;
  type: "html" | "markdown";
  content: string;
  followLatest: boolean;
  dirty: boolean;
  vendorSpecs: string[];
  vendors: Record<string, string>;
};

export class MemoryPublisher implements ArtifactPublisher {
  readonly rows = new Map<string, Row>();
  constructor(private readonly origin: string) {}

  async publish(snapshot: Row): Promise<{ id: string; url: string }> {
    this.rows.set(snapshot.id, snapshot);
    return { id: snapshot.id, url: `${this.origin}/a/${snapshot.id}` };
  }

  async unpublish(id: string): Promise<void> {
    if (!this.rows.delete(id)) throw new HtmlarkError("NOT_FOUND", "not published", { id });
  }
}
