export type Env = { DOWNLOADS: R2Bucket };

const TYPES: Record<string, string> = {
  ".tgz": "application/gzip",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".txt": "text/plain; charset=utf-8",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect("https://htmlark.com/install", 302);
    }
    const key = url.pathname.replace(/^\//, "");
    if (!key || key.includes("..") || key.includes("/")) {
      return new Response("not found", { status: 404 });
    }
    const obj = await env.DOWNLOADS.get(key);
    if (!obj) return new Response("not found", { status: 404 });
    const ext = key.slice(key.lastIndexOf("."));
    const type = TYPES[ext] ?? "application/octet-stream";
    return new Response(obj.body, {
      headers: {
        "content-type": type,
        "content-disposition": `attachment; filename="${key}"`,
        "cache-control": "public, max-age=3600",
      },
    });
  },
};
