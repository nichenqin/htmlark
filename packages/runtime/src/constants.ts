export const HTMLARK_BRIDGE_SOURCE = "htmlark-runtime";
export const HTMLARK_BRIDGE_PROTOCOL_VERSION = 1;
export const HTMLARK_SANDBOX_CAPABILITIES = "allow-scripts allow-modals";
export const HTMLARK_VENDOR_PATH = "/vendor";
export const MAX_CONTENT_BYTES = 5 * 1024 * 1024;
export const MAX_SPEC_LENGTH = 256;
export const READY_TIMEOUT_MS = 15_000;

export const VENDOR_SPEC_RE =
  /^((?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?)\/((?:[\w.-]+\/)*[\w.-]+\.(?:js|mjs|css))$/;


export const CDN_HOSTS: Record<string, true> = {
  "unpkg.com": true,
  "cdn.jsdelivr.net": true,
  "cdnjs.cloudflare.com": true,
  "esm.sh": true,
  "ga.jspm.io": true,
};

export const DEFAULT_TOKENS_CSS = `:root {
  --htmlark-bg: #0f1115;
  --htmlark-fg: #e8eaed;
  --htmlark-muted: #9aa0a6;
  --htmlark-accent: #8ab4f8;
  --htmlark-border: #2a2f3a;
  --htmlark-font: ui-sans-serif, system-ui, sans-serif;
  --htmlark-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --htmlark-fs-sm: 0.875rem;
  --htmlark-fs-md: 1rem;
  --htmlark-fs-lg: 1.25rem;
  --htmlark-fs-xl: 1.75rem;
  --htmlark-space: 1rem;
  --htmlark-radius: 0.5rem;
  --htmlark-chart-1: #8ab4f8;
  --htmlark-chart-2: #81c995;
  --htmlark-chart-3: #fdd663;
  --htmlark-chart-4: #f28b82;
  --htmlark-chart-5: #c58af9;
  --artifact-bg: var(--htmlark-bg);
  --artifact-fg: var(--htmlark-fg);
}
html, body {
  background: var(--htmlark-bg);
  color: var(--htmlark-fg);
  font-family: var(--htmlark-font);
}
`;
