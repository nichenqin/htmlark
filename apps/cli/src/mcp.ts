import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import {
  HtmlarkError,
  diffArtifacts,
  getArtifactCommand,
  listArtifacts,
  putArtifact,
  type ArtifactRepository,
  type ProjectArtifactRegistry,
} from "@htmlark/core";
import { openStore } from "./context.ts";

type Rpc = { jsonrpc: "2.0"; id?: number | string | null; method?: string; params?: Record<string, unknown> };

export function encodeMcp(message: unknown): Uint8Array {
  const json = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(`Content-Length: ${json.length}\r\n\r\n`, "utf8");
  return Buffer.concat([header, json]);
}

export async function handleMcpMessage(
  msg: Rpc,
  ctx: { repo: ArtifactRepository; registry: ProjectArtifactRegistry; projectRoot: string },
): Promise<unknown> {
  if (msg.method === "initialize") {
    return { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "htmlark", version: "0.1.0" } };
  }
  if (msg.method === "notifications/initialized" || msg.method === "ping") return {};
  if (msg.method === "tools/list") {
    return {
      tools: [
        { name: "htmlark_put", description: "Create or update an artifact. Always pass key and html content. No force." },
        { name: "htmlark_get" },
        { name: "htmlark_list" },
        { name: "htmlark_diff" },
      ],
    };
  }
  if (msg.method !== "tools/call") return {};
  const name = String(msg.params?.["name"] ?? "");
  const args = (msg.params?.["arguments"] ?? {}) as Record<string, unknown>;
  let result: unknown;
  if (name === "htmlark_put") {
    result = await putArtifact(ctx.repo, ctx.registry, {
      key: String(args["key"]),
      content: String(args["content"]),
      name: args["name"] ? String(args["name"]) : undefined,
      type: args["type"] === "markdown" ? "markdown" : "html",
      projectRoot: ctx.projectRoot,
    });
  } else if (name === "htmlark_get") {
    result = await getArtifactCommand(ctx.repo, { id: String(args["id"]), full: false });
  } else if (name === "htmlark_list") {
    result = await listArtifacts(ctx.repo, {
      search: args["search"] ? String(args["search"]) : undefined,
      limit: 50,
      offset: 0,
    });
  } else if (name === "htmlark_diff") {
    result = await diffArtifacts(ctx.repo, { id: String(args["id"]), from: Number(args["from"]), to: Number(args["to"]) });
  } else {
    throw new Error(`unknown tool ${name}`);
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}

function createServer(): McpServer {
  const ctx = openStore();
  const server = new McpServer({ name: "htmlark", version: "0.1.0" }, { capabilities: { tools: {} } });
  server.registerTool(
    "htmlark_put",
    {
      description: "Create or update an artifact. Always pass key and html content. No force.",
      inputSchema: z.object({
        key: z.string(),
        content: z.string(),
        name: z.string().optional(),
        type: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const result = await putArtifact(ctx.repo, ctx.registry, {
          key: args.key,
          content: args.content,
          name: args.name,
          type: args.type === "markdown" ? "markdown" : "html",
          projectRoot: ctx.projectRoot,
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        const message = err instanceof HtmlarkError ? JSON.stringify(err.toJSON()) : err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true };
      }
    },
  );
  server.registerTool(
    "htmlark_get",
    { description: "Get artifact metadata and truncated content", inputSchema: z.object({ id: z.string() }) },
    async (args) => {
      const result = await getArtifactCommand(ctx.repo, { id: args.id, full: false });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
  server.registerTool(
    "htmlark_list",
    { description: "List local artifacts", inputSchema: z.object({ search: z.string().optional() }) },
    async (args) => {
      const result = await listArtifacts(ctx.repo, { search: args.search, limit: 50, offset: 0 });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
  server.registerTool(
    "htmlark_diff",
    {
      description: "Diff two versions",
      inputSchema: z.object({ id: z.string(), from: z.number(), to: z.number() }),
    },
    async (args) => {
      const result = await diffArtifacts(ctx.repo, { id: args.id, from: args.from, to: args.to });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
  return server;
}

export async function runMcp(): Promise<void> {
  serveStdio(() => createServer());
  await new Promise<void>(() => undefined);
}
