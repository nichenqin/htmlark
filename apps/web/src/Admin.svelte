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
  let diffFrom = $state("");
  let key = $state("");
  let importName = $state("");
  let importError = $state<string | null>(null);

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
    mutationFn: (input: { key: string; content: string; name: string }) => importArtifact(input.key, input.content, input.name),
    onSuccess: () => {
      importError = null;
      key = "";
      importName = "";
      void qc.invalidateQueries({ queryKey: ["artifacts"] });
    },
    onError: (err: Error) => {
      importError = err.message;
    },
  }));

  function pick(a: Artifact) {
    selected = a.id;
    pin = null;
    diffFrom = "";
  }

  async function onFile(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const content = await file.text();
    const k = key.trim() || file.name.replace(/\.[^.]+$/, "");
    importM.mutate({ key: k, content, name: importName.trim() || k });
  }
</script>

<div class="shell">
  <aside>
    <div class="brand">htmlark</div>
    <nav>
      <span class="on">Artifacts</span>
    </nav>
    <p class="hint">Loopback admin. CLI remains the source of truth.</p>
  </aside>
  <section class="main">
    <header class="bar">
      <input bind:value={search} placeholder="Search name or id" />
      <label class="import">
        Import
        <input type="file" accept=".html,.htm,.md,text/html,text/markdown" onchange={onFile} />
      </label>
      <input class="key" bind:value={key} placeholder="import --key" />
    </header>
    {#if importError}
      <p class="err">{importError}</p>
    {/if}
    {#if list.isPending}
      <p class="mute">Loading…</p>
    {:else if list.isError}
      <p class="err">{list.error.message}</p>
    {:else}
      <div class="split">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Id</th>
              <th>Ver</th>
              <th>Type</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {#each list.data?.artifacts ?? [] as a (a.id)}
              <tr class:sel={selected === a.id} onclick={() => pick(a)}>
                <td>{a.name}{#if a.dirty}<span class="dirty"> dirty</span>{/if}</td>
                <td class="mono">{a.id}</td>
                <td>v{a.version}</td>
                <td>{a.type}</td>
                <td>{a.updatedAt.slice(0, 19).replace("T", " ")}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if selected && detail.data}
          {@const art = detail.data.artifact}
          <div class="detail">
            <div class="detail-h">
              <strong>{art.name}</strong>
              <a href="/a/{art.id}{pin ? `?v=${pin}` : ""}" target="_blank" rel="noreferrer">Open viewer</a>
            </div>
            <p class="mono">{art.id}</p>
            <div class="vers">
              {#each art.versions as v (v.version)}
                <button type="button" class:on={viewVersion === v.version} onclick={() => (pin = v.version)}>
                  v{v.version}{#if v.dirty}*{/if}
                </button>
              {/each}
            </div>
            <iframe title="preview" src="/render/{art.id}/{viewVersion}"></iframe>
            <pre class="src">{detail.data.preview}</pre>
            {#if art.versions.length > 1}
              <label>
                Diff from
                <select bind:value={diffFrom}>
                  <option value="">—</option>
                  {#each art.versions as v (v.version)}
                    <option value={String(v.version)}>v{v.version}</option>
                  {/each}
                </select>
              </label>
              {#if diffQ.data?.diff}
                <pre class="src">{diffQ.data.diff}</pre>
              {/if}
            {/if}
            <div class="actions">
              <button type="button" onclick={() => restoreM.mutate(viewVersion)}>Restore v{viewVersion}</button>
              <button type="button" class="danger" onclick={() => deleteM.mutate()}>Delete</button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </section>
</div>

<style>
  :global(html, body, #app) {
    height: 100%;
    margin: 0;
  }
  :global(body) {
    font-family: ui-sans-serif, system-ui, sans-serif;
    background: #0f1114;
    color: #e8eaed;
  }
  .shell {
    display: grid;
    grid-template-columns: 200px 1fr;
    height: 100%;
  }
  aside {
    border-right: 1px solid #2a2e34;
    padding: 16px 12px;
    background: #16181c;
  }
  .brand {
    font-weight: 650;
    margin-bottom: 18px;
  }
  nav .on {
    display: block;
    padding: 6px 8px;
    background: #2a3140;
    border-radius: 4px;
  }
  .hint {
    color: #8b919a;
    font-size: 12px;
    margin-top: 24px;
  }
  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .bar {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid #2a2e34;
  }
  input,
  select,
  button {
    font: inherit;
    color: inherit;
    background: #1c1f24;
    border: 1px solid #3a4048;
    border-radius: 4px;
    padding: 6px 8px;
  }
  .bar input {
    flex: 1;
  }
  .key {
    max-width: 180px;
  }
  .import {
    position: relative;
    overflow: hidden;
    padding: 6px 10px;
    border: 1px solid #3a4048;
    border-radius: 4px;
    cursor: pointer;
  }
  .import input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid #2a2e34;
  }
  th {
    color: #8b919a;
    font-weight: 550;
  }
  tr {
    cursor: pointer;
  }
  tr.sel,
  tr:hover {
    background: #1c222b;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: #9aa3ad;
  }
  .dirty {
    color: #e0a154;
  }
  .split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 420px;
    min-height: 0;
    flex: 1;
  }
  .detail {
    border-left: 1px solid #2a2e34;
    padding: 12px;
    overflow: auto;
  }
  .detail-h {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  a {
    color: #8ab4f8;
  }
  .vers {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 8px 0;
  }
  .vers button.on {
    background: #2f6fed;
    border-color: #2f6fed;
  }
  iframe {
    width: 100%;
    height: 220px;
    border: 1px solid #2a2e34;
    background: #fff;
  }
  .src {
    max-height: 180px;
    overflow: auto;
    background: #12141a;
    padding: 8px;
    font-size: 11px;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .danger {
    border-color: #8a3030;
    color: #f0a0a0;
  }
  .err {
    color: #f28b82;
    padding: 0 12px;
  }
  .mute {
    color: #8b919a;
    padding: 12px;
  }
</style>
