<script lang="ts">
  import type { Portfolio, Position } from '#lib/investments.js';
  import { assetClasses } from '#lib/investments.js';
  import { money } from '#lib/finance.js';
  import {
    Plus,
    Pencil,
    Archive,
    RotateCcw,
    Wallet,
    TrendingUp,
    Coins,
    Layers
  } from '@lucide/svelte';
  import * as Card from '#lib/components/ui/card/index.js';
  import * as Tabs from '#lib/components/ui/tabs/index.js';
  import * as Dialog from '#lib/components/ui/dialog/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Badge } from '#lib/components/ui/badge/index.js';
  import FinanceChart from './FinanceChart.svelte';
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
  let visible = $derived(
    p.positions.filter((i) => filter === 'all' || i.assetClass === filter)
  );
  const display = (value: number) => (hidden ? '••••••' : money(value));
  const day = (value: string) =>
    value.slice(0, 10).split('-').reverse().join('/');
  const colors = [
    '#32785a',
    '#88b6a1',
    '#e0ae69',
    '#759bc2',
    '#ab94be',
    '#d28b82'
  ];
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

<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <div class="flex items-center gap-2">
    <Badge variant="secondary">Sua carteira</Badge><span
      class="text-xs text-muted-foreground"
      >{p.positions.length} posições em reais</span
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
<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
  {#each [{ label: 'Patrimônio investido', value: display(p.total), note: 'Posições sincronizadas + manuais', icon: Wallet }, { label: 'Capital com custo conhecido', value: display(p.knownCost), note: `${p.positions.filter((i) => i.cost !== null).length} de ${p.positions.length} posições informam custo`, icon: Layers }, { label: 'Variação sobre o custo', value: p.variation === null ? '—' : display(p.variation), note: 'Somente posições com custo conhecido', icon: TrendingUp }, { label: `Proventos de ${month.slice(0, 4)}`, value: display(p.dividendsYear), note: 'Registros adicionados por você', icon: Coins }] as metric}
    <Card.Root class="gap-3 py-5 shadow-none"
      ><Card.Header
        class="flex flex-row items-center justify-between gap-2 px-5"
        ><Card.Description>{metric.label}</Card.Description><metric.icon
          class="size-4 text-primary"
        /></Card.Header
      ><Card.Content class="px-5"
        ><div class="text-2xl font-semibold tracking-tight">{metric.value}</div>
        <p class="mt-2 text-xs text-muted-foreground">
          {metric.note}
        </p></Card.Content
      ></Card.Root
    >
  {/each}
</div>
<div class="grid min-w-0 gap-5 mb-5 xl:grid-cols-2">
  <Card.Root class="min-w-0 shadow-none"
    ><Card.Header
      ><Card.Title>Divisão da carteira</Card.Title><Card.Description
        >Participação no valor atual dos investimentos.</Card.Description
      ></Card.Header
    ><Card.Content>
      <div class="grid items-center gap-5 sm:grid-cols-2">
        <FinanceChart
          rows={p.allocation.map((a) => ({ label: a.label, value: a.value }))}
          series={[{ key: 'value', label: 'Patrimônio', color: '#32785a' }]}
          kind="donut"
          {hidden}
          label="Alocação da carteira por classe de investimento"
        />
        <div class="space-y-4">
          {#each p.allocation as item, i}<div>
              <div class="mb-1 flex justify-between gap-3 text-xs">
                <span class="flex items-center gap-2"
                  ><i
                    class="size-2 rounded-full"
                    style={`background:${colors[i % colors.length]}`}
                  ></i>{item.label}</span
                ><strong>{item.percentage.toFixed(1)}%</strong>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  class="h-full rounded-full"
                  style={`width:${item.percentage}%;background:${colors[i % colors.length]}`}
                ></div>
              </div>
            </div>{/each}
        </div>
      </div>
    </Card.Content></Card.Root
  >
  <Card.Root class="min-w-0 shadow-none"
    ><Card.Header
      ><Card.Title>Seus proventos no ano</Card.Title><Card.Description
        >Dividendos, JCP e rendimentos registrados.</Card.Description
      ></Card.Header
    ><Card.Content
      ><FinanceChart
        rows={p.dividendSeries.map((a) => ({
          label: new Date(`${a.month}-15T12:00:00Z`)
            .toLocaleDateString('pt-BR', { month: 'short' })
            .replace('.', ''),
          total: a.total
        }))}
        series={[{ key: 'total', label: 'Proventos', color: '#32785a' }]}
        {hidden}
        label="Proventos registrados mês a mês"
      />
      <p class="mt-3 text-xs text-muted-foreground">
        Sem projeções automáticas. Registre os pagamentos recebidos para
        acompanhar a evolução.
      </p></Card.Content
    ></Card.Root
  >
</div>
<Card.Root class="min-w-0 shadow-none mb-5"
  ><Card.Header
    class="flex flex-row flex-wrap items-center justify-between gap-3"
    ><div>
      <Card.Title>Meus investimentos</Card.Title><Card.Description
        class="mt-1.5"
        >Controle suas posições sem misturar o saldo da conta com o patrimônio
        investido.</Card.Description
      >
    </div>
    <select
      class="field-select"
      aria-label="Filtrar classe de investimento"
      bind:value={filter}
      ><option value="all">Todas as classes</option
      >{#each Object.entries(assetClasses) as [key, label]}<option value={key}
          >{label}</option
        >{/each}</select
    ></Card.Header
  ><Card.Content class="px-0">
    <Tabs.Root value="active"
      ><Tabs.List class="mx-6 mb-4"
        ><Tabs.Trigger value="active">Posições</Tabs.Trigger><Tabs.Trigger
          value="archived">Arquivadas ({p.archived.length})</Tabs.Trigger
        ></Tabs.List
      >
      <Tabs.Content value="active"
        ><div class="overflow-x-auto">
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
              {#each visible as position}<tr
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
                  ><td
                    colspan="7"
                    class="!py-12 text-center text-muted-foreground"
                    >Nenhuma posição nesta classe. Sincronize suas contas ou
                    adicione seu primeiro investimento.</td
                  ></tr
                >{/each}
            </tbody>
          </table>
        </div></Tabs.Content
      >
      <Tabs.Content value="archived"
        ><div class="space-y-3 px-6">
          {#each p.archived as position}<div
              class="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <span class="text-sm">{position.name}</span><Button
                variant="outline"
                disabled={busy}
                onclick={() =>
                  save('archive', { id: position.id, archived: false })}
                ><RotateCcw class="size-4" />Restaurar</Button
              >
            </div>{:else}<p class="py-6 text-sm text-muted-foreground">
              Nenhum investimento arquivado.
            </p>{/each}
        </div></Tabs.Content
      ></Tabs.Root
    >
    <p class="mt-5 px-6 text-xs leading-relaxed text-muted-foreground">
      Os valores conectados refletem a última consulta da instituição. Preços
      manuais precisam ser atualizados por você. O custo só aparece quando foi
      informado; valor bruto e saldo líquido não representam, por si só,
      rentabilidade. {p.excludedCurrencies
        ? `${p.excludedCurrencies} posição(ões) em outras moedas ficaram fora dos totais em reais.`
        : ''}
    </p>
  </Card.Content></Card.Root
>
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
                save('archive-dividend', { id: dividend.id, archived: false })}
              >Restaurar</Button
            >
          </div>{/each}
      </details>{/if}</Card.Content
  ></Card.Root
>

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
