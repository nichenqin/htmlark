import { Hono } from "hono";
import { HtmlarkError } from "@htmlark/core";
import { SECURITY_HEADERS, renderArtifact, renderViewer } from "@htmlark/runtime";

export type PublishedRecord = {
  id: string;
  version: number;
  name: string;
  type: "html" | "markdown";
  content: string;
  followLatest: boolean;
  dirty: boolean;
  vendorSpecs: string[];
  vendors: Record<string, string>;
};

export type PublishStore = {
  put(record: PublishedRecord): Promise<void>;
  get(id: string): Promise<PublishedRecord | null>;
  delete(id: string): Promise<void>;
};

export type PublishDeps = {
  store: PublishStore;
  token: string;
  origin: string;
};

function json(c: { json: (body: unknown, status?: number) => Response }, body: unknown, status: number) {
  return c.json(body, status as 200);
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
      const body = (await c.req.json()) as PublishedRecord;
      if (!body?.id || !body.content) return json(c, { ok: false, error: "id and content required", code: "VALIDATION" }, 400);
      await deps.store.put(body);
      return json(c, { ok: true, id: body.id, url: `${deps.origin}/a/${body.id}` }, 200);
    })
    .delete("/v1/artifacts/:id", async (c) => {
      const auth = c.req.header("authorization") ?? "";
      if (auth !== `Bearer ${deps.token}`) return json(c, { ok: false, error: "unauthorized", code: "VALIDATION" }, 401);
      const id = c.req.param("id");
      const rec = await deps.store.get(id);
      if (!rec) return json(c, { ok: false, error: "not published", code: "NOT_FOUND" }, 404);
      await deps.store.delete(id);
      return json(c, { ok: true, id }, 200);
    })
    .get("/a/:id", async (c) => {
      const rec = await deps.store.get(c.req.param("id"));
      if (!rec) return json(c, { ok: false, error: "not published", code: "NOT_FOUND" }, 404);
      const vq = c.req.query("v");
      const version = vq ? Number(vq) : rec.version;
      const rendered = renderViewer({
        title: rec.name,
        version,
        renderUrl: `${deps.origin}/render/${rec.id}/${version}`,
        dirty: rec.dirty,
        followHead: rec.followLatest && !vq,
        id: rec.id,
      });
      c.header("Content-Security-Policy", rendered.csp);
      return c.html(rendered.body);
    })
    .get("/render/:id/:version", async (c) => {
      const rec = await deps.store.get(c.req.param("id"));
      if (!rec) return json(c, { ok: false, error: "not published", code: "NOT_FOUND" }, 404);
      const version = Number(c.req.param("version"));
      if (version !== rec.version) return json(c, { ok: false, error: "version not published", code: "NOT_FOUND" }, 404);
      if (rec.dirty) {
        c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
        return c.html("<!doctype html><title>dirty</title><p>dirty version is not executed</p>", 409);
      }
      const rendered = renderArtifact({
        type: rec.type,
        title: rec.name,
        content: rec.content,
        frameAncestors: deps.origin,
      });
      c.header("Content-Security-Policy", rendered.csp);
      return c.html(rendered.body);
    })
    .get("/vendor/:spec{.+}", (c) => {
      return json(c, { ok: false, error: "not cached", code: "NOT_FOUND" }, 404);
    });

  return app;
}

export type PublishAppType = ReturnType<typeof createPublishApp>;
