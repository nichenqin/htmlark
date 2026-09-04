<script lang="ts">
  import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";
  import Admin from "./Admin.svelte";

  const client = new QueryClient();
</script>

<QueryClientProvider {client}>
  <Admin />
</QueryClientProvider>
