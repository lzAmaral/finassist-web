<script lang="ts">
  import { onMount } from 'svelte';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import {
    notificationKinds,
    weekdays,
    maskNotification,
    notificationDelivery,
    validateNotificationPreferences,
    notificationsRequest,
    type NotificationPreferences,
    type NotificationItem,
    type NotificationsData,
    type NotificationKind
  } from '#lib/notifications.js';

  let { available, hidden = false }: { available: boolean; hidden?: boolean } =
    $props();
  let data = $state<NotificationsData | null>(null);
  let draft = $state<NotificationPreferences | null>(null);
  let preview = $state<NotificationItem[] | null>(null);
  let hour = $state('09:00');
  let loading = $state(false),
    busy = $state(false),
    error = $state(''),
    message = $state('');
  const kinds = Object.keys(notificationKinds) as NotificationKind[];
  const display = (body: string) =>
    maskNotification(body, hidden || (draft?.hideAmounts ?? false));
  async function load() {
    loading = true;
    error = '';
    try {
      const payload =
        await notificationsRequest<NotificationsData>('/api/notifications');
      draft = structuredClone(payload.preferences);
      data = payload;
      hour = `${String(draft.hour).padStart(2, '0')}:${String(draft.minute).padStart(2, '0')}`;
    } catch (e) {
      error =
        e instanceof Error ? e.message : 'Falha ao carregar notificações.';
    } finally {
      loading = false;
    }
  }
  onMount(() => {
    if (available) void load();
  });
  function preferences(): NotificationPreferences | null {
    if (!draft) return null;
    const [h, m] = hour.split(':').map(Number);
    const next = {
      ...draft,
      hour: h,
      minute: m,
      weekday: Number(draft.weekday)
    };
    error = validateNotificationPreferences(next);
    return error ? null : next;
  }
  async function save() {
    error = '';
    message = '';
    const next = preferences();
    if (!next) return;
    busy = true;
    try {
      await notificationsRequest('/api/notifications/preferences', 'PUT', next);
      preview = null;
      await load();
      message =
        'Preferências salvas no Go. As próximas execuções usarão esta configuração.';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Falha ao salvar.';
    } finally {
      busy = false;
    }
  }
  async function showPreview() {
    error = '';
    message = '';
    const next = preferences();
    if (!next) return;
    busy = true;
    try {
      const result = await notificationsRequest<{
        notifications: NotificationItem[];
      }>('/api/notifications/preview', 'POST', next);
      preview = result.notifications;
      message =
        'Prévia com os dados atuais. Nenhum aviso foi gravado ou enviado.';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Falha na prévia.';
    } finally {
      busy = false;
    }
  }
  async function mark(item: NotificationItem, action: 'read' | 'dismiss') {
    error = '';
    busy = true;
    try {
      await notificationsRequest(
        `/api/notifications/${encodeURIComponent(item.id)}/${action}`,
        'POST',
        {}
      );
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Falha ao atualizar aviso.';
    } finally {
      busy = false;
    }
  }
</script>

<Card.Root class="min-w-0">
  <Card.Header>
    <Card.Title>Notificações</Card.Title>
    <Card.Description
      >Resumo semanal e avisos calculados pelas regras dos seus dados.</Card.Description
    >
  </Card.Header>
  <Card.Content class="space-y-5">
    {#if !available}
      <p class="text-sm text-muted-foreground">
        Notificações exigem o modo Go com PostgreSQL. No modo cloud, os dados
        permanecem disponíveis para consulta.
      </p>
    {:else}
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-muted-foreground">
          O agendador executa no servidor, mesmo com o navegador fechado.
        </p>
        <Button
          variant="outline"
          size="sm"
          onclick={load}
          disabled={loading || busy}>Recarregar</Button
        >
      </div>
      {#if error}<p
          role="alert"
          class="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
        </p>{/if}
      {#if message}<p role="status" class="text-sm text-muted-foreground">
          {message}
        </p>{/if}
      {#if loading && !data}<p role="status" class="text-sm">
          Carregando preferências e avisos…
        </p>{/if}
      {#if data && draft}
        <p class="rounded-lg bg-muted/40 p-3 text-sm">
          {data.schedulerRunning
            ? 'Agendador ativo no Go.'
            : 'Agendador ainda não está ativo; confirme o processo Go antes de esperar entregas.'}
          {data.telegramReady
            ? ' Telegram conectado.'
            : ' Telegram indisponível. Os avisos no aplicativo continuam disponíveis; nenhum envio externo é prometido.'}
        </p>
        <form
          onsubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          class="space-y-4"
        >
          <fieldset class="space-y-2" disabled={busy}>
            <legend class="mb-2 text-sm font-semibold">Tipos de aviso</legend>
            {#each kinds as kind}
              <label class="flex min-h-9 items-center gap-3 text-sm"
                ><input
                  type="checkbox"
                  bind:checked={draft.types[kind]}
                  class="size-4 accent-primary"
                />{notificationKinds[kind]}</label
              >
            {/each}
          </fieldset>
          <div class="grid gap-4 sm:grid-cols-3">
            <label class="space-y-1 text-sm"
              ><span class="block font-medium">Horário</span><input
                type="time"
                required
                bind:value={hour}
                class="w-full rounded-md border bg-background px-3 py-2"
              /></label
            >
            <label class="space-y-1 text-sm"
              ><span class="block font-medium">Fuso horário</span><input
                required
                bind:value={draft.timeZone}
                placeholder="America/Sao_Paulo"
                class="w-full rounded-md border bg-background px-3 py-2"
              /></label
            >
            <label class="space-y-1 text-sm"
              ><span class="block font-medium">Dia do resumo semanal</span
              ><select
                bind:value={draft.weekday}
                class="w-full rounded-md border bg-background px-3 py-2"
                >{#each weekdays as day, index}<option value={index}
                    >{day}</option
                  >{/each}</select
              ></label
            >
          </div>
          <p class="text-xs text-muted-foreground">
            Alertas são verificados diariamente após o horário escolhido.
            Compromissos lembram hoje ou amanhã; estimativas são identificadas.
            O resumo usa o dia escolhido. Cada aviso é gravado uma vez por
            identidade.
          </p>
          <label class="flex min-h-9 items-center gap-3 text-sm"
            ><input
              type="checkbox"
              bind:checked={draft.hideAmounts}
              class="size-4 accent-primary"
            />Ocultar valores nos avisos e no Telegram</label
          >
          <label class="flex min-h-9 items-center gap-3 text-sm"
            ><input
              type="checkbox"
              bind:checked={draft.telegram}
              disabled={!data.telegramReady && !draft.telegram}
              class="size-4 accent-primary"
            />Enviar também no Telegram já configurado</label
          >
          <p class="text-xs text-muted-foreground">
            Desativar um tipo ou o Telegram cancela seus envios pendentes.
            Falhas têm até três tentativas. Um envio interrompido sem
            confirmação fica como entrega incerta e não é repetido
            automaticamente.
          </p>
          <div class="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}
              >{busy ? 'Aguarde…' : 'Salvar preferências'}</Button
            ><Button
              type="button"
              variant="outline"
              onclick={showPreview}
              disabled={busy}>Ver prévia</Button
            >
          </div>
        </form>
        {#if preview !== null}
          <section
            aria-label="Prévia das notificações"
            class="space-y-3 rounded-xl border border-dashed p-4"
          >
            <h3 class="font-semibold">Prévia com os dados atuais</h3>
            {#if preview.length === 0}<p class="text-sm text-muted-foreground">
                Nenhum aviso aplicável aos tipos habilitados e aos dados atuais.
              </p>{/if}
            {#each preview as item}<article class="space-y-1">
                <p class="text-sm font-medium">{item.title}</p>
                <p
                  class="whitespace-pre-wrap break-words text-sm text-muted-foreground"
                >
                  {display(item.body)}
                </p>
              </article>{/each}
          </section>
        {/if}
        <section aria-label="Histórico de notificações" class="space-y-3">
          <h3 class="font-semibold">Avisos no aplicativo</h3>
          {#if data.notifications.length === 0}<p
              class="text-sm text-muted-foreground"
            >
              Nenhum aviso por aqui. Os próximos serão criados pelo agendador
              quando as regras e o horário se aplicarem.
            </p>{/if}
          {#each data.notifications as item (item.id)}
            <article class="space-y-2 rounded-xl border p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="text-sm font-semibold">
                  {item.title}{item.readAt ? '' : ' · Novo'}
                </h4>
                <time
                  class="text-xs text-muted-foreground"
                  datetime={item.createdAt}
                  >{new Date(item.createdAt).toLocaleString('pt-BR', {
                    timeZone: data.preferences.timeZone
                  })}</time
                >
              </div>
              <p
                class="whitespace-pre-wrap break-words text-sm text-muted-foreground"
              >
                {display(item.body)}
              </p>
              <p class="text-xs text-muted-foreground">
                {notificationDelivery(item)}
              </p>
              <div class="flex flex-wrap gap-2">
                {#if !item.readAt}<Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onclick={() => mark(item, 'read')}>Marcar como lido</Button
                  >{/if}<Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onclick={() => mark(item, 'dismiss')}>Dispensar</Button
                >
              </div>
            </article>
          {/each}
        </section>
      {/if}
    {/if}
  </Card.Content>
</Card.Root>
