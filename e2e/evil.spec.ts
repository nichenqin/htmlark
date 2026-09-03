import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { MemoryProjectArtifactRegistry, MemoryRepository, putArtifact } from "@htmlark/core";
import { createLocalApp } from "@htmlark/http";

async function listen(server: ReturnType<typeof createServer>, port: number): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.listen(port, "127.0.0.1", () => resolve());
  server.on("error", reject);
  await promise;
}

test("evil page cannot list create or update loopback API", async ({ page }) => {
  const repo = new MemoryRepository();
  const registry = new MemoryProjectArtifactRegistry();
  await putArtifact(repo, registry, {
    content: "<p style='color:var(--htmlark-fg)'>ok</p>",
    type: "html",
    name: "n",
  });
  const app = createLocalApp({
    repo,
    registry,
    token: "test-token",
    bindHost: "127.0.0.1",
    port: 7421,
    projectRoot: "/tmp",
    vendorGet: () => null,
  });
  const loopback = createServer(async (req, res) => {
    const url = `http://127.0.0.1:7421${req.url ?? "/"}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers.set(k, v);
    }
    let body: Buffer | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      body = Buffer.concat(chunks);
    }
    const request = new Request(url, { method: req.method, headers, body });
    const response = await app.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  const evil = createServer((_req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(`<!doctype html><script>
      const results = {};
      function rec(name, s){ results[name]=s; if(Object.keys(results).length===3) window.attack = results; }
      fetch('http://127.0.0.1:7421/v1/artifacts').then(r=>rec('list', r.status)).catch(()=>rec('list', 0));
      fetch('http://127.0.0.1:7421/v1/artifacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: '<p>hack</p>' })
      }).then(r=>rec('create', r.status)).catch(()=>rec('create', 0));
      fetch('http://127.0.0.1:7421/v1/artifacts/art_0000000000000000000000', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: '<p>hack</p>' })
      }).then(r=>rec('update', r.status)).catch(()=>rec('update', 0));
    </script>`);
  });
  await listen(loopback, 7421);
  await listen(evil, 7430);
  try {
    await page.goto("http://127.0.0.1:7430/");
    await page.waitForFunction(() => (window as unknown as { attack?: unknown }).attack !== undefined);
    const attack = await page.evaluate(() => (window as unknown as { attack: Record<string, number> }).attack);
    for (const key of ["list", "create", "update"]) {
      const status = attack[key] ?? -1;
      expect(status === 401 || status === 403 || status === 0).toBe(true);
    }
  } finally {
    loopback.close();
    evil.close();
  }
});
