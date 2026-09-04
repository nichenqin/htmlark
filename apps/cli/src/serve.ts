import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { HtmlarkError, type ArtifactRepository, type ProjectArtifactRegistry } from "@htmlark/core";
import { createLocalApp } from "@htmlark/http";
import { SqliteCasRepository } from "./adapters/sqlite-cas.ts";
import { prefetchVendors, vendorGet } from "./adapters/vendor-cache.ts";
import { defaultBind, defaultPort, htmlarkHome } from "./home.ts";
import { htmlarkSpawn } from "./self.ts";

function resolveWebRoot(): string | undefined {
  const here = import.meta.dirname;
  for (const p of [join(here, "admin"), join(here, "../../web/dist")]) {
    if (existsSync(join(p, "index.html"))) return p;
  }
  return undefined;
}

export function tokenPath(home: string): string {
  return join(home, "session.token");
}

export function pidPath(home: string): string {
  return join(home, "serve.pid");
}

export function loadOrCreateToken(home: string): string {
  const p = tokenPath(home);
  if (existsSync(p)) return readFileSync(p, "utf8").trim();
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
  writeFileSync(p, token, { mode: 0o600 });
  return token;
}

export async function startServer(opts: {
  repo: ArtifactRepository;
  registry: ProjectArtifactRegistry;
  projectRoot: string;
  port?: number;
  bind?: string;
}): Promise<{ port: number; token: string; url: string; already?: boolean }> {
  const home = htmlarkHome();
  const port = opts.port ?? defaultPort();
  const bind = opts.bind ?? defaultBind();
  const token = loadOrCreateToken(home);
  const url = `http://${bind}:${port}`;
  try {
    const r = await fetch(`${url}/health`);
    if (r.ok) {
      const body = (await r.json()) as { ok?: boolean };
      if (body.ok) return { port, token, url, already: true };
    }
  } catch {
    /* not htmlark */
  }
  const app = createLocalApp({
    repo: opts.repo,
    registry: opts.registry,
    token,
    bindHost: bind,
    port,
    projectRoot: opts.projectRoot,
    vendorGet: (spec) => {
      if (opts.repo instanceof SqliteCasRepository && !opts.repo.referencedVendorSpecs().has(spec)) return null;
      return vendorGet(home, spec);
    },
    vendorPrefetch: (specs) => prefetchVendors(home, specs),
    webRoot: resolveWebRoot(),
  });
  const server = createServer(async (req, res) => {
    const host = req.headers.host ?? `${bind}:${port}`;
    const reqUrl = `http://${host}${req.url ?? "/"}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers.set(k, v);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(reqUrl, { method: req.method, headers, body });
    const response = await app.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  });
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.listen(port, bind, () => resolve());
  server.on("error", reject);
  try {
    await promise;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "EADDRINUSE") {
      throw new HtmlarkError("VALIDATION", `port in use: ${bind}:${port}. Set HTMLARK_PORT.`, { port });
    }
    throw err;
  }
  writeFileSync(pidPath(home), String(process.pid));
  process.on("exit", () => {
    try {
      unlinkSync(pidPath(home));
    } catch {
      /* ignore */
    }
  });
  return { port, token, url };
}

export async function ensureServer(opts: {
  repo: ArtifactRepository;
  registry: ProjectArtifactRegistry;
  projectRoot: string;
}): Promise<{ url: string; token: string }> {
  const home = htmlarkHome();
  const port = defaultPort();
  const bind = defaultBind();
  const url = `http://${bind}:${port}`;
  try {
    const r = await fetch(`${url}/health`);
    if (r.ok) return { url, token: loadOrCreateToken(home) };
  } catch {
    /* not running */
  }
  const { command, args } = htmlarkSpawn(["serve", "--port", String(port), "--bind", bind]);
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, HTMLARK_HOME: home },
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await sleep(50);
    try {
      const r = await fetch(`${url}/health`);
      if (r.ok) return { url, token: loadOrCreateToken(home) };
    } catch {
      /* wait */
    }
  }
  throw new Error(`htmlark serve failed to start on ${url}`);
}
