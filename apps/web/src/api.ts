export type Artifact = {
  id: string;
  name: string;
  type: string;
  version: number;
  dirty: boolean;
  updatedAt: string;
  createdAt: string;
  tags: string[];
  previewUrl?: string;
  renderUrl?: string;
};

export type VersionRow = {
  version: number;
  hash: string;
  size: number;
  createdAt: string;
  restoredFrom: number | null;
  dirty: boolean;
};

function token(): string {
  return document.querySelector('meta[name="htmlark-token"]')?.getAttribute("content") ?? "";
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Htmlark-Token", token());
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(path, { ...init, headers });
  const body = (await res.json()) as T & { error?: string; code?: string };
  if (!res.ok) throw new Error(body.error ?? `${res.status}`);
  return body;
}

export function listArtifacts(search: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return api<{ ok: boolean; total: number; artifacts: Artifact[] }>(`/v1/artifacts${q}`);
}

export function getArtifact(id: string) {
  return api<{
    ok: boolean;
    preview: string;
    artifact: Artifact & { versions: VersionRow[]; provenance?: unknown; warnings?: string[] };
  }>(`/v1/artifacts/${id}`);
}

export function diffArtifact(id: string, from: number, to: number) {
  return api<{ ok: boolean; diff: string }>(`/v1/artifacts/${id}/diff?from=${from}&to=${to}`);
}

export function restoreArtifact(id: string, version: number) {
  return api(`/v1/artifacts/${id}/restore`, { method: "POST", body: JSON.stringify({ version }) });
}

export function deleteArtifact(id: string) {
  return api(`/v1/artifacts/${id}`, { method: "DELETE" });
}

export function importArtifact(key: string, content: string, name: string) {
  return api(`/v1/import`, { method: "POST", body: JSON.stringify({ key, content, name }) });
}
