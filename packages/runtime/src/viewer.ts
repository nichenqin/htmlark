import { HTMLARK_SANDBOX_CAPABILITIES, READY_TIMEOUT_MS } from "./constants.ts";
import { buildRenderCsp, buildShellCsp } from "./csp.ts";
import { escapeHtml } from "./escape.ts";
import { wrapArtifactDocument } from "./wrap.ts";

export function renderArtifact(input: {
  type: "html" | "markdown";
  title: string;
  content: string;
  frameAncestors: string;
}): { body: string; contentType: string; csp: string } {
  return {
    body: wrapArtifactDocument({ type: input.type, title: input.title, content: input.content }),
    contentType: "text/html; charset=utf-8",
    csp: buildRenderCsp({ frameAncestors: input.frameAncestors }),
  };
}

export function renderViewer(input: {
  title: string;
  version: number;
  renderUrl: string;
  dirty?: boolean;
  followHead?: boolean;
  id?: string;
  sourcePublic?: boolean;
}): { body: string; contentType: string; csp: string } {
  const title = escapeHtml(input.title);
  const renderUrl = new URL(input.renderUrl, "http://127.0.0.1").pathname + new URL(input.renderUrl, "http://127.0.0.1").search;
  const dirtyBanner = input.dirty
    ? `<div class="banner">This version is dirty and will not execute. Fix and put a clean version.</div>`
    : "";
  const follow = input.followHead !== false;
  const id = escapeHtml(input.id ?? "");
  const body = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background:#111; color:#eee; }
    header { display:flex; gap:8px; align-items:center; padding:8px 12px; border-bottom:1px solid #333; flex-wrap:wrap; }
    header h1 { font-size:14px; margin:0; flex:1; }
    nav button, nav a { background:#222; color:#eee; border:1px solid #444; padding:4px 8px; text-decoration:none; font:inherit; cursor:pointer; }
    nav button.active { background:#345; }
    .banner { background:#532; padding:8px 12px; }
    iframe { width:100%; height:calc(100vh - 48px); border:0; background:#fff; }
    pre { padding:16px; overflow:auto; white-space:pre-wrap; }
    .panel { display:none; }
    .panel.show { display:block; }
  </style>
</head>
<body>
  <header>
    <h1>${title} · v${input.version}${follow ? " · follow" : " · pinned"}</h1>
    <nav>
      <button data-tab="preview" class="active">Preview</button>
      <button data-tab="source">Source</button>
      <button data-tab="versions">Versions</button>
      <button data-tab="diff">Diff</button>
      <button id="copy">Copy</button>
      <a id="download" href="${escapeHtml(renderUrl.replace("/render/", "/v1/artifacts/").replace(/\/(\d+)$/, "/versions/$1/raw"))}">Download</a>
    </nav>
  </header>
  ${dirtyBanner}
  <div id="preview" class="panel show">
    ${
      input.dirty
        ? `<p style="padding:16px">Not executed. Run htmlark recipe doctor after fixing, or put a clean version.</p>`
        : `<iframe sandbox="${HTMLARK_SANDBOX_CAPABILITIES}" src="${escapeHtml(renderUrl)}"></iframe>`
    }
  </div>
  <pre id="source" class="panel">${input.sourcePublic === false ? "Source is private." : "Loading source…"}</pre>
  <pre id="versions" class="panel">Loading versions…</pre>
  <pre id="diff" class="panel">Loading diff…</pre>
  <script>
    const id = ${JSON.stringify(id)};
    const follow = ${follow ? "true" : "false"};
    const token = document.querySelector('meta[name="htmlark-token"]')?.content;
    const headers = token ? { 'X-Htmlark-Token': token } : {};
    document.querySelectorAll('nav button[data-tab]').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('nav button[data-tab]').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('show'); });
        document.getElementById(btn.getAttribute('data-tab')).classList.add('show');
      });
    });
    async function load(){
      const r = await fetch('/v1/artifacts/' + id, { headers: headers });
      if (!r.ok) return;
      const j = await r.json();
      document.getElementById('source').textContent = j.preview || '';
      document.getElementById('versions').textContent = JSON.stringify(j.artifact && j.artifact.versions, null, 2);
      const ver = j.artifact && j.artifact.version;
      if (ver > 1) {
        const d = await fetch('/v1/artifacts/' + id + '/diff?from=' + (ver - 1) + '&to=' + ver, { headers: headers });
        const dj = await d.json();
        document.getElementById('diff').textContent = dj.identical ? 'identical' : (dj.diff || '');
      } else {
        document.getElementById('diff').textContent = 'single version';
      }
      if (follow && j.artifact && ${input.version} !== j.artifact.version) {
        location.replace('/a/' + id);
      }
    }
    document.getElementById('copy').addEventListener('click', async function(){
      const t = document.getElementById('source').textContent;
      try { await navigator.clipboard.writeText(t); } catch(e) {}
    });
    let ready = false;
    window.addEventListener('message', function(ev){
      if (ev.data && ev.data.source === 'htmlark-runtime' && ev.data.type === 'ready') ready = true;
    });
    setTimeout(function(){
      if (ready) return;
      const b = document.createElement('div');
      b.className = 'banner';
      b.textContent = 'Preview did not signal ready within 15s';
      const header = document.querySelector('header');
      if (header && header.parentNode) header.parentNode.insertBefore(b, header.nextSibling);
    }, ${READY_TIMEOUT_MS});
    load();
    if (follow) setInterval(load, 1500);
  </script>
</body>
</html>`;
  return {
    body,
    contentType: "text/html; charset=utf-8",
    csp: buildShellCsp(),
  };
}
