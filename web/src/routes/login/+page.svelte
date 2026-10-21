<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  let password = $state('');
  let code = $state('');
  let step = $state<'password' | 'code'>('password');
  let message = $state('');
  let busy = $state(false);
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = '';
    try {
      const res = await fetch(
        step === 'password' ? '/api/login' : '/api/login/code',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(step === 'password' ? { password } : { code })
        }
      );
      const body = await res.json();
      if (res.status === 409) {
        location.href = '/setup';
        return;
      }
      if (!res.ok) throw new Error(body.error ?? 'Não foi possível entrar.');
      if (body.step === 'code') {
        step = 'code';
        password = '';
      } else location.href = '/';
    } catch (e) {
      message = e instanceof Error ? e.message : 'Falha de conexão.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head
  ><title>Entrar · FinAssist</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<div class="auth-page">
  <div class="auth-card">
    <a class="brand" href="/">finassist<span class="brand-dot">.</span></a>
    <h1>Seu espaço, de volta.</h1>
    <p>
      {step === 'code'
        ? 'Digite o código enviado pelo FinAssist ao seu chat.'
        : 'Entre para acompanhar seu dinheiro com mais clareza.'}
    </p>
    {#if data.configured}<form onsubmit={submit}>
        {#if step === 'password'}<label for="password">Sua senha</label><input
            id="password"
            type="password"
            bind:value={password}
            autocomplete="current-password"
            required
            minlength="12"
          />{:else}<label for="code">Código de confirmação</label><input
            id="code"
            bind:value={code}
            inputmode="numeric"
            autocomplete="one-time-code"
            required
          />{/if}{#if message}<p class="error" role="alert">
            {message}
          </p>{/if}<button class="primary-button" disabled={busy}
          >{busy ? 'Conectando...' : 'Entrar no meu espaço →'}</button
        >
      </form>
      <a class="text-link" href="/setup"
        >Primeiro acesso? Configurar instalação ↗</a
      >{:else}<p class="error">
        O acesso estará disponível quando a conexão com sua instalação estiver
        configurada.
      </p>
      <a class="primary-button" href="/">Voltar ao painel →</a>{/if}
  </div>
</div>
