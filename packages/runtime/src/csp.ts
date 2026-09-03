import { HTMLARK_SANDBOX_CAPABILITIES } from "./constants.ts";

export function buildRenderCsp(opts: { frameAncestors: string }): string {
  const ancestors = opts.frameAncestors === "*" ? "'none'" : opts.frameAncestors;
  return [
    `sandbox ${HTMLARK_SANDBOX_CAPABILITIES}`,
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src data: blob: 'self'",
    "font-src data:",
    "connect-src 'none'",
    "media-src data: blob:",
    `frame-ancestors ${ancestors}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "report-uri /v1/csp-report",
  ].join("; ");
}

export function buildShellCsp(): string {
  return "frame-ancestors 'none'; default-src 'self' 'unsafe-inline'; img-src data: blob: 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'";
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "private, no-store",
};
