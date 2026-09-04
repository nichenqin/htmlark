<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from "@tanstack/svelte-query";
  import {
    deleteArtifact,
    diffArtifact,
    getArtifact,
    importArtifact,
    listArtifacts,
    restoreArtifact,
    type Artifact,
  } from "./api";

  const qc = useQueryClient();
  let search = $state("");
  let selected = $state<string | null>(null);
  let pin = $state<number | null>(null);
  let pane = $state<"preview" | "source" | "versions">("preview");
  let diffFrom = $state("");
  let key = $state("");
  let importError = $state<string | null>(null);
  let inspectW = $state(readInspectWidth());
  let dragging = $state(false);
  let bodyEl: HTMLDivElement | undefined;

  function readInspectWidth(): number {
    const n = Number(globalThis.localStorage?.getItem("htmlark-inspect-w"));
    return Number.isFinite(n) && n >= 280 && n <= 1200 ? n : 420;
  }

  function persistInspect() {
    globalThis.localStorage?.setItem("htmlark-inspect-w", String(inspectW));
  }

  function onSplitDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onSplitMove(e: PointerEvent) {
    if (!dragging || !bodyEl) return;
    const box = bodyEl.getBoundingClientRect();
    const next = box.right - e.clientX;
    inspectW = Math.round(Math.min(Math.max(next, 280), Math.max(280, box.width - 280)));
  }

  function onSplitUp() {
    if (!dragging) return;
    dragging = false;
    persistInspect();
  }

  const list = createQuery(() => ({
    queryKey: ["artifacts", search],
    queryFn: () => listArtifacts(search),
  }));

  const detail = createQuery(() => ({
    queryKey: ["artifact", selected],
    queryFn: () => getArtifact(selected as string),
    enabled: Boolean(selected),
  }));

  const head = $derived(detail.data?.artifact.version ?? 1);
  const viewVersion = $derived(pin ?? head);

  const diffQ = createQuery(() => ({
    queryKey: ["diff", selected, diffFrom, viewVersion],
    queryFn: () => diffArtifact(selected as string, Number(diffFrom), viewVersion),
    enabled: Boolean(selected && diffFrom && Number(diffFrom) !== viewVersion),
  }));

  const restoreM = createMutation(() => ({
    mutationFn: (version: number) => restoreArtifact(selected as string, version),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["artifacts"] });
      void qc.invalidateQueries({ queryKey: ["artifact", selected] });
    },
  }));

  const deleteM = createMutation(() => ({
    mutationFn: () => deleteArtifact(selected as string),
    onSuccess: () => {
      selected = null;
      void qc.invalidateQueries({ queryKey: ["artifacts"] });
    },
  }));

  const importM = createMutation(() => ({
    mutationFn: (input: { key: string; content: string; name: string }) =>
      importArtifact(input.key, input.content, input.name),
    onSuccess: () => {
      importError = null;
      key = "";
      void qc.invalidateQueries({ queryKey: ["artifacts"] });
    },
    onError: (err: Error) => {
      importError = err.message;
    },
  }));

  function pick(a: Artifact) {
    selected = a.id;
    pin = null;
    pane = "preview";
    diffFrom = "";
  }

  async function onFile(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const content = await file.text();
    const k = key.trim() || file.name.replace(/\.[^.]+$/, "");
    importM.mutate({ key: k, content, name: k });
  }
</script>

<div class="shell">
  <header class="top">
    <a class="wordmark" href="/">htmlark</a>
    <input class="search" bind:value={search} placeholder="Search name or id" />
    <input class="key" bind:value={key} placeholder="key" />
    <label class="import">
      Import
      <input type="file" accept=".html,.htm,.md,text/html,text/markdown" onchange={onFile} />
    </label>
  </header>
  {#if importError}
    <p class="err">{importError}</p>
  {/if}
  <div
    class="body"
    class:dragging
    bind:this={bodyEl}
    style:--inspect="{inspectW}px"
  >
    <div class="list">
      {#if list.isPending}
        <p class="mute">Loading library</p>
      {:else if list.isError}
        <p class="err">{list.error.message}</p>
      {:else if (list.data?.artifacts.length ?? 0) === 0}
        <p class="mute">Empty. Put a page with htmlark put --key, or Import.</p>
      {:else}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key / id</th>
              <th>v</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {#each list.data?.artifacts ?? [] as a (a.id)}
              <tr class:sel={selected === a.id} onclick={() => pick(a)}>
                <td>
                  {a.name}
                  {#if a.dirty}<span class="dirty">dirty</span>{/if}
                </td>
                <td class="mono">{a.id}</td>
                <td>{a.version}</td>
                <td class="mute">{a.updatedAt.slice(0, 16).replace("T", " ")}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
    <div
      class="split"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize inspector"
      aria-valuenow={inspectW}
      onpointerdown={onSplitDown}
      onpointermove={onSplitMove}
      onpointerup={onSplitUp}
      onpointercancel={onSplitUp}
      ondblclick={() => {
        inspectW = 420;
        persistInspect();
      }}
    ></div>
    <aside class="inspect">
      {#if !selected}
        <p class="mute pad">Select a page. The inspector shows the sandboxed render, source, and versions.</p>
      {:else if detail.isPending}
        <p class="mute pad">Loading</p>
      {:else if detail.data}
        {@const art = detail.data.artifact}
        <div class="frame">
          <div class="frame-bar" role="tablist">
            <button class="tab" type="button" role="tab" aria-selected={pane === "preview"} onclick={() => (pane = "preview")}>Preview</button>
            <button class="tab" type="button" role="tab" aria-selected={pane === "source"} onclick={() => (pane = "source")}>Source</button>
            <button class="tab" type="button" role="tab" aria-selected={pane === "versions"} onclick={() => (pane = "versions")}>Versions</button>
            <span class="meta">{art.name} · v{viewVersion}</span>
          </div>
          {#if pane === "preview"}
            <iframe title="preview" src="/render/{art.id}/{viewVersion}"></iframe>
          {:else if pane === "source"}
            <pre class="source">{detail.data.preview}</pre>
          {:else}
            <ul class="versions">
              {#each art.versions as v (v.version)}
                <li>
                  <button type="button" class:on={viewVersion === v.version} onclick={() => (pin = v.version)}>
                    v{v.version}{v.version === art.version ? " head" : ""}{v.dirty ? " dirty" : ""}{v.restoredFrom
                      ? ` from v${v.restoredFrom}`
                      : ""}
                  </button>
                </li>
              {/each}
            </ul>
            {#if art.versions.length > 1}
              <label class="difflab">
                Diff from
                <select bind:value={diffFrom}>
                  <option value="">none</option>
                  {#each art.versions as v (v.version)}
                    <option value={String(v.version)}>v{v.version}</option>
                  {/each}
                </select>
              </label>
              {#if diffQ.data?.diff}
                <pre class="source">{diffQ.data.diff}</pre>
              {/if}
            {/if}
          {/if}
        </div>
        <div class="actions">
          <a class="ghost" href="/a/{art.id}{pin ? `?v=${pin}` : ""}" target="_blank" rel="noreferrer">Open</a>
          <button type="button" onclick={() => restoreM.mutate(viewVersion)}>Restore v{viewVersion}</button>
          <button type="button" class="danger" onclick={() => deleteM.mutate()}>Delete</button>
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  :global(html, body, #app) {
    height: 100%;
    margin: 0;
  }
  :global(body) {
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
    background: #f6f7f8;
    color: #121417;
  }
  .shell {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 14px;
    border-bottom: 1px solid #d8dee6;
    background: #fff;
  }
  .wordmark {
    color: #121417;
    text-decoration: none;
    font-weight: 600;
    width: 88px;
  }
  .search {
    flex: 1;
  }
  .key {
    width: 140px;
  }
  input,
  select,
  button,
  .import {
    font: 500 13px/1.2 "IBM Plex Sans", ui-sans-serif, sans-serif;
    color: #121417;
    background: #fff;
    border: 1px solid #d8dee6;
    border-radius: 0;
    padding: 6px 8px;
  }
  input:focus-visible,
  select:focus-visible,
  button:focus-visible,
  .import:focus-within {
    outline: 2px solid #2f6fed;
    outline-offset: 1px;
  }
  .import {
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }
  .import input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .body {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) 6px var(--inspect, 420px);
    min-height: 0;
    flex: 1;
  }
  .body.dragging {
    cursor: col-resize;
    user-select: none;
  }
  .body.dragging iframe {
    pointer-events: none;
  }
  .split {
    cursor: col-resize;
    background: #d8dee6;
    touch-action: none;
  }
  .split:hover,
  .body.dragging .split {
    background: #2f6fed;
  }
  .list {
    overflow: auto;
    background: #fff;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    text-align: left;
    padding: 0 12px;
    height: 36px;
    border-bottom: 1px solid #e6ebf0;
    white-space: nowrap;
  }
  th {
    position: sticky;
    top: 0;
    background: #f6f7f8;
    color: #5c6570;
    font-weight: 500;
  }
  td.mono {
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 12px;
    color: #5c6570;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tr {
    cursor: pointer;
  }
  tr:hover td {
    background: #f0f3f6;
  }
  tr.sel td {
    background: #e8eefc;
  }
  .dirty {
    margin-left: 6px;
    color: #9a5b12;
    font-size: 11px;
  }
  .inspect {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #f6f7f8;
    padding: 12px;
    gap: 10px;
  }
  .frame {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid #d8dee6;
    border-radius: 8px;
    overflow: hidden;
  }
  .frame-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 8px;
    border-bottom: 1px solid #d8dee6;
    background: #f6f7f8;
  }
  .tab {
    border: 0;
    background: transparent;
    padding: 4px 8px;
    color: #5c6570;
  }
  .tab[aria-selected="true"] {
    color: #2f6fed;
    box-shadow: inset 0 -2px 0 #2f6fed;
  }
  .meta {
    margin-left: auto;
    color: #5c6570;
    font-size: 12px;
    font-family: "IBM Plex Mono", ui-monospace, monospace;
  }
  iframe {
    flex: 1;
    width: 100%;
    border: 0;
    background: #fff;
    min-height: 220px;
  }
  .source {
    flex: 1;
    margin: 0;
    padding: 12px;
    overflow: auto;
    font: 12px/1.45 "IBM Plex Mono", ui-monospace, monospace;
    background: #121417;
    color: #e8eaed;
  }
  .versions {
    list-style: none;
    margin: 0;
    padding: 8px;
  }
  .versions button {
    width: 100%;
    text-align: left;
    margin-bottom: 4px;
    background: #fff;
  }
  .versions button.on {
    border-color: #2f6fed;
    color: #2f6fed;
  }
  .difflab {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 0 8px 8px;
    color: #5c6570;
    font-size: 13px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .ghost {
    display: inline-flex;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid #d8dee6;
    color: #121417;
    text-decoration: none;
    background: #fff;
  }
  .danger {
    margin-left: auto;
    color: #8a1f1f;
    border-color: #e3b6b6;
  }
  button:active,
  .import:active,
  .ghost:active {
    transform: translateY(1px);
  }
  .err {
    margin: 0;
    padding: 8px 14px;
    color: #8a1f1f;
    background: #f8e8e8;
  }
  .mute {
    color: #5c6570;
    font-size: 13px;
  }
  .pad {
    padding: 16px;
  }
</style>
