export type ArtifactType = "html" | "markdown";

export type VersionRecord = {
  version: number;
  blobHash: string;
  size: number;
  name: string;
  type: ArtifactType;
  tags: string[];
  recipeHash: string | null;
  vendorSpecs: string[];
  createdAt: number;
  restoredFrom: number | null;
  dirty: boolean;
  provenance: Record<string, unknown>;
  warnings: string[];
  content: string;
};

export type ArtifactHead = {
  id: string;
  name: string;
  type: ArtifactType;
  headVersion: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  sourceTool: string | null;
  recipeHash: string | null;
  dirty: boolean;
  tags: string[];
};

export type CreateRecord = {
  id: string;
  name: string;
  type: ArtifactType;
  content: string;
  tags: string[];
  provenance: Record<string, unknown>;
  recipeHash: string | null;
  vendorSpecs: string[];
  dirty: boolean;
  warnings: string[];
  blobHash: string;
  size: number;
  createdAt: number;
};

export type AppendRecord = {
  id: string;
  content: string;
  name: string;
  type: ArtifactType;
  tags: string[];
  provenance: Record<string, unknown>;
  recipeHash: string | null;
  vendorSpecs: string[];
  dirty: boolean;
  warnings: string[];
  blobHash: string;
  size: number;
  createdAt: number;
  baseVersion: number;
  restoredFrom: number | null;
};

export type ListQuery = {
  search?: string;
  tag?: string;
  limit: number;
  offset: number;
};

export type ListPage = { total: number; artifacts: ArtifactHead[] };

export type ShareState = { id: string; enabled: boolean };

export interface ArtifactRepository {
  create(input: CreateRecord): Promise<ArtifactHead>;
  append(input: AppendRecord): Promise<ArtifactHead>;
  readVersion(id: string, version: number): Promise<VersionRecord>;
  getArtifact(id: string): Promise<ArtifactHead>;
  list(query: ListQuery): Promise<ListPage>;
  setShare(id: string, enabled: boolean): Promise<ShareState>;
  softDelete(id: string): Promise<void>;
  undelete(id: string): Promise<void>;
}

export interface ProjectArtifactRegistry {
  resolve(projectRoot: string, key: string): Promise<string | null>;
  bind(projectRoot: string, key: string, id: string): Promise<void>;
}

export interface ArtifactPublisher {
  publish(snapshot: {
    id: string;
    version: number;
    name: string;
    type: ArtifactType;
    content: string;
    followLatest: boolean;
    dirty: boolean;
    vendorSpecs: string[];
    vendors: Record<string, string>;
  }): Promise<{ id: string; url: string }>;
  unpublish(id: string): Promise<void>;
}
