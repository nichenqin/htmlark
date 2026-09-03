import { Hono } from "hono";
import { HtmlarkError, sha256Hex } from "@htmlark/core";
import { SECURITY_HEADERS, renderArtifact, renderViewer } from "@htmlark/runtime";

export type PublishedMeta = {
  id: string;
  name: string;
  type: "html" | "markdown";
  headVersion: number;
  followLatest: boolean;
  sourcePublic: boolean;
  passwordHash: string | null;
  dirty: boolean;
  vendorSpecs: string[];
};

export type PublishedVersion = {
  version: number;
  name: string;
  type: "html" | "markdown";
  content: string;
  dirty: boolean;
};

export type PublishStore = {
  put(input: {
    meta: PublishedMeta;
    version: PublishedVersion;
    vendors: Record<string, string>;
  }): Promise<void>;
  getMeta(id: string): Promise<PublishedMeta | null>;
  getVersion(id: string, version: number): Promise<PublishedVersion | null>;
  listVersions(id: string): Promise<number[]>;
  delete(id: string): Promise<void>;
  getVendor(spec: string): Promise<Uint8Array | null>;
};

export type PublishDeps = {
  store: PublishStore;
  token: string;
  origin: string;
};

function json(c: { json: (body: unknown, status?: number) => Response }, body: unknown, status: number) {
  return c.json(body, status as 200);
}

function cookieName(id: string): string {
  return `htmlark_unlock_${id}`;
}

function unlocked(c: { req: { header: (n: string) => string | undefined } }, meta: PublishedMeta): boolean {
  if (!meta.passwordHash) return true;
  const cookie = c.req.header("cookie") ?? "";
  const want = `${cookieName(meta.id)}=`;
  for (const part of cookie.split(";")) {
    const p = part.trim();
    if (p.startsWith(want) && p.slice(want.length) === meta.passwordHash) return true;
  }
  return false;
}

function unlockPage(id: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unlock</title></head><body>
<form method="post" action="/a/${id}/unlock"><label>Password <input type="password" name="password" required></label>
<button type="submit">Unlock</button></form></body></html>`;
}

export function createPublishApp(deps: PublishDeps) {
  const app = new Hono()
    .use("/*", async (c, next) => {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.header(k, v);
      await next();
    })
    .onError((err, c) => {
      if (err instanceof HtmlarkError) return json(c, err.toJSON(), err.httpStatus);
      return json(c, { ok: false, error: err.message, code: "INTERNAL" }, 500);
    })
    .get("/health", (c) => json(c, { ok: true, public: true }, 200))
    .post("/v1/publish", async (c) => {
      const auth = c.req.header("authorization") ?? "";
      if (auth !== `Bearer ${deps.token}`) return json(c, { ok: false, error: "unauthorized", code: "VALIDATION" }, 401);
      const body = (await c.req.json()) as {
        id?: string;
        version?: number;
        name?: string;
        type?: "html" | "markdown";
        content?: string;
        followLatest?: boolean;
        dirty?: boolean;
        vendorSpecs?: string[];
        vendors?: Record<string, string>;
        sourcePublic?: boolean;
        passwordHash?: string | null;
      };
      if (!body.id || body.content == null || body.version == null) {
        return json(c, { ok: false, error: "id, version, content required", code: "VALIDATION" }, 400);
      }
      const type = body.type === "markdown" ? "markdown" : "html";
      await deps.store.put({
        meta: {
          id: body.id,
          name: body.name ?? "untitled",
          type,
          headVersion: body.version,
          followLatest: Boolean(body.followLatest),
          sourcePublic: body.sourcePublic !== false,
          passwordHash: body.passwordHash ?? null,
          dirty: Boolean(body.dirty),
          vendorSpecs: body.vendorSpecs ?? [],
        },
        version: {
          version: body.version,
          name: body.name ?? "untitled",
          type,
          content: body.content,
          dirty: Boolean(body.dirty),
        },
        vendors: body.vendors ?? {},
      });
      return json(c, { ok: true, id: body.id, url: `${deps.origin}/a/${body.id}` }, 200);
    })
    .delete("/v1/artifacts/:id", async (c) => {
      const auth = c.req.header("authorization") ?? "";
      if (auth !== `Bearer ${deps.token}`) return json(c, { ok: false, error: "unauthorized", code: "VALIDATION" }, 401);
      const id = c.req.param("id");
      const rec = await deps.store.getMeta(id);
      if (!rec) return json(c, { ok: false, error: "not published", code: "NOT_FOUND" }, 404);
      await deps.store.delete(id);
      return json(c, { ok: true, id }, 200);
    })
    .post("/a/:id/unlock", async (c) => {
      const id = c.req.param("id");
      const meta = await deps.store.getMeta(id);
      if (!meta) return json(c, { ok: false, error: "not published", code: "NOT_FOUND" }, 404);
      const ct = c.req.header("content-type") ?? "";
      let password = "";
      if (ct.includes("application/json")) {
        const body = (await c.req.json()) as { password?: string };
        password = body.password ?? "";
      } else {
        const form = await c.req.parseBody();
        password = String(form["password"] ?? "");
      }
      const hash = await sha256Hex(password);
      if (!meta.passwordHash || hash !== meta.passwordHash) {
        return json(c, { ok: false, error: "bad password", code: "VALIDATION" }, 401);
      }
      c.header("set-cookie", `${cookieName(id)}=${hash}; Path=/; HttpOnly; SameSite=Lax`);
      return c.redirect(`/a/${id}`);
    })
    .get("/a/:id", async (c) => {
      const meta = await deps.store.getMeta(c.req.param("id"));
      if (!meta) return json(c, { ok: false, error: "not published", code: "NOT_FOUND" }, 404);
      if (!unlocked(c, meta)) return c.html(unlockPage(meta.id), 401);
      const vq = c.req.query("v");
      const version = vq ? Number(vq) : meta.headVersion;
      const ver = await deps.store.getVersion(meta.id, version);
      if (!ver) return json(c, { ok: false, error: "version not published", code: "NOT_FOUND" }, 404);
      const rendered = renderViewer({
        title: ver.name,
        version,
        renderUrl: `${deps.origin}/render/${meta.id}/${version}`,
        dirty: ver.dirty,
        followHead: meta.followLatest && !vq,
        id: meta.id,
        sourcePublic: meta.sourcePublic,
      });
      c.header("Content-Security-Policy", rendered.csp);
      return c.html(rendered.body);
    })
    .get("/render/:id/:version", async (c) => {
      const meta = await deps.store.getMeta(c.req.param("id"));
      if (!meta) return json(c, { ok: false, error: "not published", code: "NOT_FOUND" }, 404);
      if (!unlocked(c, meta)) return json(c, { ok: false, error: "locked", code: "VALIDATION" }, 401);
      const version = Number(c.req.param("version"));
      const ver = await deps.store.getVersion(meta.id, version);
      if (!ver) return json(c, { ok: false, error: "version not published", code: "NOT_FOUND" }, 404);
      if (ver.dirty) {
        c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
        return c.html("<!doctype html><title>dirty</title><p>dirty version is not executed</p>", 409);
      }
      const rendered = renderArtifact({
        type: ver.type,
        title: ver.name,
        content: ver.content,
        frameAncestors: deps.origin,
      });
      c.header("Content-Security-Policy", rendered.csp);
      return c.html(rendered.body);
    })
    .get("/v1/artifacts/:id", async (c) => {
      const meta = await deps.store.getMeta(c.req.param("id"));
      if (!meta) return json(c, { ok: false, error: "not published", code: "NOT_FOUND" }, 404);
      if (!unlocked(c, meta)) return json(c, { ok: false, error: "locked", code: "VALIDATION" }, 401);
      const versions = await deps.store.listVersions(meta.id);
      const ver = await deps.store.getVersion(meta.id, meta.headVersion);
      return json(
        c,
        {
          ok: true,
          artifact: {
            id: meta.id,
            name: meta.name,
            version: meta.headVersion,
            sourcePublic: meta.sourcePublic,
            followLatest: meta.followLatest,
            versions: versions.map((v) => ({ version: v })),
          },
          preview: meta.sourcePublic ? (ver?.content ?? "") : "",
        },
        200,
      );
    })
    .get("/v1/artifacts/:id/versions/:n/raw", async (c) => {
      const meta = await deps.store.getMeta(c.req.param("id"));
      if (!meta) return json(c, { ok: false, error: "not published", code: "NOT_FOUND" }, 404);
      if (!unlocked(c, meta)) return json(c, { ok: false, error: "locked", code: "VALIDATION" }, 401);
      if (!meta.sourcePublic) return json(c, { ok: false, error: "source private", code: "VALIDATION" }, 403);
      const ver = await deps.store.getVersion(meta.id, Number(c.req.param("n")));
      if (!ver) return json(c, { ok: false, error: "version not published", code: "NOT_FOUND" }, 404);
      return new Response(ver.content, {
        headers: { "content-type": ver.type === "markdown" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8" },
      });
    })
    .get("/vendor/:spec{.+}", async (c) => {
      const spec = c.req.param("spec");
      const bytes = await deps.store.getVendor(spec);
      if (!bytes) return json(c, { ok: false, error: "not cached", code: "NOT_FOUND" }, 404);
      const type = spec.endsWith(".css") ? "text/css" : "application/javascript";
      return new Response(Buffer.from(bytes), { headers: { "content-type": type } });
    });

  return app;
}

export type PublishAppType = ReturnType<typeof createPublishApp>;
