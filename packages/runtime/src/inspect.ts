import { CDN_HOSTS, MAX_CONTENT_BYTES, MAX_SPEC_LENGTH, VENDOR_SPEC_RE } from "./constants.ts";

export type InspectionResult = {
  rejected: boolean;
  errors: string[];
  warnings: string[];
  vendorSpecs: string[];
};

const CHROME_FIXTURES = [".traffic-lights", ".window-controls", ".fake-address-bar", ".browser-chrome"];

export function inspectArtifact(input: { type: "html" | "markdown"; content: string }): InspectionResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const vendorSpecs: string[] = [];
  const content = input.content;

  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    errors.push("size: exceeds 5MB");
  }

  if (input.type === "markdown") {
    return { rejected: errors.length > 0, errors, warnings, vendorSpecs };
  }

  for (const host of Object.keys(CDN_HOSTS)) {
    if (content.includes(host)) errors.push(`cdn: ${host}`);
  }

  const srcRe = /<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = srcRe.exec(content))) {
    const url = m[1] ?? "";
    if (/^https?:\/\//i.test(url)) {
      errors.push(`external: ${url}`);
    } else if (url.startsWith("/vendor/")) {
      const spec = url.slice("/vendor/".length);
      if (spec.length > MAX_SPEC_LENGTH || !VENDOR_SPEC_RE.test(spec)) {
        errors.push(`vendor-spec: ${spec}`);
      } else {
        vendorSpecs.push(spec);
      }
    }
  }

  if (/<(iframe|object|embed)\b/i.test(content)) {
    errors.push("embed: iframe/object/embed forbidden");
  }

  if (/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(content)) {
    warnings.push("network-api: fetch/XHR/WebSocket/sendBeacon substring");
  }
  if (/<script\b[^>]*>[\s\S]*?\b(const|let)\b/.test(content)) {
    warnings.push("classic-script: top-level const/let");
  }
  if (!/--htmlark-/.test(content) && !/--artifact-/.test(content)) {
    warnings.push("tokens: unused --htmlark-* / --artifact-*");
  }
  if (/data:[^;]+;base64,[A-Za-z0-9+/=]{1000000,}/.test(content)) {
    warnings.push("inline-base64: >1MB");
  }
  const chromeHits = CHROME_FIXTURES.filter((sel) => content.includes(sel.slice(1)) || content.includes(sel));
  if (chromeHits.length >= 2) warnings.push("chrome-fixture: fake browser chrome");

  return { rejected: errors.length > 0, errors, warnings, vendorSpecs: [...new Set(vendorSpecs)] };
}

export const qualityScan = inspectArtifact;
