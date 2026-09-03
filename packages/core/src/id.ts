const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const DECODE: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  const ch = ALPHABET[i];
  if (ch) DECODE[ch] = i;
}
DECODE["I"] = 1;
DECODE["L"] = 1;
DECODE["O"] = 0;

export const ID_RE = /^art_[0-9A-HJKMNP-TV-Z]{22}$/;

export function encodeId(bytes: Uint8Array): string {
  if (bytes.length !== 14) throw new Error("id bytes must be 14");
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  n >>= 2n;
  let out = "";
  for (let i = 21; i >= 0; i--) {
    out += ALPHABET[Number((n >> BigInt(5 * i)) & 31n)];
  }
  return `art_${out}`;
}

export function generateId(random: () => Uint8Array = () => crypto.getRandomValues(new Uint8Array(14))): string {
  return encodeId(random());
}

export function isArtifactId(id: string): boolean {
  return ID_RE.test(id);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replaceAll(" ", "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
