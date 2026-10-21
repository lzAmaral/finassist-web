<script lang="ts">
  import { onMount } from 'svelte';
  import { money, monthLabel, percent, shiftMonth } from '#lib/finance.js';
  import { categoryOptions } from '#lib/category-review.js';
  import {
    currentPlanningMonth,
    goalKindLabels,
    goalStatus,
    planningRequest,
    validateGoal,
    type GoalDraft,
    type GoalKind,
    type GoalsData,
    type ProjectionData
  } from '#lib/planning.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Badge } from '#lib/components/ui/badge/index.js';

  let { enabled, hidden = false }: { enabled: boolean; hidden?: boolean } =
    $props();
  let data = $state<GoalsData | null>(null);
  let projection = $state<ProjectionData | null>(null);
  let loading = $state(false),
    saving = $state(false),
    deleting = $state(''),
    pendingDelete = $state('');
  let error = $state(''),
    message = $state(''),
    projectionError = $state('');
  let kind = $state<GoalKind>('SAVE'),
    name = $state(''),
    targetAmount = $state<number | undefined>();
  let targetDate = $state(shiftMonth(currentPlanningMonth(), 6)),
    category = $state('FOOD');
  let cutPercent = $state<number | undefined>(15),
    reserveMonths = $state<number | undefined>(6);
  const display = (value: number) => (hidden ? '••••••' : money(value));
  async function load() {
    loading = true;
    error = '';
    projectionError = '';
    const [goalsResult, projectionResult] = await Promise.allSettled([
      planningRequest<GoalsData>('/api/goals'),
      planningRequest<ProjectionData>('/api/projection?months=6')
    ]);
    if (goalsResult.status === 'fulfilled') data = goalsResult.value;
    else
      error =
        goalsResult.reason instanceof Error
          ? goalsResult.reason.message
          : 'Não foi possível carregar as metas.';
    if (projectionResult.status === 'fulfilled')
      projection = projectionResult.value;
    else {
      projection = null;
      projectionError =
        'As premissas de histórico estão indisponíveis. Tente recarregar.';
    }
    loading = false;
  }
  onMount(() => {
    if (enabled) void load();
  });
  async function create() {
    const draft: GoalDraft = {
      kind,
      name: name.trim(),
      ...(kind === 'SAVE'
        ? { targetAmount, targetDate }
        : kind === 'CUT'
          ? { category, cutPercent }
          : { reserveMonths })
    };
    error = validateGoal(draft);
    message = '';
    if (error) return;
    saving = true;
    try {
      await planningRequest('/api/goals', 'POST', draft);
      name = '';
      targetAmount = undefined;
      message = 'Meta salva. O acompanhamento usa os dados atuais do Go.';
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Não foi possível criar a meta.';
    } finally {
      saving = false;
    }
  }
  async function remove(id: string) {
    deleting = id;
    error = '';
    message = '';
    try {
      await planningRequest(`/api/goals/${encodeURIComponent(id)}`, 'DELETE');
      pendingDelete = '';
      message = 'Meta excluída.';
      await load();
    } catch (e) {
      error =
        e instanceof Error ? e.message : 'Não foi possível excluir a meta.';
    } finally {
      deleting = '';
    }
  }
</script>

<div class="space-y-5">
  {#if !enabled}
    <Card.Root class="shadow-none"
      ><Card.Header><Card.Title>Planeje suas metas</Card.Title></Card.Header
      ><Card.Content
        ><p class="text-sm text-muted-foreground">
          Criar e acompanhar metas requer o backend Go conectado e pronto. O
          modo cloud oferece consulta e sincronização; metas não estão
          disponíveis nessa fonte.
        </p></Card.Content
      ></Card.Root
    >
  {:else}
    <Card.Root class="shadow-none"
      ><Card.Header
        ><Card.Title>Uma intenção, um plano</Card.Title><Card.Description
          >Junte para uma conquista, acompanhe uma redução ou dimensione sua
          reserva.</Card.Description
        ></Card.Header
      ><Card.Content>
        <form
          class="grid gap-4 sm:grid-cols-2"
          onsubmit={(event) => {
            event.preventDefault();
            void create();
          }}
          aria-label="Criar meta"
        >
          <label class="grid gap-1.5 text-sm"
            >Tipo de meta<select bind:value={kind} disabled={saving}
              ><option value="SAVE">Juntar um valor</option><option value="CUT"
                >Reduzir gastos</option
              ><option value="RESERVE">Reserva de emergência</option></select
            ></label
          >
          <label class="grid gap-1.5 text-sm"
            >Nome<input
              bind:value={name}
              required
              maxlength="60"
              placeholder="Ex.: minha próxima viagem"
              disabled={saving}
            /></label
          >
          {#if kind === 'SAVE'}
            <label class="grid gap-1.5 text-sm"
              >Valor desejado (R$)<input
                class:masked={hidden}
                type="number"
                bind:value={targetAmount}
                required
                min="0.01"
                max="1000000000"
                step="0.01"
                inputmode="decimal"
                disabled={saving}
              /></label
            >
            <label class="grid gap-1.5 text-sm"
              >Mês do objetivo<input
                type="month"
                bind:value={targetDate}
                required
                min={shiftMonth(currentPlanningMonth(), 1)}
                max={shiftMonth(currentPlanningMonth(), 120)}
                disabled={saving}
              /></label
            >
          {:else if kind === 'CUT'}
            <label class="grid gap-1.5 text-sm"
              >Categoria<select bind:value={category} disabled={saving}
                >{#each categoryOptions as [value, label]}<option {value}
                    >{label}</option
                  >{/each}</select
              ></label
            >
            <label class="grid gap-1.5 text-sm"
              >Redução desejada (%)<input
                type="number"
                bind:value={cutPercent}
                required
                min="1"
                max="90"
                step="1"
                disabled={saving}
              /></label
            >
            <p class="sm:col-span-2 text-xs text-muted-foreground">
              A base é a média dos meses com gastos na categoria entre os três
              meses anteriores. Sem gastos nesse período, não é possível criar a
              redução. O teto é uma meta de acompanhamento, sem bloquear
              compras.
            </p>
          {:else}
            <label class="grid gap-1.5 text-sm"
              >Meses de despesas fixas<input
                type="number"
                bind:value={reserveMonths}
                required
                min="1"
                max="36"
                step="1"
                disabled={saving}
              /></label
            >
            <p class="self-center text-xs text-muted-foreground">
              O valor da reserva acompanha a estimativa de despesas fixas. Sem
              base de fixas, o objetivo fica sem valor calculável.
            </p>
          {/if}
          <div class="sm:col-span-2">
            <Button type="submit" disabled={saving || loading || !!deleting}
              >{saving ? 'Salvando…' : 'Criar meta'}</Button
            >
          </div>
        </form>
      </Card.Content></Card.Root
    >
    {#if message}<p role="status" class="text-sm">{message}</p>{/if}
    {#if error}<div
        role="alert"
        class="rounded-lg border border-destructive/40 p-4 text-sm"
      >
        <p>{error}</p>
        <Button
          class="mt-2"
          variant="outline"
          onclick={load}
          disabled={loading || saving || !!deleting}>Recarregar dados</Button
        >
      </div>{/if}
    {#if loading}<p role="status" class="text-sm text-muted-foreground">
        Atualizando metas…
      </p>{/if}
    {#if data}
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
      >
        <div>
          <p class="text-xs text-muted-foreground">
            Patrimônio de referência atual
          </p>
          <p class="text-xl font-semibold">{display(data.wealth)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onclick={load}
          disabled={loading || saving || !!deleting}>Atualizar metas</Button
        >
      </div>
      <p class="text-xs leading-relaxed text-muted-foreground">
        Metas de juntar e reserva usam a mesma base: contas correntes e
        investimentos no Go. Duas metas podem exibir o mesmo patrimônio; isso
        não separa nem reserva dinheiro para cada uma. A avaliação da sobra é
        individual e não garante que todos os aportes caibam juntos.
      </p>
      {#if projectionError}<p
          role="status"
          class="text-sm text-muted-foreground"
        >
          {projectionError}
        </p>{:else if projection && projection.assumptions.basedOn < 3}<p
          role="status"
          class="rounded-lg bg-muted/50 p-3 text-sm"
        >
          {projection.assumptions.basedOn === 0
            ? 'Histórico insuficiente para estimar sobra e reserva.'
            : `Histórico parcial: apenas ${projection.assumptions.basedOn} mês(es) com despesas sustentam as médias. Interprete as estimativas com cautela.`}
        </p>{/if}
      {#if data.goals.length === 0}<p
          class="rounded-lg border p-6 text-sm text-muted-foreground"
        >
          Nenhuma meta criada. Comece escolhendo um objetivo acima.
        </p>{/if}
      <div class="grid gap-4 lg:grid-cols-2">
        {#each data.goals as goal (goal.id)}
          <Card.Root class="min-w-0 shadow-none"
            ><Card.Header
              ><div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <Card.Description
                    >{goalKindLabels[goal.kind]}</Card.Description
                  ><Card.Title class="mt-1 break-words">{goal.name}</Card.Title>
                </div>
                <Badge variant="outline">{goalStatus(goal)}</Badge>
              </div></Card.Header
            ><Card.Content class="space-y-4">
              <div>
                <p class="text-xs text-muted-foreground">
                  {goal.kind === 'CUT'
                    ? `${goal.categoryLabel} · gasto no mês`
                    : 'Patrimônio de referência'}
                </p>
                <p class="text-xl font-semibold">
                  {display(goal.current)}
                  <span class="text-sm font-normal text-muted-foreground"
                    >/ {goal.target > 0
                      ? display(goal.target)
                      : 'Sem base calculável'}</span
                  >
                </p>
              </div>
              {#if goal.target > 0}<div
                  role="progressbar"
                  aria-label={goal.kind === 'CUT'
                    ? `Uso do teto: ${goal.name}`
                    : `Progresso: ${goal.name}`}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={Math.round(percent(goal.current, goal.target))}
                  aria-valuetext={hidden
                    ? 'Valor oculto'
                    : `${Math.round(percent(goal.current, goal.target))}%`}
                  class="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    class="h-full rounded-full bg-primary"
                    style:width={`${percent(goal.current, goal.target)}%`}
                  ></div>
                </div>{/if}
              {#if goal.kind === 'SAVE'}
                <dl class="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt class="text-muted-foreground">Prazo</dt>
                    <dd>
                      {goal.targetDate
                        ? monthLabel(goal.targetDate)
                        : 'Não informado'}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Necessário por mês</dt>
                    <dd>{display(goal.perMonth)}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Sobra mensal estimada</dt>
                    <dd>
                      {goal.surplus === null
                        ? 'Histórico insuficiente'
                        : display(goal.surplus)}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Meses restantes</dt>
                    <dd>{goal.monthsLeft}</dd>
                  </div>
                </dl>
                {#if !goal.done && goal.monthsLeft === 0}<p
                    class="text-xs text-muted-foreground"
                  >
                    O prazo chegou. O valor mensal mostra todo o montante ainda
                    necessário; exclua e recrie a meta para definir um novo
                    prazo.
                  </p>{/if}
                {#if goal.fits !== null}<p
                    class="text-xs text-muted-foreground"
                  >
                    {goal.fits
                      ? 'O aporte individual cabe na sobra estimada.'
                      : 'O aporte individual supera a sobra estimada; revise valor ou prazo.'}
                    A estimativa não é saldo disponível para gastar.
                  </p>{/if}
              {:else if goal.kind === 'RESERVE'}
                <p class="text-sm">
                  Objetivo: {goal.reserveMonths} mês(es) de despesas fixas. {goal.target >
                  0
                    ? `Cobertura atual: ${hidden ? '••••••' : goal.coverage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mês(es).`
                    : 'Sem despesas fixas estimadas para calcular a cobertura.'}
                </p>
                <p class="text-xs text-muted-foreground">
                  O patrimônio pode incluir investimentos sem liquidez imediata.
                  Esta comparação não confirma uma reserva disponível.
                </p>
              {:else}
                <p class="text-sm">
                  Reduzir {goal.cutPercent}% sobre a base de {display(
                    goal.baseline
                  )}. Teto mensal: {display(goal.target)}.
                </p>
                <p class="text-xs text-muted-foreground">
                  {goal.projected === null
                    ? 'O ritmo de fechamento aparece a partir do dia 7.'
                    : `Se o ritmo continuar, o mês pode fechar em ${display(goal.projected)} (dia ${goal.dayOfMonth} de ${goal.daysInMonth}).`}
                  O mês atual ainda está aberto.
                </p>
                <details>
                  <summary class="cursor-pointer text-sm font-medium"
                    >Histórico da redução ({goal.history.length})</summary
                  >
                  <ul class="mt-2 divide-y text-sm">
                    {#each goal.history as entry}<li
                        class="flex flex-wrap justify-between gap-2 py-2"
                      >
                        <span
                          >{monthLabel(entry.month)}{entry.month ===
                          currentPlanningMonth()
                            ? ' · em aberto'
                            : ''}</span
                        ><span
                          >{display(entry.total)} · {entry.hit
                            ? 'Dentro do teto'
                            : 'Acima do teto'}</span
                        >
                      </li>{/each}
                  </ul>
                </details>
              {/if}
              {#if pendingDelete === goal.id}<div
                  class="space-y-2 rounded-lg bg-muted/50 p-3"
                >
                  <p class="text-sm">Excluir a meta “{goal.name}”?</p>
                  <div class="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={!!deleting}
                      onclick={() => remove(goal.id)}
                      >{deleting === goal.id
                        ? 'Excluindo…'
                        : 'Confirmar exclusão'}</Button
                    ><Button
                      variant="outline"
                      size="sm"
                      disabled={!!deleting}
                      onclick={() => (pendingDelete = '')}>Cancelar</Button
                    >
                  </div>
                </div>{:else}<Button
                  variant="outline"
                  size="sm"
                  disabled={saving || loading || !!deleting}
                  onclick={() => (pendingDelete = goal.id)}
                  >Excluir<span class="sr-only"> meta {goal.name}</span></Button
                >{/if}
            </Card.Content></Card.Root
          >
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  input,
  select {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--background);
    padding: 0.6rem 0.75rem;
    color: inherit;
  }
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  input:disabled,
  select:disabled {
    opacity: 0.6;
  }
  .masked {
    -webkit-text-security: disc;
  }
</style>
