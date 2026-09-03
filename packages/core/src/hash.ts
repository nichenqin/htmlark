export async function sha256Hex(content: string | Uint8Array): Promise<string> {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashJson(hex: string): string {
  return `sha256:${hex}`;
}
