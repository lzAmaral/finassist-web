<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head><title>Conexão · FinAssist</title></svelte:head>
<div class="auth-page">
  <div class="auth-card">
    <a class="brand" href="/">finassist.</a>
    <h1>
      {page.status === 404
        ? 'Esse caminho não existe.'
        : 'Precisamos verificar a conexão.'}
    </h1>
    <p>{page.error?.message}</p>
    <a class="primary-button" href="/">Voltar ao início →</a><a
      class="text-link"
      href="/login">Abrir meu acesso →</a
    >
  </div>
</div>
