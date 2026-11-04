<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { money, monthLabel } from '#lib/finance.js';
  import { planningRequest } from '#lib/planning.js';
  import {
    budgetInputValue,
    budgetStatusLabels,
    parseBudgetCents,
    type CategoryBudget,
    type CategoryBudgetsData
  } from '#lib/category-budgets.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';

  let { month, hidden = false }: { month: string; hidden?: boolean } = $props();
  let data = $state<CategoryBudgetsData | null>(null);
  let loading = $state(false),
    saving = $state(false),
    error = $state(''),
    message = $state('');
  let editing = $state<CategoryBudget | null>(null),
    amount = $state(''),
    removing = $state(false);
  let generation = 0;
  let selectedCategory = $state('');
  let availableCategories = $derived(
    data?.items.filter((item) => item.limitCents === null) ?? []
  );
  let visibleCategories = $derived(
    data?.items.filter((item) => item.count > 0 || item.limitCents !== null) ??
      []
  );
  const display = (cents: number) => (hidden ? '••••••' : money(cents / 100));

  async function load(selectedMonth: string) {
    const request = ++generation;
    loading = true;
    saving = false;
    error = '';
    editing = null;
    removing = false;
    selectedCategory = '';
    data = null;
    try {
      const result = await planningRequest<CategoryBudgetsData>(
        `/api/budget-limits?month=${encodeURIComponent(selectedMonth)}`
      );
      if (request === generation) data = result;
    } catch (e) {
      if (request === generation)
        error =
          e instanceof Error
            ? e.message
            : 'Não foi possível carregar os limites.';
    } finally {
      if (request === generation) loading = false;
    }
  }
  $effect(() => {
    message = '';
    void load(month);
  });
  onDestroy(() => {
    generation++;
  });

  async function edit(item: CategoryBudget) {
    editing = item;
    amount = budgetInputValue(item.limitCents);
    removing = false;
    error = '';
    message = '';
    await tick();
    if (editing === item)
      document.getElementById('category-budget-amount')?.focus();
  }
  async function save(remove = false) {
    if (!editing || saving) return;
    const cents = parseBudgetCents(amount);
    if (!remove && cents === null) {
      error =
        'Informe um valor de zero a R$ 1 bilhão, com até dois decimais, sem separador de milhar.';
      return;
    }
    const item = editing,
      selectedMonth = month,
      request = generation;
    saving = true;
    error = '';
    message = '';
    try {
      await planningRequest(
        `/api/budget-limits/${encodeURIComponent(item.category)}?month=${encodeURIComponent(selectedMonth)}`,
        remove ? 'DELETE' : 'PUT',
        remove
          ? { version: item.version }
          : { limitCents: cents, version: item.version }
      );
      if (request !== generation) return;
      message = `${remove ? 'Limite removido' : 'Limite salvo'} para ${item.label} em ${monthLabel(selectedMonth)}.`;
      await load(selectedMonth);
    } catch (e) {
      if (request === generation)
        error =
          e instanceof Error ? e.message : 'Não foi possível salvar o limite.';
    } finally {
      if (request === generation) saving = false;
    }
  }
</script>

<Card.Root class="shadow-none">
  <Card.Header>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Card.Title>Limites por categoria</Card.Title>
        <p class="mt-2 text-sm text-muted-foreground">
          Planeje {monthLabel(month)}. Cada limite vale apenas para este mês.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onclick={() => load(month)}
        disabled={loading || saving}>Atualizar limites</Button
      >
    </div>
  </Card.Header>
  <Card.Content class="space-y-4">
    <p class="text-sm text-muted-foreground">
      O uso soma despesas pagas e pendentes pelo mês de vencimento; sem
      vencimento, usa a referência ou a data de registro. Receitas,
      transferências e cancelamentos ficam fora. Confira a cobertura dos seus
      dados antes de decidir gastar.
    </p>
    {#if message}<p role="status" class="text-sm">{message}</p>{/if}
    {#if error}<div
        role="alert"
        class="rounded-lg border border-destructive/40 p-3 text-sm"
      >
        <p>{error}</p>
        <p class="mt-1">
          Use “Atualizar limites” para conferir os dados novamente.
        </p>
      </div>{/if}
    {#if loading}<p role="status" class="text-sm text-muted-foreground">
        Carregando limites…
      </p>{/if}
    {#if editing}
      <form
        class="space-y-3 rounded-lg border bg-muted/30 p-4"
        onsubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h3 class="font-medium">
          Limite de {editing.label} — {monthLabel(month)}
        </h3>
        <label class="block text-sm" for="category-budget-amount"
          >Limite mensal (R$)</label
        >
        <input
          id="category-budget-amount"
          type={hidden ? 'password' : 'text'}
          inputmode="decimal"
          autocomplete="off"
          bind:value={amount}
          disabled={saving || removing}
          aria-describedby="category-budget-help"
        />
        <p id="category-budget-help" class="text-xs text-muted-foreground">
          Exemplo: 500,50. Zero é um limite válido. Remover o limite deixa a
          categoria sem teto; as despesas são preservadas.
        </p>
        {#if removing}
          <p class="text-sm">
            Remover o limite de {editing.label} apenas em {monthLabel(month)}?
          </p>
          <div class="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onclick={() => save(true)}>Confirmar remoção</Button
            ><Button
              type="button"
              variant="outline"
              disabled={saving}
              onclick={() => (removing = false)}>Manter limite</Button
            >
          </div>
        {:else}
          <div class="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}
              >{saving ? 'Salvando…' : 'Salvar limite'}</Button
            >
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onclick={() => (editing = null)}>Cancelar edição</Button
            >
            {#if editing.limitCents !== null}<Button
                type="button"
                variant="outline"
                disabled={saving}
                onclick={() => (removing = true)}>Remover limite</Button
              >{/if}
          </div>
        {/if}
      </form>
    {/if}
    {#if data}
      {#if availableCategories.length > 0}
        <form
          class="flex flex-wrap items-end gap-3"
          onsubmit={(event) => {
            event.preventDefault();
            const item = availableCategories.find(
              (item) => item.category === selectedCategory
            );
            if (item) void edit(item);
          }}
        >
          <div class="min-w-0 flex-1">
            <label for="category-budget-category" class="mb-2 block text-sm"
              >Categoria para definir limite</label
            >
            <select
              id="category-budget-category"
              bind:value={selectedCategory}
              disabled={saving}
            >
              <option value="">Escolha uma categoria</option>
              {#each availableCategories as item}<option value={item.category}
                  >{item.label}</option
                >{/each}
            </select>
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={saving || !selectedCategory}
            >Definir limite da categoria</Button
          >
        </form>
      {/if}
      {#if visibleCategories.length === 0}<p
          class="text-sm text-muted-foreground"
        >
          Nenhuma despesa ou limite registrado neste mês. Você pode definir um
          limite antes de começar a gastar; confira também a cobertura das suas
          contas.
        </p>{/if}
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {#each visibleCategories as item (item.category)}
          <article
            class="min-w-0 rounded-lg border p-4"
            aria-label={`Orçamento de ${item.label}`}
          >
            <h3 class="font-medium">{item.label}</h3>
            <p
              class="mt-1 text-xs"
              class:text-destructive={item.status === 'exceeded'}
            >
              {budgetStatusLabels[item.status]}
            </p>
            <dl class="mt-3 space-y-1 text-sm">
              <div class="flex flex-wrap justify-between gap-2">
                <dt>Limite</dt>
                <dd>
                  {item.limitCents === null
                    ? 'Não definido'
                    : display(item.limitCents)}
                </dd>
              </div>
              <div class="flex flex-wrap justify-between gap-2">
                <dt>Despesas registradas</dt>
                <dd>{display(item.spentCents)}</dd>
              </div>
              <div
                class="flex flex-wrap justify-between gap-2 text-muted-foreground"
              >
                <dt>Pagas</dt>
                <dd>{display(item.paidCents)}</dd>
              </div>
              <div
                class="flex flex-wrap justify-between gap-2 text-muted-foreground"
              >
                <dt>Pendentes</dt>
                <dd>{display(item.pendingCents)}</dd>
              </div>
              {#if item.remainingCents !== null}<div
                  class="flex flex-wrap justify-between gap-2"
                >
                  <dt>
                    {item.remainingCents < 0
                      ? 'Excesso registrado'
                      : 'Restante do limite'}
                  </dt>
                  <dd>{display(Math.abs(item.remainingCents))}</dd>
                </div>{/if}
            </dl>
            {#if item.count === 0}<p class="mt-2 text-xs text-muted-foreground">
                Sem despesas registradas. Confira se todas as contas foram
                incluídas.
              </p>{:else if item.usagePercent !== null && !hidden}<p
                class="mt-2 text-xs text-muted-foreground"
              >
                {item.usagePercent.toLocaleString('pt-BR', {
                  maximumFractionDigits: 1
                })}% do limite registrado
              </p>{/if}
            <Button
              class="mt-3"
              size="sm"
              variant="outline"
              disabled={saving || loading}
              onclick={() => edit(item)}
              aria-label={`${item.limitCents === null ? 'Definir' : 'Editar'} limite de ${item.label}`}
              >{item.limitCents === null
                ? 'Definir limite'
                : 'Editar limite'}</Button
            >
          </article>
        {/each}
      </div>
    {/if}
  </Card.Content>
</Card.Root>

<style>
  input,
  select {
    width: 100%;
    max-width: 24rem;
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
</style>
