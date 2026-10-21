<script lang="ts">
  import type { Portfolio, Position } from '#lib/investments.js';
  import { assetClasses } from '#lib/investments.js';
  import { money } from '#lib/finance.js';
  import {
    Plus,
    Pencil,
    Archive,
    RotateCcw,
    Coins,
    ChevronDown,
    ArrowUpRight,
    ArrowDownRight,
    Landmark,
    Building2,
    Globe,
    Bitcoin,
    ChartNoAxesCombined,
    Layers,
    Wallet
  } from '@lucide/svelte';
  import * as Card from '#lib/components/ui/card/index.js';
  import * as Tabs from '#lib/components/ui/tabs/index.js';
  import * as Dialog from '#lib/components/ui/dialog/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Badge } from '#lib/components/ui/badge/index.js';
  import InvestmentOverview from './InvestmentOverview.svelte';
  import { assetGroups } from '#lib/portfolio-presentation.js';
  import '#lib/investments.css';
  let {
    portfolio: p,
    hidden = false,
    month
  }: { portfolio: Portfolio; hidden?: boolean; month: string } = $props();
  let positionOpen = $state(false),
    dividendOpen = $state(false),
    busy = $state(false),
    message = $state('');
  let id = $state(''),
    name = $state(''),
    ticker = $state(''),
    assetClass = $state('EQUITY');
  let quantity = $state<number | undefined>(1),
    averagePrice = $state<number | undefined>(),
    currentPrice = $state<number | undefined>();
  let positionId = $state(''),
    dividendType = $state('DIVIDEND'),
    dividendDate = $state(new Date().toLocaleDateString('en-CA')),
    dividendAmount = $state<number | undefined>();
  let filter = $state('all');
  let groups = $derived(
    assetGroups(p.positions).filter(
      (group) => filter === 'all' || group.key === filter
    )
  );
  const icons = {
    EQUITY: ChartNoAxesCombined,
    FII: Building2,
    ETF: Globe,
    FIXED_INCOME: Landmark,
    MUTUAL_FUND: Layers,
    CRYPTO: Bitcoin,
    OTHER: Wallet
  };
  const percentage = (value: number | null) =>
    hidden
      ? '••••'
      : value === null
        ? '—'
        : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const display = (value: number) => (hidden ? '••••••' : money(value));
  const day = (value: string) =>
    value.slice(0, 10).split('-').reverse().join('/');
  async function save(path: string, body: unknown) {
    busy = true;
    message = '';
    try {
      const response = await fetch(`/api/portfolio/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Não foi possível salvar.');
      location.reload();
    } catch (error) {
      message = error instanceof Error ? error.message : 'Falha de conexão.';
      busy = false;
    }
  }
  function edit(position?: Position) {
    id = position?.id ?? '';
    name = position?.name ?? '';
    ticker = position?.ticker ?? '';
    assetClass = position?.assetClass ?? 'EQUITY';
    quantity = position?.quantity ?? 1;
    averagePrice = position?.averagePrice;
    currentPrice = position?.currentPrice;
    message = '';
    positionOpen = true;
  }
</script>

<div class="investment-workspace">
  <div class="investment-toolbar">
    <div class="flex items-center gap-2">
      <span class="investment-live-dot" aria-hidden="true"></span><span
        class="investment-toolbar-label">Minha carteira</span
      ><span class="text-xs text-muted-foreground">
        · {p.positions.length} ativos em reais</span
      >
    </div>
    <div class="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onclick={() => {
          message = '';
          positionId = p.positions[0]?.id ?? '';
          dividendOpen = true;
        }}
        disabled={!p.positions.length}
        ><Coins class="size-4" />Registrar provento</Button
      ><Button onclick={() => edit()}
        ><Plus class="size-4" />Adicionar investimento</Button
      >
    </div>
  </div>
  {#if message && !positionOpen && !dividendOpen}<p
      class="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
    >
      {message}
    </p>{/if}
  {#if p.importError}<p
      class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
    >
      {p.importError}
    </p>{/if}
  <InvestmentOverview portfolio={p} {hidden} {month} />

  {#snippet positionTable(positions: Position[])}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrolling table needs keyboard access.) -->
    <div
      class="overflow-x-auto"
      role="region"
      aria-label="Posições da classe"
      tabindex="0"
    >
      <table class="portfolio-table">
        <thead
          ><tr
            ><th>Ativo</th><th>Quantidade</th><th>Custo informado</th><th
              >Valor atual</th
            ><th>Variação</th><th>Origem</th><th
              ><span class="sr-only">Ações</span></th
            ></tr
          ></thead
        ><tbody>
          {#each positions as position}<tr
              ><td
                ><strong>{position.ticker || position.name}</strong><small
                  >{position.ticker
                    ? position.name
                    : assetClasses[position.assetClass]}</small
                ></td
              ><td
                >{hidden
                  ? '••••'
                  : (position.quantity?.toLocaleString('pt-BR', {
                      maximumFractionDigits: 8
                    }) ?? '—')}</td
              ><td
                >{position.cost === null
                  ? 'Não disponível'
                  : display(position.cost)}</td
              ><td class="font-semibold">{display(position.balance)}</td><td
                class:text-destructive={position.cost !== null &&
                  position.balance < position.cost}
                class:text-primary={position.cost !== null &&
                  position.balance >= position.cost}
                >{position.cost === null
                  ? '—'
                  : display(position.balance - position.cost)}</td
              ><td
                ><Badge
                  variant={position.source === 'pluggy'
                    ? 'secondary'
                    : 'outline'}
                  >{position.source === 'pluggy'
                    ? 'Conectado'
                    : 'Manual'}</Badge
                ><small
                  >{position.source === 'pluggy'
                    ? `Consulta ${day(position.updatedAt)}`
                    : 'Preço informado por você'}</small
                ></td
              ><td
                >{#if position.source === 'manual'}<div class="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${position.name}`}
                      onclick={() => edit(position)}
                      ><Pencil class="size-4" /></Button
                    ><Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Arquivar ${position.name}`}
                      disabled={busy}
                      onclick={() =>
                        save('archive', {
                          id: position.id,
                          archived: true
                        })}><Archive class="size-4" /></Button
                    >
                  </div>{/if}</td
              ></tr
            >
          {:else}<tr
              ><td colspan="7" class="!py-12 text-center text-muted-foreground"
                >Nenhuma posição nesta classe. Sincronize suas contas ou
                adicione seu primeiro investimento.</td
              ></tr
            >{/each}
        </tbody>
      </table>
    </div>
  {/snippet}

  <section class="investment-assets" aria-labelledby="my-assets-title">
    <div class="investment-assets-heading">
      <h2 id="my-assets-title">
        Meus ativos <span>({p.positions.length})</span>
      </h2>
      <select
        class="field-select"
        aria-label="Filtrar classe de investimento"
        bind:value={filter}
      >
        <option value="all">Todos os tipos</option>
        {#each Object.entries(assetClasses) as [key, label]}<option value={key}
            >{label}</option
          >{/each}
      </select>
    </div>
    <Tabs.Root value="active">
      <Tabs.List class="mb-4"
        ><Tabs.Trigger value="active">Carteira</Tabs.Trigger><Tabs.Trigger
          value="archived">Arquivados ({p.archived.length})</Tabs.Trigger
        ></Tabs.List
      >
      <Tabs.Content value="active" class="investment-asset-list">
        {#each groups as group (group.key)}
          {@const GroupIcon = icons[group.key]}
          <details class="investment-asset-group">
            <summary class="investment-asset-summary">
              <span class="investment-asset-name"
                ><span class="investment-asset-icon"
                  ><GroupIcon size={25} strokeWidth={1.6} /></span
                ><strong>{group.label}</strong></span
              >
              <span class="investment-asset-metric investment-asset-count"
                ><small>Ativos</small><b>{group.count}</b></span
              >
              <span class="investment-asset-metric"
                ><small>Valor total</small><b>{display(group.total)}</b></span
              >
              <span class="investment-asset-metric"
                ><small>Ganho de capital</small><b
                  class:investment-positive={group.gain !== null &&
                    group.gain >= 0}
                  class:investment-negative={group.gain !== null &&
                    group.gain < 0}
                  >{group.gain === null ? '—' : display(group.gain)}</b
                ></span
              >
              <span class="investment-asset-metric"
                ><small>Variação sobre custo</small><b
                  class="investment-return"
                  class:negative={group.change !== null && group.change < 0}
                  class:unavailable={group.change === null}
                  >{percentage(
                    group.change
                  )}{#if group.change !== null && !hidden}{#if group.change < 0}<ArrowDownRight
                        size={15}
                      />{:else}<ArrowUpRight size={15} />{/if}{/if}</b
                ></span
              >
              <span class="investment-asset-metric"
                ><small>% na carteira</small><b
                  >{percentage(group.percentage)}</b
                ></span
              >
              <span class="investment-expand"><ChevronDown size={18} /></span>
            </summary>
            <div class="investment-asset-detail">
              {#if group.count}
                {@render positionTable(group.positions)}
                <p class="investment-group-note">
                  Variação calculada sobre {group.covered} de {group.count} ativos
                  com custo informado. Não inclui proventos.
                </p>
              {:else}<div class="investment-group-empty">
                  <p>Você ainda não tem ativos nesta classe.</p>
                  <Button
                    variant="outline"
                    onclick={() => {
                      edit();
                      assetClass = group.key;
                    }}><Plus class="size-4" />Adicionar investimento</Button
                  >
                </div>{/if}
            </div>
          </details>
        {/each}
      </Tabs.Content>
      <Tabs.Content value="archived">
        <div class="investment-panel investment-archives">
          {#each p.archived as position}<div
              class="flex items-center justify-between gap-3 border-b py-4 last:border-0"
            >
              <span class="text-sm">{position.name}</span><Button
                variant="outline"
                disabled={busy}
                onclick={() =>
                  save('archive', { id: position.id, archived: false })}
                ><RotateCcw class="size-4" />Restaurar</Button
              >
            </div>
          {:else}<p class="py-6 text-sm text-muted-foreground">
              Nenhum investimento arquivado.
            </p>{/each}
        </div>
      </Tabs.Content>
    </Tabs.Root>
    <p class="investment-disclaimer">
      Posições conectadas refletem a última consulta. Preços manuais são
      informados por você. {p.excludedCurrencies
        ? `${p.excludedCurrencies} posição(ões) em outras moedas ficaram fora dos totais em reais.`
        : ''}
    </p>
  </section>
  <Card.Root class="shadow-none"
    ><Card.Header
      ><Card.Title>Histórico de proventos</Card.Title><Card.Description
        >Registros manuais, separados das movimentações bancárias.</Card.Description
      ></Card.Header
    ><Card.Content
      >{#each p.dividends.slice(0, 30) as dividend}<div
          class="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"
        >
          <div>
            <p class="text-sm font-medium">{dividend.name}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {day(dividend.date)} · {dividend.type === 'JCP'
                ? 'JCP'
                : dividend.type === 'DIVIDEND'
                  ? 'Dividendos'
                  : 'Rendimentos'}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <strong class="text-sm text-primary"
              >{display(dividend.amount)}</strong
            ><Button
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={`Arquivar provento de ${dividend.name}`}
              onclick={() =>
                save('archive-dividend', { id: dividend.id, archived: true })}
              ><Archive class="size-4" /></Button
            >
          </div>
        </div>{:else}<div class="py-7 text-center">
          <Coins class="mx-auto mb-3 size-7 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            Seus proventos aparecerão aqui depois do primeiro registro.
          </p>
        </div>{/each}{#if p.archivedDividends.length}<details
          class="mt-5 border-t pt-4"
        >
          <summary class="cursor-pointer text-xs text-muted-foreground"
            >Proventos arquivados ({p.archivedDividends.length})</summary
          >{#each p.archivedDividends as dividend}<div
              class="mt-3 flex items-center justify-between gap-3 text-sm"
            >
              <span>{dividend.name} · {day(dividend.date)}</span><Button
                variant="outline"
                disabled={busy}
                onclick={() =>
                  save('archive-dividend', {
                    id: dividend.id,
                    archived: false
                  })}>Restaurar</Button
              >
            </div>{/each}
        </details>{/if}</Card.Content
    ></Card.Root
  >
</div>

<Dialog.Root bind:open={positionOpen}
  ><Dialog.Content class="sm:max-w-xl"
    ><Dialog.Header
      ><Dialog.Title
        >{id ? 'Editar investimento' : 'Adicionar investimento'}</Dialog.Title
      ><Dialog.Description
        >Cadastre posições que não vieram pela conexão para evitar duplicar seu
        patrimônio.</Dialog.Description
      ></Dialog.Header
    >
    <form
      class="grid gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        save('position', {
          ...(id ? { id } : {}),
          name,
          ticker,
          assetClass,
          quantity,
          averagePrice,
          currentPrice
        });
      }}
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="form-label"
          >Nome do investimento<Input
            bind:value={name}
            required
            maxlength={100}
            placeholder="Nome do ativo ou produto"
          /></label
        ><label class="form-label"
          >Código (opcional)<Input
            bind:value={ticker}
            maxlength={20}
            placeholder="Ticker do ativo"
          /></label
        >
      </div>
      <label class="form-label"
        >Classe<select class="field-select" bind:value={assetClass}
          >{#each Object.entries(assetClasses) as [key, label]}<option
              value={key}>{label}</option
            >{/each}</select
        ></label
      >
      <div class="grid gap-3 sm:grid-cols-3">
        <label class="form-label"
          >Quantidade<Input
            type="number"
            bind:value={quantity}
            required
            min="0.00000001"
            max="1000000000"
            step="any"
          /></label
        ><label class="form-label"
          >Preço médio (R$)<Input
            type="number"
            bind:value={averagePrice}
            required
            min="0"
            max="1000000000"
            step="0.01"
          /></label
        ><label class="form-label"
          >Preço atual (R$)<Input
            type="number"
            bind:value={currentPrice}
            required
            min="0"
            max="1000000000"
            step="0.01"
          /></label
        >
      </div>
      <p class="text-xs text-muted-foreground">
        Para um CDB ou outro investimento sem cotas, use quantidade 1 e informe
        o capital aplicado e o saldo atual como preços.
      </p>
      {#if message}<p class="text-sm text-destructive" role="alert">
          {message}
        </p>{/if}
      <Dialog.Footer
        ><Button variant="outline" onclick={() => (positionOpen = false)}
          >Cancelar</Button
        ><Button type="submit" disabled={busy}
          >{busy ? 'Salvando…' : 'Salvar investimento'}</Button
        ></Dialog.Footer
      >
    </form>
  </Dialog.Content></Dialog.Root
>
<Dialog.Root bind:open={dividendOpen}
  ><Dialog.Content
    ><Dialog.Header
      ><Dialog.Title>Registrar provento</Dialog.Title><Dialog.Description
        >Informe um pagamento recebido para acompanhar sua renda dos
        investimentos.</Dialog.Description
      ></Dialog.Header
    >
    <form
      class="grid gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        save('dividend', {
          positionId,
          type: dividendType,
          date: dividendDate,
          amount: dividendAmount
        });
      }}
    >
      <label class="form-label"
        >Investimento<select
          class="field-select"
          bind:value={positionId}
          required
          >{#each p.positions as position}<option value={position.id}
              >{position.name}</option
            >{/each}</select
        ></label
      >
      <label class="form-label"
        >Tipo<select class="field-select" bind:value={dividendType}
          ><option value="DIVIDEND">Dividendos</option><option value="JCP"
            >Juros sobre capital próprio</option
          ><option value="YIELD">Rendimentos</option></select
        ></label
      >
      <div class="grid grid-cols-2 gap-3">
        <label class="form-label"
          >Data<Input type="date" bind:value={dividendDate} required /></label
        ><label class="form-label"
          >Valor recebido (R$)<Input
            type="number"
            bind:value={dividendAmount}
            required
            min="0.01"
            max="1000000000"
            step="0.01"
          /></label
        >
      </div>
      {#if message}<p class="text-sm text-destructive" role="alert">
          {message}
        </p>{/if}<Dialog.Footer
        ><Button variant="outline" onclick={() => (dividendOpen = false)}
          >Cancelar</Button
        ><Button type="submit" disabled={busy}
          >{busy ? 'Salvando…' : 'Registrar provento'}</Button
        ></Dialog.Footer
      >
    </form></Dialog.Content
  ></Dialog.Root
>
