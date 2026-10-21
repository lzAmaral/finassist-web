<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  interface Status {
    session: boolean;
    password?: { draft: boolean; current: boolean; fromEnv: boolean };
    channel?: { configured: boolean; canReplace: boolean };
    telegram?: {
      bot: string;
      candidate: { name: string; username: string } | null;
      accepted: boolean;
    };
  }
  let status = $state<Status | null>(null);
  let input = $state('');
  let message = $state('');
  let busy = $state(false);
  let phase = $derived(
    !status?.session
      ? 'token'
      : !(
            status.password?.draft ||
            status.password?.current ||
            status.password?.fromEnv
          )
        ? 'password'
        : status.channel?.configured
          ? 'keep'
          : !status.telegram?.bot
            ? 'bot'
            : status.telegram.accepted
              ? 'confirm'
              : status.telegram.candidate
                ? 'accept'
                : 'poll'
  );
  const labels: Record<string, string> = {
    token: 'Token da instalação',
    password: 'Crie sua senha (mínimo 12 caracteres)',
    bot: 'Token do seu bot Telegram',
    poll: 'Envie /start para o seu bot no Telegram',
    accept: 'Confirme que este usuário é você',
    confirm: 'Código recebido no Telegram',
    keep: 'Canal já configurado'
  };
  const actions: Record<string, string> = {
    token: 'Validar token',
    password: 'Salvar senha',
    bot: 'Conectar bot',
    poll: 'Buscar minha mensagem',
    accept: 'Sou eu, enviar código',
    confirm: 'Confirmar e concluir',
    keep: 'Concluir configuração'
  };
  async function refresh() {
    const res = await fetch('/api/setup/status');
    if (res.status === 404) {
      location.href = '/login';
      return;
    }
    const body = await res.json();
    if (!res.ok || body.problem)
      throw new Error(
        body.problem ?? body.error ?? 'Não foi possível consultar a instalação.'
      );
    status = body;
  }
  onMount(() => {
    if (data.configured) refresh().catch((e) => (message = e.message));
  });
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = '';
    try {
      const endpoints: Record<string, string> = {
        token: 'token',
        password: 'password',
        bot: 'telegram/bot',
        poll: 'telegram/poll',
        accept: 'telegram/accept',
        confirm: 'telegram/confirm',
        keep: 'keep'
      };
      const payload =
        phase === 'password'
          ? { password: input }
          : phase === 'confirm'
            ? { code: input }
            : ['token', 'bot'].includes(phase)
              ? { token: input }
              : {};
      const res = await fetch(`/api/setup/${endpoints[phase]}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error ?? 'Não foi possível concluir esta etapa.');
      input = '';
      if (phase === 'confirm' || phase === 'keep') {
        location.href = '/login';
        return;
      }
      await refresh();
      if (phase === 'poll')
        message =
          'Se a mensagem ainda não apareceu, envie /start ao bot e tente buscar novamente.';
    } catch (e) {
      message = e instanceof Error ? e.message : 'Falha de conexão.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head
  ><title>Primeiro acesso · FinAssist</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<div class="auth-page">
  <div class="auth-card">
    <a class="brand" href="/">finassist<span class="brand-dot">.</span></a>
    <h1>Vamos começar.</h1>
    <p>
      Configure seu acesso e confirme o seu Telegram. As credenciais ficam na
      sua instalação.
    </p>
    {#if data.configured}<div class="setup-steps">
        <span>1 · Instalação</span><span>2 · Senha</span><span
          >3 · Telegram</span
        >
      </div>
      <form onsubmit={submit}>
        <label for="setup-value">{labels[phase]}</label
        >{#if ['token', 'password', 'bot', 'confirm'].includes(phase)}<input
            id="setup-value"
            bind:value={input}
            type={phase === 'confirm' ? 'text' : 'password'}
            autocomplete={phase === 'password' ? 'new-password' : 'off'}
            required
            minlength={phase === 'password' ? 12 : phase === 'token' ? 24 : 1}
          />{:else if phase === 'poll'}<p>
            Bot: <strong>@{status?.telegram?.bot}</strong>. Após enviar /start,
            clique abaixo.
          </p>{:else if phase === 'accept'}<p>
            <strong>{status?.telegram?.candidate?.name}</strong> (@{status
              ?.telegram?.candidate?.username})
          </p>{/if}{#if phase === 'token'}<p style="margin-top:12px">
            Encontre <code>SETUP_TOKEN</code> no arquivo <code>.env</code> da instalação.
          </p>{/if}{#if message}<p class="error" role="status">
            {message}
          </p>{/if}<button class="primary-button" disabled={busy || !status}
          >{busy ? 'Aguarde...' : actions[phase]}</button
        >
      </form>{:else}<p class="error">
        A demonstração pública não está conectada ao seu backend. Configure
        FINASSIST_API_URL no servidor para habilitar o primeiro acesso.
      </p>
      <a class="primary-button" href="/">Explorar demonstração →</a>{/if}<a
      class="text-link"
      href="/login">Já configurei minha instalação →</a
    >
  </div>
</div>
