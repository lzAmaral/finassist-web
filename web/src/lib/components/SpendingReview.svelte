<script lang="ts">
  import { money, monthLabel } from '#lib/finance.js';
  import {
    loadSpendingReview,
    setReviewDecision,
    setReviewDismissal
  } from '#lib/review-api.js';
  import {
    canRecordCancellation,
    reviewKindLabel,
    reviewPriorities,
    reviewReason,
    savingsStatus,
    type ReviewCandidate,
    type SavingDecision,
    type SpendingReviewData,
    type ReviewSavings
  } from '#lib/spending-review.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Badge } from '#lib/components/ui/badge/index.js';
  let {
    available,
    month,
    hidden = false,
    overview = false
  }: {
    available: boolean;
    month: string;
    hidden?: boolean;
    overview?: boolean;
  } = $props();
  let review = $state<SpendingReviewData | null>(null),
    savings = $state<ReviewSavings | null>(null);
  let loading = $state(false),
    saving = $state(false),
    error = $state(''),
    message = $state('');
  let version = 0;
  const display = (amount: number) => (hidden ? '••••••' : money(amount));
  const priorities = $derived(
    reviewPriorities(review?.candidates ?? [], overview)
  );
  const dismissed = $derived(
    (review?.candidates ?? []).filter((candidate) => candidate.dismissed)
  );
  const returned = $derived(
    (savings?.decisions ?? []).filter(
      (decision) => decision.status === 'RETURNED'
    )
  );
  async function load(selectedMonth = month) {
    const request = ++version;
    loading = true;
    error = '';
    review = null;
    savings = null;
    try {
      const data = await loadSpendingReview(selectedMonth);
      if (request === version) {
        review = data.review;
        savings = data.savings;
      }
    } catch (e) {
      if (request === version)
        error =
          e instanceof Error
            ? e.message
            : 'Não foi possível carregar a revisão.';
    } finally {
      if (request === version) loading = false;
    }
  }
  $effect(() => {
    if (available) void load(month);
    else {
      version++;
      review = null;
      savings = null;
      loading = false;
    }
  });
  async function dismiss(candidate: ReviewCandidate, value: boolean) {
    saving = true;
    error = '';
    message = '';
    try {
      await setReviewDismissal(candidate, value);
      await load();
      message = value
        ? 'Sugestão dispensada. A dispensa permanece após sincronizar.'
        : 'Sugestão restaurada.';
    } catch (e) {
      error =
        e instanceof Error ? e.message : 'Não foi possível salvar a dispensa.';
    } finally {
      saving = false;
    }
  }
  async function decide(
    candidate: ReviewCandidate | SavingDecision,
    value: boolean
  ) {
    saving = true;
    error = '';
    message = '';
    try {
      await setReviewDecision(candidate, month, value);
      await load();
      message = value
        ? 'Decisão registrada. A economia será conferida nos meses seguintes.'
        : 'Decisão desfeita e sugestão restaurada.';
    } catch (e) {
      error =
        e instanceof Error ? e.message : 'Não foi possível salvar a decisão.';
    } finally {
      saving = false;
    }
  }
</script>

<Card.Root class="min-w-0 shadow-none">
  <Card.Header
    ><div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Card.Title
          >{overview
            ? 'O que precisa da sua atenção'
            : 'Revisão de gastos'}</Card.Title
        ><Card.Description class="mt-2"
          >{monthLabel(month)} · hipóteses para conferir com os lançamentos.</Card.Description
        >
      </div>
      {#if overview}<a
          href="/revisao"
          class="text-sm font-medium underline underline-offset-4"
          >Ver revisão completa</a
        >{/if}
    </div></Card.Header
  >
  <Card.Content class="space-y-4">
    {#if !available}<p class="text-sm text-muted-foreground">
        A revisão de gastos e as decisões de economia precisam do backend Go
        conectado. No modo cloud, este recurso está indisponível.
      </p>
    {:else}
      {#if error}<div
          role="alert"
          class="space-y-2 rounded-lg border border-destructive/40 p-3 text-sm"
        >
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || saving}
            onclick={() => load()}>Tentar novamente</Button
          >
        </div>{/if}
      {#if message}<p role="status" class="text-sm">{message}</p>{/if}
      {#if loading}<p role="status" class="text-sm text-muted-foreground">
          Carregando evidências e decisões…
        </p>{/if}
      {#if review && savings}
        {#if review.historyMonths < 2}<p
            class="rounded-lg bg-muted/50 p-3 text-sm"
          >
            Histórico curto: {review.historyMonths} mês(es) anterior(es) com despesas
            na janela de seis meses. Recorrências podem ainda não ser detectadas.
            Ausência de sugestão não confirma ausência de problemas.
          </p>{/if}
        {#if overview && returned.length > 0}<p
            class="rounded-lg border border-amber-500/40 p-3 text-sm"
          >
            {returned.length} cobrança(s) voltaram após uma decisão registrada.
            <a href="/revisao" class="underline">Conferir decisões</a>
          </p>{/if}
        {#if priorities.length === 0}<p class="text-sm text-muted-foreground">
            Nenhuma prioridade ativa neste período com a evidência disponível.
          </p>{/if}
        {#each priorities as candidate}
          <article class="min-w-0 space-y-3 rounded-lg border p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-xs text-muted-foreground">
                  {reviewKindLabel[candidate.kind]}
                </p>
                <h3 class="mt-1 break-words text-sm font-semibold">
                  {candidate.label}
                </h3>
              </div>
              <Badge variant="outline">Hipótese para revisar</Badge>
            </div>
            <p class="text-sm leading-relaxed text-muted-foreground">
              {reviewReason(candidate)}
            </p>
            <p class="text-sm">
              Economia potencial: <strong>{display(candidate.monthly)}</strong
              >{candidate.annual !== null ? '/mês' : ' uma vez'}. {candidate.annual !==
              null
                ? `Projeção de 12 meses: ${display(candidate.annual)}.`
                : ''} Não representa economia já obtida.
            </p>
            {#if candidate.kind === 'INCREASE'}<p
                class="text-xs text-muted-foreground"
              >
                Gasto no período: {display(candidate.amount)} · média de comparação:
                {display(candidate.baseline)}.
              </p>{/if}
            <details>
              <summary class="cursor-pointer text-sm font-medium"
                >Ver transações e período da evidência</summary
              >
              <div class="mt-3 space-y-3 text-sm">
                <p>
                  Transações em {monthLabel(review.month)}. A descrição é
                  normalizada pelo Go; estabelecimentos parecidos podem se
                  agrupar.
                </p>
                {#if candidate.evidence?.length}<ul class="divide-y">
                    {#each candidate.evidence as evidence}<li
                        class="flex flex-wrap justify-between gap-2 py-2"
                      >
                        <span class="min-w-0 break-words"
                          >{evidence.date.split('-').reverse().join('/')} · {evidence.label}</span
                        ><span>{display(evidence.amount)}</span>
                      </li>{/each}
                  </ul>{:else}<p>
                    Os lançamentos individuais não estão disponíveis nesta base.
                    Revise a categoria antes de decidir.
                  </p>{/if}
                {#if candidate.history?.length}<p
                    class="text-xs text-muted-foreground"
                  >
                    {candidate.kind === 'INCREASE'
                      ? 'Meses usados na média da categoria'
                      : 'Histórico mensal da descrição (até 12 meses)'}:
                  </p>
                  <ul class="flex flex-wrap gap-x-4 gap-y-2">
                    {#each candidate.history as entry}<li>
                        {monthLabel(entry.month)}: {display(entry.amount)}
                      </li>{/each}
                  </ul>{/if}
                <a
                  href={`/transacoes?month=${encodeURIComponent(review.month)}`}
                  class="inline-block underline underline-offset-4"
                  >Abrir transações do mês</a
                >
              </div>
            </details>
            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={saving || loading}
                onclick={() => dismiss(candidate, true)}
                >Dispensar<span class="sr-only">
                  {candidate.label}</span
                ></Button
              >{#if canRecordCancellation(candidate)}<Button
                  variant="outline"
                  size="sm"
                  disabled={saving || loading || !candidate.evidence?.length}
                  onclick={() => decide(candidate, true)}
                  >Registrar que parei de pagar<span class="sr-only">
                    {candidate.label}</span
                  ></Button
                >{/if}
            </div>
          </article>
        {/each}
        {#if !overview}
          <section class="space-y-3 border-t pt-4">
            <h3 class="font-semibold">Decisões e economia observada</h3>
            <p class="text-sm">
              Economia observada na base: <strong
                >{display(savings.realized)}</strong
              >.
            </p>
            <p class="text-xs leading-relaxed text-muted-foreground">
              O Go compara o custo registrado com os meses seguintes. Só meses
              fechados com despesas importadas entram na observação; isso não
              garante importação completa. Cobrança inferior à metade do custo
              anterior é tratada como residual. O mês aberto só serve para
              detectar retorno. A decisão registra que você parou de pagar,
              usando o custo original como referência; não cancela serviços
              automaticamente.
            </p>
            {#if savings.decisions.length === 0}<p
                class="text-sm text-muted-foreground"
              >
                Nenhuma decisão registrada.
              </p>{/if}
            {#each savings.decisions as decision}<article
                class="space-y-2 rounded-lg border p-3"
              >
                <h4 class="break-words text-sm font-medium">
                  {decision.label || decision.key}
                </h4>
                <p
                  class="text-sm"
                  class:text-amber-700={decision.status === 'RETURNED'}
                >
                  {savingsStatus(decision)}
                </p>
                <p class="text-xs text-muted-foreground">
                  Decisão: {monthLabel(decision.month)} · custo mensal de referência:
                  {display(decision.monthly)} · {decision.monthsConfirmed} mês(es)
                  fechado(s) sem cobrança · observado: {display(
                    decision.realized
                  )}.
                </p>
                {#if decision.status === 'RETURNED'}<p class="text-sm">
                    Cobrança encontrada após a decisão: {display(
                      decision.returned
                    )}. Confira o histórico antes de considerar resolvido.
                  </p>{/if}<Button
                  variant="outline"
                  size="sm"
                  disabled={saving || loading}
                  onclick={() => decide(decision, false)}
                  >Desfazer decisão<span class="sr-only">
                    {decision.label || decision.key}</span
                  ></Button
                >
              </article>{/each}
          </section>
          <details>
            <summary class="cursor-pointer text-sm font-medium"
              >Sugestões dispensadas neste mês ({dismissed.length})</summary
            >
            <p class="mt-2 text-xs text-muted-foreground">
              A dispensa vale para tipo e descrição em todos os meses. Decisões
              também dispensam a sugestão; use “Desfazer decisão” para
              retomá-la.
            </p>
            {#each dismissed as candidate}<div
                class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <span class="break-words text-sm"
                  >{candidate.label} · {reviewKindLabel[candidate.kind]}</span
                ><Button
                  variant="outline"
                  size="sm"
                  disabled={saving ||
                    loading ||
                    savings.decisions.some(
                      (decision) =>
                        decision.kind === candidate.kind &&
                        decision.key === candidate.key
                    )}
                  onclick={() => dismiss(candidate, false)}
                  >Restaurar<span class="sr-only">
                    {candidate.label}</span
                  ></Button
                >
              </div>{/each}
          </details>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || saving}
            onclick={() => load()}>Atualizar revisão</Button
          >
        {/if}
      {/if}
    {/if}
  </Card.Content>
</Card.Root>
