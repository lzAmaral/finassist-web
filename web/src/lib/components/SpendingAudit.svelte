<script lang="ts">
  import { money, monthLabel, type Dashboard } from '#lib/finance.js';
  import {
    auditEvidencePage,
    buildSpendingAudit,
    type AuditGroupKey
  } from '#lib/spending-audit.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';

  let {
    dashboard,
    hidden = false
  }: { dashboard: Dashboard; hidden?: boolean } = $props();
  const id = $props.id();
  const audit = $derived(buildSpendingAudit(dashboard));
  let view = $state<{
    month: string;
    expanded: Partial<Record<AuditGroupKey, boolean>>;
    pages: Partial<Record<AuditGroupKey, number>>;
  }>({ month: '', expanded: {}, pages: {} });
  $effect(() => {
    view = { month: dashboard.month, expanded: {}, pages: {} };
  });
  const display = (cents: number) => (hidden ? '••••••' : money(cents / 100));
  const expanded = (key: AuditGroupKey) =>
    view.month === dashboard.month && !!view.expanded[key];
  const pageNumber = (key: AuditGroupKey) =>
    view.month === dashboard.month ? (view.pages[key] ?? 1) : 1;
  function toggle(key: AuditGroupKey) {
    const current =
      view.month === dashboard.month
        ? view
        : { month: dashboard.month, expanded: {}, pages: {} };
    view = {
      ...current,
      expanded: { ...current.expanded, [key]: !expanded(key) }
    };
  }
  function changePage(key: AuditGroupKey, page: number) {
    view = { ...view, pages: { ...view.pages, [key]: page } };
  }
  const dateLabel = (date: string) => date.split('-').reverse().join('/');
  const statusLabel = (status: string) =>
    status === 'PENDING'
      ? 'Pendente'
      : status === 'PAID'
        ? 'Pago'
        : 'Confirmado';
  const queryDate = (date: string) =>
    new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
</script>

<Card.Root class="min-w-0 shadow-none">
  <Card.Header>
    <Card.Title>Base da análise de gastos</Card.Title>
    <Card.Description class="mt-2">
      Confira pendências, categorias e estornos nos lançamentos disponíveis{audit.available
        ? ` de ${monthLabel(dashboard.month)}`
        : ''}.
    </Card.Description>
  </Card.Header>
  <Card.Content class="min-w-0 space-y-4">
    {#if !audit.available}
      <p
        role="status"
        class="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"
      >
        {audit.reason}
      </p>
    {:else}
      <p class="text-sm text-muted-foreground">
        Estes grupos podem se sobrepor: um estorno em “Outros” aparece em dois
        grupos. Não some os valores entre esses grupos.
      </p>
      {#if audit.cloud}
        <p class="text-xs text-muted-foreground">
          {#if audit.syncedAt}Última consulta: <time datetime={audit.syncedAt}
              >{queryDate(audit.syncedAt)}</time
            >.{:else}A data da última consulta não está disponível.{/if}
          A consulta não comprova cobertura bancária completa. Uma consulta antiga
          não indica erro na transação.
        </p>
      {:else}
        <p class="text-xs text-muted-foreground">
          A lista disponível não comprova cobertura bancária completa.
        </p>
      {/if}
      {#if audit.unknownStatusCount > 0}
        <p class="rounded-lg bg-muted/50 p-3 text-sm">
          {audit.unknownStatusCount} registro(s) de despesa neste mês com status não
          reconhecido ficaram fora dos valores e dos grupos.
        </p>
      {/if}
      {#if audit.cancelledCount > 0}
        <p class="text-xs text-muted-foreground">
          {audit.cancelledCount} registro(s) cancelado(s) neste mês ficaram fora dos
          valores e dos grupos.
        </p>
      {/if}
      <div class="space-y-4">
        {#each audit.groups as group (group.key)}
          {@const page = auditEvidencePage(group.items, pageNumber(group.key))}
          <section
            class="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4"
            aria-labelledby={`${id}-${group.key}-heading`}
          >
            <h3
              id={`${id}-${group.key}-heading`}
              class="break-words text-sm font-semibold"
            >
              {group.title}
            </h3>
            <p class="text-xs text-muted-foreground">
              {group.count} registro(s) disponível(is) neste grupo
            </p>
            {#if group.key === 'pending'}
              <dl class="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt class="text-muted-foreground">Despesas pendentes</dt>
                  <dd class="break-words font-semibold">
                    {display(group.purchasesCents)}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Estornos pendentes</dt>
                  <dd class="break-words font-semibold">
                    {display(group.refundsCents)}
                  </dd>
                </div>
              </dl>
              <p class="text-xs leading-relaxed text-muted-foreground">
                Pendências ficam fora dos gastos confirmados. Os valores de
                despesas e estornos são separados; não indicam vencimento nem
                confirmam cobrança futura.
              </p>
            {:else if group.key === 'categories'}
              <dl class="space-y-2 text-sm">
                <div>
                  <dt class="text-muted-foreground">Valor líquido</dt>
                  <dd class="break-words font-semibold">
                    {display(group.netCents)}
                  </dd>
                </div>
                {#if group.purchasesCents > 0}<div>
                    <dt class="text-muted-foreground">Compras confirmadas</dt>
                    <dd class="break-words">{display(group.purchasesCents)}</dd>
                  </div>{/if}
                {#if group.refundsCents > 0}<div>
                    <dt class="text-muted-foreground">
                      Estornos confirmados neste grupo
                    </dt>
                    <dd class="break-words">{display(group.refundsCents)}</dd>
                  </div>{/if}
              </dl>
              <p class="text-xs leading-relaxed text-muted-foreground">
                Somente despesas confirmadas. “Outros” é uma categoria ampla e
                pode ser uma escolha correta. O valor líquido desconta os
                estornos.
              </p>
              {#if audit.classificationHref}
                <a
                  href={audit.classificationHref}
                  class="inline-block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                  >Conferir categorias</a
                >
              {:else}
                <p class="text-xs text-muted-foreground">
                  Corrigir categorias exige o backend Go conectado.
                </p>
              {/if}
            {:else}
              <dl class="text-sm">
                <dt class="text-muted-foreground">Redução das despesas</dt>
                <dd class="break-words font-semibold">
                  {display(group.refundsCents)}
                </dd>
              </dl>
              <p class="text-xs leading-relaxed text-muted-foreground">
                Estornos confirmados já reduzem os totais de despesas. São
                ajustes legítimos: não devem ser adicionados novamente nem
                excluídos por aparecerem aqui.
              </p>
            {/if}
            <Button
              variant="outline"
              size="sm"
              class="h-auto min-h-8 max-w-full whitespace-normal text-left"
              aria-expanded={expanded(group.key)}
              aria-controls={`${id}-${group.key}-evidence`}
              onclick={() => toggle(group.key)}
            >
              {expanded(group.key) ? 'Recolher' : 'Ver'} evidências<span
                class="sr-only">: {group.title}</span
              >
            </Button>
            <div
              id={`${id}-${group.key}-evidence`}
              hidden={!expanded(group.key)}
              class="space-y-3 border-t pt-3"
            >
              {#if group.count === 0}
                <p class="text-sm text-muted-foreground">
                  Nenhum registro disponível neste grupo
                </p>
              {:else}
                <ul class="min-w-0 divide-y">
                  {#each page.items as transaction (transaction.id)}
                    <li class="min-w-0 space-y-1 py-3 text-sm">
                      <p
                        class="break-words font-medium [overflow-wrap:anywhere]"
                      >
                        {transaction.description || 'Sem descrição'}
                      </p>
                      <p
                        class="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]"
                      >
                        <time datetime={transaction.date}
                          >{dateLabel(transaction.date)}</time
                        >
                        · {statusLabel(transaction.status)}
                      </p>
                      <p
                        class="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]"
                      >
                        Categoria: {transaction.categoryLabel.trim() ||
                          'Sem categoria'} · Conta: {transaction.accountName ||
                          'Não informada'}
                      </p>
                      <p class="break-words font-medium">
                        Valor: {display(Math.round(transaction.amount * 100))}
                      </p>
                    </li>
                  {/each}
                </ul>
                {#if page.pages > 1}
                  <nav
                    aria-label={`Páginas de evidências: ${group.title}`}
                    class="flex flex-wrap items-center gap-2"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page.page === 1}
                      onclick={() => changePage(group.key, page.page - 1)}
                      >Anterior</Button
                    >
                    <p role="status" class="text-xs text-muted-foreground">
                      Página {page.page} de {page.pages}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page.page === page.pages}
                      onclick={() => changePage(group.key, page.page + 1)}
                      >Próxima</Button
                    >
                  </nav>
                {/if}
              {/if}
            </div>
          </section>
        {/each}
      </div>
      <a
        href={audit.transactionsHref}
        class="inline-block rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >Conferir despesas nas transações</a
      >
    {/if}
  </Card.Content>
</Card.Root>
