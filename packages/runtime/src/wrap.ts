import { DEFAULT_TOKENS_CSS, HTMLARK_BRIDGE_PROTOCOL_VERSION, HTMLARK_BRIDGE_SOURCE } from "./constants.ts";
import { escapeHtml } from "./escape.ts";

const BOOTSTRAP = `<script data-htmlark-bootstrap>
(function(){
  var src=${JSON.stringify(HTMLARK_BRIDGE_SOURCE)};
  var ver=${HTMLARK_BRIDGE_PROTOCOL_VERSION};
  function ready(){
    try { parent.postMessage({source:src,type:'ready',protocolVersion:ver},'*'); } catch(e) {}
  }
  document.addEventListener('click', function(ev){
    var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^https?:/i.test(href)) {
      ev.preventDefault();
      parent.postMessage({source:src,type:'open',href:href},'*');
    }
  }, true);
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);
})();
</script>`;

export function injectTokensCss(html: string, css: string = DEFAULT_TOKENS_CSS): string {
  if (/<style[^>]*data-htmlark-tokens/i.test(html)) return html;
  const tag = `<style data-htmlark-tokens>${css}</style>`;
  const idx = html.toLowerCase().indexOf("</head>");
  if (idx === -1) return `<head>${tag}</head>${html}`;
  return html.slice(0, idx) + tag + html.slice(idx);
}

function injectHead(html: string, extra: string): string {
  const lower = html.toLowerCase();
  const headOpen = lower.indexOf("<head");
  if (headOpen === -1) {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${extra}</head><body>${html}</body></html>`;
  }
  const gt = html.indexOf(">", headOpen);
  return html.slice(0, gt + 1) + `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${extra}` + html.slice(gt + 1);
}

export function wrapArtifactDocument(input: {
  type: "html" | "markdown";
  title: string;
  content: string;
}): string {
  if (input.type === "markdown") {
    const body = `<article class="htmlark-md" style="white-space:pre-wrap">${escapeHtml(input.content)}</article>`;
    return injectTokensCss(
      `<!doctype html><html><head><title>${escapeHtml(input.title)}</title></head><body>${body}${BOOTSTRAP}</body></html>`,
    );
  }
  let html = input.content.trim();
  if (!/^<!doctype/i.test(html) && !/^<html/i.test(html)) {
    html = `<!doctype html><html><head><title>${escapeHtml(input.title)}</title></head><body>${html}</body></html>`;
  }
  html = injectHead(html, BOOTSTRAP);
  return injectTokensCss(html);
}
