<script lang="ts">
  import type { Dashboard } from '#lib/finance.js';
  import { money } from '#lib/finance.js';
  import {
    CONCENTRATION_GROUP_LIMIT,
    concentrationAccountLabel,
    concentrationEvidencePage,
    concentrationGroups,
    spendingConcentration
  } from '#lib/spending-concentration.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';

  let {
    dashboard,
    hidden = false
  }: { dashboard: Dashboard; hidden?: boolean } = $props();
  const instanceId = $props.id();
  let analysis = $derived(spendingConcentration(dashboard));
  let showAll = $state(false);
  let expanded = $state<Record<string, boolean>>({});
  let pages = $state<Record<string, number>>({});
  let groups = $derived(
    analysis.available ? concentrationGroups(analysis.groups, showAll) : []
  );
  $effect.pre(() => {
    dashboard.month;
    showAll = false;
    expanded = {};
    pages = {};
  });
  const display = (cents: number) => (hidden ? '••••••' : money(cents / 100));
  const displayPercent = (value: number | null) =>
    hidden
      ? '••••'
      : value === null
        ? 'Sem base de compras'
        : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const displayDate = (date: string) =>
    `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
  function toggle(key: string) {
    expanded[key] = !expanded[key];
    if (expanded[key]) pages[key] = 1;
  }
</script>

<Card.Root class="min-w-0 shadow-none">
  <Card.Header>
    <Card.Title>Concentração de despesas</Card.Title>
    <Card.Description
      >Compras confirmadas agrupadas pela descrição exata no extrato e pela
      conta.</Card.Description
    >
  </Card.Header>
  <Card.Content class="min-w-0 space-y-4">
    <p class="text-sm text-muted-foreground">
      Descrições diferentes podem corresponder ao mesmo fornecedor; este
      agrupamento não identifica assinaturas. Entram apenas despesas confirmadas
      do mês selecionado. Receitas, transferências e pendências ficam fora.
    </p>
    {#if !analysis.available}
      <p role="status" class="rounded-lg border p-3 text-sm">
        {#if analysis.reason === 'unconfigured'}
          Conecte uma conta ou registre lançamentos para conferir a concentração
          de despesas.
        {:else if analysis.reason === 'invalid-month'}
          Não foi possível analisar o mês selecionado. Escolha um mês válido.
        {:else if analysis.reason === 'incomplete'}
          Concentração indisponível: a lista de lançamentos está incompleta.
          Atualize os dados para conferir a base completa.
        {:else}
          Concentração indisponível: há lançamentos inválidos ou repetidos na
          base. Atualize os dados e confira os registros.
        {/if}
      </p>
    {:else if analysis.groups.length === 0}
      <p role="status" class="rounded-lg border p-3 text-sm">
        Não há despesas confirmadas neste mês. Lançamentos pendentes não entram
        neste agrupamento.
      </p>
    {:else}
      <dl class="grid min-w-0 gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-3">
        <div>
          <dt class="text-xs text-muted-foreground">
            Compras antes dos estornos
          </dt>
          <dd class="mt-1 font-medium">{display(analysis.purchasesCents)}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Estornos a descontar</dt>
          <dd class="mt-1 font-medium">{display(analysis.refundsCents)}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Líquido: compras − estornos
          </dt>
          <dd class="mt-1 font-medium">{display(analysis.netCents)}</dd>
        </div>
      </dl>
      <p class="text-xs text-muted-foreground">
        Participação das compras confirmadas, antes dos estornos. Os estornos
        reduzem o líquido, sem alterar a base dos percentuais.
        {#if analysis.purchasesCents === 0}Sem compras positivas no mês;
          participação indisponível.{/if}
      </p>
      <p class="text-xs text-muted-foreground">
        Mostrando {groups.length} de {analysis.groups.length} grupos.
      </p>
      <div id={`${instanceId}-groups`} class="space-y-3">
        {#each groups as group, index (group.key)}
          {@const evidenceId = `${instanceId}-evidence-${index}`}
          <article class="min-w-0 rounded-lg border p-3 sm:p-4">
            <p class="text-xs text-muted-foreground">Descrição no extrato</p>
            <h3 class="mt-1 font-medium break-anywhere">
              {group.description || 'Sem descrição'}
            </h3>
            <p class="mt-1 text-xs text-muted-foreground break-anywhere">
              Conta: {group.accountLabel}
            </p>
            <dl class="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt class="text-muted-foreground">
                  Compras ({group.purchaseCount})
                </dt>
                <dd>{display(group.purchasesCents)}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">
                  Estornos ({group.refundCount})
                </dt>
                <dd>{display(group.refundsCents)}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Líquido</dt>
                <dd class="font-medium">{display(group.netCents)}</dd>
              </div>
            </dl>
            <p class="mt-3 text-xs text-muted-foreground">
              Participação: {displayPercent(group.sharePercent)}
            </p>
            {#if !hidden && group.sharePercent !== null}
              <div
                class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <div
                  class="h-full rounded-full bg-primary"
                  style:width={`${group.sharePercent}%`}
                ></div>
              </div>
            {/if}
            {#if group.zeroCount > 0}<p
                class="mt-2 text-xs text-muted-foreground"
              >
                {group.zeroCount} registro(s) de valor zero, fora da contagem de compras
                e estornos.
              </p>{/if}
            <Button
              class="mt-3 h-auto min-h-8 max-w-full whitespace-normal"
              variant="outline"
              aria-expanded={!!expanded[group.key]}
              aria-controls={evidenceId}
              aria-label={`${expanded[group.key] ? 'Ocultar' : 'Ver'} lançamentos de ${group.description || 'Sem descrição'}, conta ${group.accountLabel}`}
              onclick={() => toggle(group.key)}
              >{expanded[group.key]
                ? 'Ocultar lançamentos'
                : `Ver lançamentos (${group.evidence.length})`}</Button
            >
            <div id={evidenceId} hidden={!expanded[group.key]}>
              {#if expanded[group.key]}
                {@const page = concentrationEvidencePage(
                  group.evidence,
                  pages[group.key]
                )}
                <p class="mt-4 text-xs text-muted-foreground">
                  Registros de origem — página {page.page} de {page.pages}.
                </p>
                <ul class="mt-2 divide-y">
                  {#each page.items as transaction (transaction.id)}
                    {@const cents = Math.round(transaction.amount * 100)}
                    <li class="min-w-0 py-3 text-sm">
                      <div
                        class="flex flex-wrap justify-between gap-x-3 gap-y-1"
                      >
                        <time datetime={transaction.date}
                          >{displayDate(transaction.date)}</time
                        >
                        <span class="font-medium"
                          >{display(Math.abs(cents))}</span
                        >
                      </div>
                      <p class="mt-1 break-anywhere">
                        {transaction.description || 'Sem descrição'}
                      </p>
                      <p
                        class="mt-1 text-xs text-muted-foreground break-anywhere"
                      >
                        Conta: {concentrationAccountLabel(transaction)}
                      </p>
                      <p class="mt-1 text-xs text-muted-foreground">
                        {cents < 0
                          ? 'Estorno — descontado das compras'
                          : cents > 0
                            ? 'Compra confirmada'
                            : 'Registro de valor zero'}
                      </p>
                    </li>
                  {/each}
                </ul>
                {#if page.pages > 1}
                  <nav
                    class="mt-2 flex flex-wrap items-center gap-2"
                    aria-label="Páginas dos registros de origem"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page.page === 1}
                      onclick={() => (pages[group.key] = page.page - 1)}
                      >Anterior</Button
                    >
                    <span class="text-xs" aria-live="polite"
                      >Página {page.page} de {page.pages}</span
                    >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page.page === page.pages}
                      onclick={() => (pages[group.key] = page.page + 1)}
                      >Próxima</Button
                    >
                  </nav>
                {/if}
              {/if}
            </div>
          </article>
        {/each}
      </div>
      {#if analysis.groups.length > CONCENTRATION_GROUP_LIMIT}
        <Button
          variant="outline"
          aria-expanded={showAll}
          aria-controls={`${instanceId}-groups`}
          onclick={() => (showAll = !showAll)}
          >{showAll ? 'Mostrar menos' : 'Ver todos'}</Button
        >
      {/if}
    {/if}
  </Card.Content>
</Card.Root>

<style>
  .break-anywhere {
    overflow-wrap: anywhere;
  }
  dd {
    overflow-wrap: anywhere;
  }
</style>
