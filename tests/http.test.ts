import { describe, expect, test } from "bun:test";
import { HtmlarkError, MemoryProjectArtifactRegistry, MemoryRepository, putArtifact } from "@htmlark/core";
import { createLocalApp } from "@htmlark/http";

function app() {
  return createLocalApp({
    repo: new MemoryRepository(),
    registry: new MemoryProjectArtifactRegistry(),
    token: "secret-token",
    bindHost: "127.0.0.1",
    port: 7420,
    projectRoot: "/tmp",
    vendorGet: () => null,
  });
}

const loopback = { host: "127.0.0.1:7420" };

describe("createLocalApp D26", () => {
  test("rejects bad host", async () => {
    const res = await app().request("http://evil.example/health", { headers: { host: "evil.example" } });
    expect(res.status).toBe(400);
  });

  test("health on loopback", async () => {
    const res = await app().request("http://127.0.0.1:7420/health", { headers: loopback });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("mutation requires token", async () => {
    const res = await app().request("http://127.0.0.1:7420/v1/artifacts", {
      method: "POST",
      headers: { ...loopback, "content-type": "application/json" },
      body: JSON.stringify({ content: "<p>x</p>" }),
    });
    expect(res.status).toBe(401);
  });

  test("list requires token", async () => {
    const res = await app().request("http://127.0.0.1:7420/v1/artifacts", { headers: loopback });
    expect(res.status).toBe(401);
  });

  test("list with token", async () => {
    const res = await app().request("http://127.0.0.1:7420/v1/artifacts", {
      headers: { ...loopback, "x-htmlark-token": "secret-token" },
    });
    expect(res.status).toBe(200);
  });

  test("delete with token", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    const created = await putArtifact(repo, registry, {
      content: "<p style='color:var(--htmlark-fg)'>ok</p>",
      type: "html",
      name: "n",
    });
    const id = (created["artifact"] as { id: string }).id;
    const local = createLocalApp({
      repo,
      registry,
      token: "secret-token",
      bindHost: "127.0.0.1",
      port: 7420,
      projectRoot: "/tmp",
      vendorGet: () => null,
    });
    const res = await local.request(`http://127.0.0.1:7420/v1/artifacts/${id}`, {
      method: "DELETE",
      headers: { ...loopback, "x-htmlark-token": "secret-token" },
    });
    expect(res.status).toBe(200);
    await expect(repo.getArtifact(id)).rejects.toBeInstanceOf(HtmlarkError);
  });

  test("mutation requires json content-type", async () => {
    const res = await app().request("http://127.0.0.1:7420/v1/artifacts", {
      method: "POST",
      headers: { ...loopback, "content-type": "text/plain", "x-htmlark-token": "secret-token" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  test("rejects cross origin mutation", async () => {
    const res = await app().request("http://127.0.0.1:7420/v1/artifacts", {
      method: "POST",
      headers: {
        ...loopback,
        "content-type": "application/json",
        "x-htmlark-token": "secret-token",
        origin: "http://evil.example",
      },
      body: JSON.stringify({ content: "<p style='color:var(--htmlark-fg)'>x</p>", type: "html" }),
    });
    expect(res.status).toBe(403);
  });

  test("rejects CORS preflight", async () => {
    const res = await app().request("http://127.0.0.1:7420/v1/artifacts", {
      method: "OPTIONS",
      headers: loopback,
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("gallery does not innerHTML names", async () => {
    const repo = new MemoryRepository();
    const registry = new MemoryProjectArtifactRegistry();
    await putArtifact(repo, registry, {
      content: "<p style='color:var(--htmlark-fg)'>ok</p>",
      type: "html",
      name: "<img src=x onerror=alert(1)>",
    });
    const local = createLocalApp({
      repo,
      registry,
      token: "secret-token",
      bindHost: "127.0.0.1",
      port: 7420,
      projectRoot: "/tmp",
      vendorGet: () => null,
    });
    const res = await local.request("http://127.0.0.1:7420/", { headers: loopback });
    const html = await res.text();
    expect(html).not.toContain("innerHTML");
    expect(html).toContain("createElement");
  });
});
