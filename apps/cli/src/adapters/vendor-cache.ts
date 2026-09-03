import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promises as dns } from "node:dns";
import { HtmlarkError } from "@htmlark/core";
import { inspectArtifact, VENDOR_SPEC_RE } from "@htmlark/runtime";

const inflight = new Map<string, Promise<void>>();

export function vendorPath(home: string, spec: string): string | null {
  const m = spec.match(VENDOR_SPEC_RE);
  if (!m) return null;
  const pkg = m[1];
  const ver = m[2];
  const file = m[3];
  if (!pkg || !ver || !file) return null;
  return join(home, "vendor", `${pkg}@${ver}`, file);
}

export function vendorGet(home: string, spec: string): Uint8Array | null {
  const p = vendorPath(home, spec);
  if (!p || !existsSync(p)) return null;
  return readFileSync(p);
}

export function isBlockedIp(ip: string): boolean {
  const v4mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped?.[1]) return isBlockedIp(v4mapped[1]);
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === undefined || b === undefined) return false;
  if (a === 10 || a === 127 || a === 0 || a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function vendorCdn(): string {
  return process.env["HTMLARK_VENDOR_CDN"] ?? "https://unpkg.com";
}

export function allowPrivate(): boolean {
  return process.env["HTMLARK_VENDOR_ALLOW_PRIVATE"] === "1";
}

function assertSafeHost(hostname: string, allowedHost: string): void {
  if (hostname !== allowedHost) {
    throw new HtmlarkError("VALIDATION", "vendor redirect left CDN host", { hostname, allowedHost });
  }
}

export async function prefetchVendor(
  home: string,
  spec: string,
  opts: {
    lookup?: (host: string) => Promise<string[]>;
    fetch?: (input: URL, init?: RequestInit) => Promise<Response>;
    cdn?: string;
    allowPrivate?: boolean;
  } = {},
): Promise<void> {
  if (!VENDOR_SPEC_RE.test(spec)) throw new HtmlarkError("VALIDATION", "bad vendor spec", { spec });
  const dest = vendorPath(home, spec);
  if (!dest) throw new HtmlarkError("VALIDATION", "bad vendor spec", { spec });
  if (existsSync(dest)) return;
  const existing = inflight.get(spec);
  if (existing) return existing;
  const run = (async () => {
    const cdn = opts.cdn ?? vendorCdn();
    const base = new URL(cdn);
    if (base.protocol !== "https:") throw new HtmlarkError("VALIDATION", "vendor CDN must be https", { cdn });
    let url = new URL(`${base.origin}/${spec}`);
    const lookup =
      opts.lookup ??
      (async (host: string) => {
        const v4 = await dns.lookup(host, { all: true, verbatim: true });
        return v4.map((r) => r.address);
      });
    const fetchFn = opts.fetch ?? fetch;
    const privateOk = opts.allowPrivate ?? allowPrivate();
    let res: Response | undefined;
    for (let hop = 0; hop < 5; hop++) {
      assertSafeHost(url.hostname, base.hostname);
      if (url.protocol !== "https:") throw new HtmlarkError("VALIDATION", "vendor CDN must be https", { spec });
      const addrs = await lookup(url.hostname);
      if (!privateOk) {
        for (const addr of addrs) {
          if (isBlockedIp(addr)) throw new HtmlarkError("VALIDATION", "vendor SSRF blocked address", { spec, addr });
        }
      }
      res = await fetchFn(url, { redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new HtmlarkError("VALIDATION", "vendor redirect missing location", { spec });
        url = new URL(loc, url);
        continue;
      }
      break;
    }
    if (!res) throw new HtmlarkError("VALIDATION", "vendor fetch failed", { spec });
    const ct = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    const okType =
      ct === "application/javascript" ||
      ct === "text/javascript" ||
      ct === "application/x-javascript" ||
      ct === "text/css";
    if (!okType) throw new HtmlarkError("VALIDATION", "vendor content-type rejected", { spec, contentType: ct });
    if (!res.ok) throw new HtmlarkError("VALIDATION", "vendor fetch status", { spec, status: res.status });
    const bytes = Buffer.from(await res.arrayBuffer());
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, bytes);
  })();
  inflight.set(spec, run);
  try {
    await run;
  } finally {
    inflight.delete(spec);
  }
}

export async function prefetchVendors(home: string, specs: string[]): Promise<void> {
  for (const spec of specs) await prefetchVendor(home, spec);
}

export async function prefetchFromContent(home: string, type: "html" | "markdown", content: string): Promise<void> {
  const inspection = inspectArtifact({ type, content });
  await prefetchVendors(home, inspection.vendorSpecs);
}
