<script lang="ts">
  type Artifact = { id: string; name: string; version: number; dirty: boolean; updatedAt?: string };
  let artifacts: Artifact[] = $state([]);
  let error: string | null = $state(null);

  async function load() {
    try {
      const token = document.querySelector('meta[name="htmlark-token"]')?.getAttribute("content") ?? "";
      const res = await fetch("/v1/artifacts", { headers: { "X-Htmlark-Token": token } });
      const body = (await res.json()) as { artifacts?: Artifact[]; error?: string };
      artifacts = body.artifacts ?? [];
      error = body.error ?? null;
    } catch (err) {
      error = err instanceof Error ? err.message : "load failed";
    }
  }

  $effect(() => {
    void load();
  });
</script>

<main>
  <h1>htmlark</h1>
  {#if error}
    <p class="err">{error}</p>
  {/if}
  <section class="grid">
    {#each artifacts as a (a.id)}
      <article class="card">
        <a href="/a/{a.id}">{a.name}</a>
        <p>v{a.version}{a.dirty ? " · dirty" : ""}</p>
      </article>
    {/each}
  </section>
</main>

<style>
  :global(body) {
    font-family: ui-sans-serif, system-ui, sans-serif;
    background: #111;
    color: #eee;
    margin: 24px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }
  .card {
    border: 1px solid #333;
    border-radius: 8px;
    padding: 16px;
    background: #1a1a1a;
  }
  a {
    color: #8ab4f8;
    font-weight: 600;
  }
  .err {
    color: #f28b82;
  }
</style>
