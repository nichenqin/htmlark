import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import {
  HtmlarkError,
  deleteArtifact,
  diffArtifacts,
  getArtifactCommand,
  importArtifact,
  listArtifacts,
  putArtifact,
  restoreArtifact,
  type ArtifactRepository,
  type ProjectArtifactRegistry,
} from "@htmlark/core";
import { SECURITY_HEADERS, inspectArtifact, renderArtifact, renderViewer } from "@htmlark/runtime";

export type LocalDeps = {
  repo: ArtifactRepository;
  registry: ProjectArtifactRegistry;
  token: string;
  bindHost: string;
  port: number;
  projectRoot: string;
  vendorGet: (spec: string) => Uint8Array | null;
  vendorPrefetch?: (specs: string[]) => Promise<void>;
  webRoot?: string;
};

function json(c: { json: (body: unknown, status?: number) => Response }, body: unknown, status: number) {
  return c.json(body, status as 200);
}

function loopbackOrigins(bindHost: string, port: number): Set<string> {
  return new Set([`http://${bindHost}:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`]);
}

export function createLocalApp(deps: LocalDeps) {
  const app = new Hono()
    .use("/*", async (c, next) => {
      const host = c.req.header("host") ?? "";
      const allowed = [`${deps.bindHost}:${deps.port}`, `localhost:${deps.port}`, `[::1]:${deps.port}`];
      if (!allowed.includes(host)) {
        return json(c, { ok: false, error: "bad host", code: "VALIDATION" }, 400);
      }
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.header(k, v);
      await next();
    })
    .use("/v1/*", async (c, next) => {
      if (c.req.path === "/v1/csp-report") {
        await next();
        return;
      }
      if (c.req.method === "OPTIONS") {
        return json(c, { ok: false, error: "cors", code: "VALIDATION" }, 403);
      }
      const isRaw = /\/versions\/\d+\/raw$/.test(c.req.path);
      const isGet = c.req.method === "GET" || c.req.method === "HEAD";
      if (isGet && isRaw) {
        await next();
        return;
      }
      if (!isGet && c.req.method !== "DELETE") {
        const ct = c.req.header("content-type") ?? "";
        if (!ct.includes("application/json")) {
          return json(c, { ok: false, error: "content-type", code: "VALIDATION" }, 400);
        }
      }
      if (!isGet) {
        const origin = c.req.header("origin");
        if (origin && !loopbackOrigins(deps.bindHost, deps.port).has(origin)) {
          return json(c, { ok: false, error: "origin", code: "VALIDATION" }, 403);
        }
      }
      if (c.req.header("x-htmlark-token") !== deps.token) {
        return json(c, { ok: false, error: "unauthorized", code: "VALIDATION" }, 401);
      }
      await next();
    })
    .onError((err, c) => {
      if (err instanceof HtmlarkError) return json(c, err.toJSON(), err.httpStatus);
      return json(c, { ok: false, error: err.message, code: "INTERNAL" }, 500);
    })
    .get("/health", (c) => json(c, { ok: true, schema: 1, bind: deps.bindHost, port: deps.port }, 200))
    .get("/", (c) => {
      c.header("Content-Security-Policy", "frame-ancestors 'none'");
      const index = deps.webRoot ? join(deps.webRoot, "index.html") : "";
      if (index && existsSync(index)) {
        let html = readFileSync(index, "utf8");
        if (!html.includes('name="htmlark-token"')) {
          html = html.replace("<head>", `<head><meta name="htmlark-token" content="${deps.token}">`);
        }
        return c.html(html);
      }
      return c.html(`<!doctype html><html><head><meta charset="utf-8"><meta name="htmlark-token" content="${deps.token}"><title>htmlark</title>
<style>body{font-family:sans-serif;background:#111;color:#eee;margin:24px}a{color:#8ab4f8}</style>
</head><body><h1>htmlark</h1><div id="list">loading…</div>
<script>
const token=document.querySelector('meta[name="htmlark-token"]').content;
fetch('/v1/artifacts',{headers:{'X-Htmlark-Token':token}}).then(r=>r.json()).then(j=>{
  const list=document.getElementById('list');
  list.textContent='';
  const arts=j.artifacts||[];
  if(!arts.length){ list.textContent='empty'; return; }
  for (const a of arts){
    const p=document.createElement('p');
    const link=document.createElement('a');
    link.href='/a/'+a.id;
    link.textContent=a.name;
    p.append(link, document.createTextNode(' v'+a.version+(a.dirty?' dirty':'')));
    list.append(p);
  }
});
</script></body></html>`);
    })
    .get("/assets/:file", (c) => {
      if (!deps.webRoot) return c.notFound();
      const file = c.req.param("file");
      if (file.includes("..") || file.includes("/") || file.includes("\\")) {
        return json(c, { ok: false, error: "bad path", code: "VALIDATION" }, 400);
      }
      const p = join(deps.webRoot, "assets", file);
      if (!existsSync(p)) return c.notFound();
      const type = file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : "application/octet-stream";
      return new Response(readFileSync(p), { headers: { "content-type": type } });
    })
    .get("/v1/artifacts", async (c) => {
      const url = new URL(c.req.url);
      const body = await listArtifacts(deps.repo, {
        search: url.searchParams.get("search") ?? undefined,
        tag: url.searchParams.get("tag") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 50),
        offset: Number(url.searchParams.get("offset") ?? 0),
      });
      return json(c, body, 200);
    })
    .post("/v1/artifacts", async (c) => {
      const body = await c.req.json();
      const content = String(body.content ?? "");
      const type = body.type === "markdown" ? "markdown" : "html";
      if (deps.vendorPrefetch) await deps.vendorPrefetch(inspectArtifact({ type, content }).vendorSpecs);
      const result = await putArtifact(deps.repo, deps.registry, {
        ...body,
        projectRoot: deps.projectRoot,
        content,
      });
      return json(c, result, 201);
    })
    .get("/v1/artifacts/:id", async (c) => {
      const id = c.req.param("id");
      const version = c.req.query("version");
      const full = c.req.query("full") === "1";
      const result = await getArtifactCommand(deps.repo, { id, version: version ? Number(version) : undefined, full });
      return json(c, result, 200);
    })
    .put("/v1/artifacts/:id", async (c) => {
      const id = c.req.param("id");
      const body = await c.req.json();
      const content = String(body.content ?? "");
      const type = body.type === "markdown" ? "markdown" : "html";
      if (deps.vendorPrefetch) await deps.vendorPrefetch(inspectArtifact({ type, content }).vendorSpecs);
      const result = await putArtifact(deps.repo, deps.registry, {
        ...body,
        id,
        projectRoot: deps.projectRoot,
        content,
      });
      return json(c, result, 200);
    })
    .get("/v1/artifacts/:id/versions/:n/raw", async (c) => {
      const id = c.req.param("id");
      const n = Number(c.req.param("n"));
      const ver = await deps.repo.readVersion(id, n);
      return new Response(ver.content, { headers: { "content-type": ver.type === "markdown" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8" } });
    })
    .get("/v1/artifacts/:id/diff", async (c) => {
      const id = c.req.param("id");
      const from = Number(c.req.query("from"));
      const to = Number(c.req.query("to"));
      return json(c, await diffArtifacts(deps.repo, { id, from, to }), 200);
    })
    .post("/v1/artifacts/:id/restore", async (c) => {
      const id = c.req.param("id");
      const body = await c.req.json();
      return json(c, await restoreArtifact(deps.repo, { id, version: Number(body.version), baseVersion: body.baseVersion }), 200);
    })
    .delete("/v1/artifacts/:id", async (c) => {
      const id = c.req.param("id");
      return json(c, await deleteArtifact(deps.repo, id), 200);
    })
    .post("/v1/import", async (c) => {
      const body = await c.req.json();
      return json(
        c,
        await importArtifact(deps.repo, deps.registry, {
          content: String(body.content ?? ""),
          name: body.name,
          key: body.key,
          projectRoot: deps.projectRoot,
        }),
        200,
      );
    })
    .post("/v1/csp-report", (c) => json(c, { ok: true }, 204))
    .get("/a/:id", async (c) => {
      const id = c.req.param("id");
      const vq = c.req.query("v");
      const head = await deps.repo.getArtifact(id);
      const version = vq ? Number(vq) : head.headVersion;
      const ver = await deps.repo.readVersion(id, version);
      const origin = `http://${deps.bindHost}:${deps.port}`;
      const rendered = renderViewer({
        title: ver.name,
        version,
        renderUrl: `${origin}/render/${id}/${version}`,
        dirty: ver.dirty,
        followHead: !vq,
        id,
      });
      c.header("Content-Security-Policy", rendered.csp);
      return c.html(rendered.body.replace("<head>", `<head><meta name="htmlark-token" content="${deps.token}">`));
    })
    .get("/render/:id/:version", async (c) => {
      const id = c.req.param("id");
      const version = Number(c.req.param("version"));
      const ver = await deps.repo.readVersion(id, version);
      if (ver.dirty) {
        c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
        return c.html("<!doctype html><title>dirty</title><p>dirty version is not executed</p>", 409);
      }
      const origin = `http://${deps.bindHost}:${deps.port}`;
      const rendered = renderArtifact({
        type: ver.type,
        title: ver.name,
        content: ver.content,
        frameAncestors: origin,
      });
      c.header("Content-Security-Policy", rendered.csp);
      return c.html(rendered.body);
    })
    .get("/vendor/:spec{.+}", (c) => {
      const spec = c.req.param("spec");
      const bytes = deps.vendorGet(spec);
      if (!bytes) return json(c, { ok: false, error: "not cached", code: "NOT_FOUND" }, 404);
      const type = spec.endsWith(".css") ? "text/css" : "application/javascript";
      return new Response(Buffer.from(bytes), { headers: { "content-type": type } });
    });
  return app;
}

export type LocalAppType = ReturnType<typeof createLocalApp>;
