<script lang="ts">
  import type { Dashboard } from '#lib/finance.js';
  import { money } from '#lib/finance.js';
  import { localAnalysis, type GeminiAnalysis } from '#lib/analysis.js';
  import {
    Sparkles,
    ArrowUpRight,
    ShieldCheck,
    KeyRound,
    Lightbulb,
    ChartNoAxesCombined
  } from '@lucide/svelte';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Badge } from '#lib/components/ui/badge/index.js';
  import FinanceChart from './FinanceChart.svelte';
  let {
    dashboard: d,
    ai,
    hidden = false
  }: {
    dashboard: Dashboard;
    ai: {
      configured: boolean;
      analysis: GeminiAnalysis | null;
      model: string;
    } | null;
    hidden?: boolean;
  } = $props();
  let stats = $derived(localAnalysis(d));
  let analysis = $state<GeminiAnalysis | null>(null),
    configured = $state(false);
  let busy = $state(false),
    message = $state(''),
    key = $state(''),
    keyOpen = $state(false);
  let reduction = $state(10);
  $effect(() => {
    analysis = ai?.analysis ?? null;
    configured = ai?.configured ?? false;
  });
  const display = (n: number) => (hidden ? '••••••' : money(n));
  async function action(path: string, body: unknown) {
    busy = true;
    message = '';
    try {
      const response = await fetch(`/api/analysis/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Não foi possível concluir a análise.');
      if (path === 'key') {
        key = '';
        configured = true;
        keyOpen = false;
        message = 'Chave salva. Agora você pode gerar sua análise.';
      } else analysis = result;
    } catch (error) {
      message = error instanceof Error ? error.message : 'Falha de conexão.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="grid gap-4 sm:grid-cols-3 mb-5">
  {#each [{ label: 'Quanto sobrou', value: display(stats.surplus), note: 'Entradas menos despesas confirmadas' }, { label: 'Parcela da renda que sobrou', value: hidden ? '••••' : stats.savingsRate === null ? 'Sem renda informada' : `${stats.savingsRate.toFixed(1)}%`, note: 'Percentual do mês selecionado' }, { label: 'Despesas vs. mês anterior', value: hidden ? '••••' : stats.expenseChange === null ? 'Sem base anterior' : `${stats.expenseChange > 0 ? '+' : ''}${stats.expenseChange.toFixed(1)}%`, note: 'O mês atual pode estar incompleto' }] as metric}<Card.Root
      class="gap-3 shadow-none"
      ><Card.Header
        ><Card.Description>{metric.label}</Card.Description></Card.Header
      ><Card.Content
        ><div class="text-xl font-semibold tracking-tight">{metric.value}</div>
        <p class="mt-2 text-xs text-muted-foreground">
          {metric.note}
        </p></Card.Content
      ></Card.Root
    >{/each}
</div>
<div class="grid min-w-0 gap-5 xl:grid-cols-[1.35fr_1fr] mb-5">
  <Card.Root class="min-w-0 shadow-none"
    ><Card.Header class="flex flex-row items-start justify-between gap-3"
      ><div>
        <Card.Title class="flex items-center gap-2"
          ><Lightbulb class="size-4 text-primary" />Uma leitura do seu mês</Card.Title
        ><Card.Description class="mt-1.5"
          >Observações calculadas a partir das suas movimentações.</Card.Description
        >
      </div>
      <Badge variant="outline">No próprio app</Badge></Card.Header
    ><Card.Content class="space-y-4">
      <div class="analysis-observation">
        <span class="analysis-number">01</span>
        <div>
          <strong
            >{stats.surplus >= 0
              ? 'Suas entradas cobriram as despesas.'
              : 'As despesas superaram as entradas.'}</strong
          >
          <p>
            {stats.surplus >= 0
              ? 'A diferença disponível para seus próximos planos é'
              : 'A diferença a revisar no período é de'}
            {display(Math.abs(stats.surplus))}. Transferências identificadas
            ficam fora desta conta.
          </p>
        </div>
      </div>
      <div class="analysis-observation">
        <span class="analysis-number">02</span>
        <div>
          <strong
            >{stats.top
              ? `${stats.top.label} concentra mais despesas.`
              : 'Ainda não há despesas confirmadas.'}</strong
          >
          <p>
            {stats.top
              ? `Essa categoria soma ${display(stats.top.total)}. Confira os lançamentos antes de decidir o que ajustar.`
              : 'Escolha outro mês ou atualize os dados das contas.'}
          </p>
        </div>
      </div>
      <div class="analysis-observation">
        <span class="analysis-number">03</span>
        <div>
          <strong>Confira o que entrou na análise.</strong>
          <p>
            {stats.pending} lançamento(s) pendente(s) não entram nos totais. {stats.transfers}
            transferência(s) identificada(s) ficam separadas de receitas e despesas.
          </p>
        </div>
      </div>
    </Card.Content></Card.Root
  >
  <Card.Root class="shadow-none bg-secondary/40"
    ><Card.Header
      ><Card.Title>Faça uma simulação</Card.Title><Card.Description
        >Quanto uma redução das despesas representaria?</Card.Description
      ></Card.Header
    ><Card.Content
      ><div class="mb-5 flex items-center justify-between">
        <label for="reduction" class="text-sm">Redução hipotética</label><Badge
          variant="secondary">{reduction}%</Badge
        >
      </div>
      <input
        class="w-full accent-[#32785a]"
        id="reduction"
        type="range"
        min="0"
        max="50"
        step="1"
        bind:value={reduction}
      />
      <div class="mt-7 text-3xl font-semibold tracking-tight text-primary">
        {display((d.summary.current.expense * reduction) / 100)}
      </div>
      <p class="mt-2 text-sm text-muted-foreground">de diferença neste mês</p>
      <p class="mt-6 text-xs leading-relaxed text-muted-foreground">
        É uma conta sobre as despesas registradas, sem previsão de renda nem
        promessa de economia. Você escolhe o que faz sentido ajustar.
      </p></Card.Content
    ></Card.Root
  >
</div>
<Card.Root class="min-w-0 shadow-none mb-5"
  ><Card.Header
    ><Card.Title class="flex items-center gap-2"
      ><ChartNoAxesCombined class="size-4 text-primary" />Despesas por conta</Card.Title
    ><Card.Description
      >Veja por onde passaram os gastos confirmados.</Card.Description
    ></Card.Header
  ><Card.Content
    ><FinanceChart
      rows={(d.accountSpending ?? [])
        .filter((p) => p.total > 0)
        .map((p) => ({ label: p.label, total: p.total }))}
      series={[{ key: 'total', label: 'Despesas', color: '#32785a' }]}
      {hidden}
      label="Despesas do mês por conta"
    /></Card.Content
  ></Card.Root
>
<Card.Root class="shadow-none border-primary/20"
  ><Card.Header class="flex flex-row items-start justify-between gap-3"
    ><div>
      <Card.Title class="flex items-center gap-2"
        ><Sparkles class="size-4 text-primary" />Uma segunda leitura com Gemini</Card.Title
      ><Card.Description class="mt-1.5"
        >Ideias para compreender os seus hábitos, a partir de indicadores
        resumidos.</Card.Description
      >
    </div>
    <Badge variant="secondary">Google Gemini</Badge></Card.Header
  ><Card.Content>
    <div class="mb-5 flex items-start gap-3 rounded-xl bg-secondary/60 p-4">
      <ShieldCheck class="size-5 shrink-0 text-primary" />
      <p class="text-xs leading-relaxed text-muted-foreground">
        O Google recebe apenas percentuais, índices e categorias gerais. Nomes,
        extratos, contas, descrições e valores em reais ficam no FinAssist. Na
        cota gratuita, o Google pode usar o conteúdo enviado para melhorar os
        serviços. <a
          class="text-primary underline"
          href="https://ai.google.dev/gemini-api/terms"
          target="_blank"
          rel="noreferrer">Entenda o uso dos dados ↗</a
        >
      </p>
    </div>
    {#if analysis}<div class="mb-5 space-y-5">
        <p class="text-sm leading-relaxed">{analysis.summary}</p>
        <div class="grid gap-5 md:grid-cols-2">
          <div>
            <h3 class="mb-3 text-sm font-semibold">O que merece atenção</h3>
            <ul class="space-y-3">
              {#each analysis.observations as point}<li
                  class="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                >
                  <span class="text-primary">•</span>{point}
                </li>{/each}
            </ul>
          </div>
          <div>
            <h3 class="mb-3 text-sm font-semibold">
              Próximos passos possíveis
            </h3>
            <ul class="space-y-3">
              {#each analysis.actions as point}<li
                  class="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                >
                  <ArrowUpRight
                    class="mt-0.5 size-4 shrink-0 text-primary"
                  />{point}
                </li>{/each}
            </ul>
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          Gerado em {new Date(analysis.generatedAt).toLocaleString('pt-BR')}. A
          IA pode errar; confira suas movimentações.
        </p>
      </div>{/if}
    {#if message}<p
        class="mb-4 rounded-lg bg-secondary p-3 text-sm"
        role="status"
      >
        {message}
      </p>{/if}
    <div class="flex flex-wrap items-center gap-3">
      <Button
        disabled={busy || !configured || d.transactions.total === 0}
        onclick={() => action('generate', { month: d.month })}
        ><Sparkles class="size-4" />{busy
          ? 'Preparando…'
          : analysis
            ? 'Atualizar leitura'
            : 'Analisar meus hábitos'}</Button
      ><Button variant="ghost" onclick={() => (keyOpen = !keyOpen)}
        ><KeyRound class="size-4" />{configured
          ? 'Trocar chave'
          : 'Conectar Gemini'}</Button
      >
    </div>
    {#if !configured}<p class="mt-3 text-xs text-muted-foreground">
        Falta conectar uma chave do Google AI Studio. Os gráficos e a análise
        calculada acima já estão disponíveis.
      </p>{/if}
    {#if keyOpen}<form
        class="mt-5 grid max-w-xl gap-3 rounded-xl border p-4"
        onsubmit={(event) => {
          event.preventDefault();
          action('key', { key });
        }}
      >
        <label class="form-label"
          >Chave da API Gemini<Input
            type="password"
            bind:value={key}
            autocomplete="off"
            placeholder="Cole sua chave do AI Studio"
            required
          /></label
        >
        <p class="text-xs text-muted-foreground">
          Sua chave é armazenada criptografada. Para usar a cota gratuita,
          escolha uma chave de projeto sem faturamento. O Google define a cota e
          este app limita a 10 análises por dia.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}
            >Salvar chave com segurança</Button
          ><Button
            variant="link"
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer">Obter chave no Google ↗</Button
          >
        </div>
      </form>{/if}
  </Card.Content></Card.Root
>
