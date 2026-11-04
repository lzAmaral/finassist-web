<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { money } from '#lib/finance.js';
  import {
    ManualEntrySession,
    loadManualAccounts,
    prepareManualPayload,
    manualCategories,
    manualPaymentMethods,
    manualMinimumDate,
    manualAccountLabel,
    type ManualAccount,
    type ManualPayload,
    type ManualReceipt
  } from '#lib/manual-entry.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';

  let {
    enabled,
    hidden = false,
    referenceDate,
    onSaved
  }: {
    enabled: boolean;
    hidden?: boolean;
    referenceDate: string;
    onSaved?: (date: string) => void | Promise<void>;
  } = $props();
  let accounts = $state<ManualAccount[]>([]);
  let loading = $state(false),
    accountsError = $state(''),
    error = $state('');
  let ready = $state(false),
    open = $state(false);
  let mounted = $state(false);
  let amount = $state(''),
    description = $state(''),
    date = $state('');
  let accountId = $state(''),
    category = $state(''),
    paymentMethod = $state('');
  let confirmation = $state<ManualPayload | null>(null);
  let reviewElement = $state<HTMLDivElement>();
  let session = $state.raw<ManualEntrySession | null>(null);
  let view = $state<{
    pending: ManualPayload | null;
    receipt: ManualReceipt | null;
    confirmedPayload: ManualPayload | null;
    saving: boolean;
    blocked: boolean;
    error: string;
    storageWarning: string;
    refreshError: string;
  }>({
    pending: null,
    receipt: null,
    confirmedPayload: null,
    saving: false,
    blocked: false,
    error: '',
    storageWarning: '',
    refreshError: ''
  });
  let details = $derived(view.confirmedPayload ?? view.pending ?? confirmation);
  const show = (value: string) => (hidden ? '••••••' : value);
  const label = (
    options: readonly (readonly [string, string])[],
    key: string
  ) => options.find(([value]) => value === key)?.[1] ?? key;
  const displayDate = (value: string) => value.split('-').reverse().join('/');
  const accountLabel = (id: string) => {
    const account = accounts.find((item) => item.id === id);
    return account
      ? manualAccountLabel(account, accounts)
      : 'Conta selecionada na tentativa';
  };
  function sync() {
    if (!session) return;
    view = {
      pending: session.pending,
      receipt: session.receipt,
      confirmedPayload: session.confirmedPayload,
      saving: session.saving,
      blocked: session.blocked,
      error: session.error,
      storageWarning: session.storageWarning,
      refreshError: session.refreshError
    };
  }
  async function loadAccounts() {
    if (!enabled || loading) return;
    loading = true;
    accountsError = '';
    try {
      accounts = await loadManualAccounts();
    } catch {
      accountsError = 'não foi possível carregar as contas. Tente novamente.';
    } finally {
      loading = false;
    }
  }
  onMount(() => {
    mounted = true;
  });
  $effect(() => {
    if (!mounted || !enabled || session) return;
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      /* A sessão informa a limitação abaixo. */
    }
    session = new ManualEntrySession(storage);
    sync();
    date = referenceDate;
    ready = true;
    if (session.pending || session.blocked) open = true;
    void loadAccounts();
  });
  async function review() {
    if (
      !enabled ||
      !ready ||
      !session ||
      view.pending ||
      view.saving ||
      view.blocked
    )
      return;
    error = '';
    try {
      confirmation = prepareManualPayload(
        { amount, description, date, accountId, category, paymentMethod },
        accounts,
        referenceDate,
        crypto.randomUUID()
      );
      await tick();
      reviewElement?.focus();
    } catch (cause) {
      error =
        cause instanceof Error
          ? cause.message
          : 'não foi possível preparar o lançamento. Tente novamente.';
    }
  }
  async function save() {
    if (!enabled || !session || view.saving || (!confirmation && !view.pending))
      return;
    error = '';
    const operation = session.submit(
      view.pending ? undefined : confirmation!,
      onSaved
    );
    sync();
    try {
      await operation;
    } catch {
      error = 'resolva a tentativa pendente antes de iniciar outro lançamento.';
    }
    sync();
    if (view.receipt) confirmation = null;
    await tick();
    reviewElement?.focus();
  }
  function startAnother() {
    session?.startAnother();
    sync();
    confirmation = null;
    amount = '';
    description = '';
    date = referenceDate;
    accountId = '';
    category = '';
    paymentMethod = '';
    error = '';
  }
</script>

<Card.Root class="min-w-0 shadow-none">
  <Card.Header>
    <Card.Title>Lançamento rápido</Card.Title>
    <Card.Description>Registre uma despesa única já paga.</Card.Description>
  </Card.Header>
  <Card.Content class="min-w-0 space-y-4">
    {#if !enabled}
      <p class="text-sm text-muted-foreground">
        O lançamento de despesas ainda não está disponível nesta instalação.
        Você pode consultar os dados já conectados.
      </p>
    {/if}
    {#if enabled || view.receipt || view.pending}
      <p class="text-xs text-muted-foreground">
        A despesa entra nos seus registros. O saldo informado da conta não é
        atualizado. Parcelas, transferências e cartão de crédito ficam fora
        deste lançamento.
      </p>
      {#if loading}<p role="status" class="text-sm">Carregando contas…</p>{/if}
      {#if accountsError}
        <div role="alert" class="space-y-2 text-sm">
          <p>{accountsError}</p>
          <Button variant="outline" disabled={loading} onclick={loadAccounts}
            >Tentar carregar contas</Button
          >
        </div>
      {/if}
      {#if ready && !loading && !accountsError && !accounts.length}
        <p class="text-sm">
          Nenhuma conta bancária disponível. <a
            class="underline underline-offset-4"
            href="/importar">Crie uma conta local no fluxo de importação</a
          > para registrar despesas. Não é necessário conectar um banco.
        </p>
      {/if}
      {#if view.storageWarning}<p role="alert" class="text-sm">
          {view.storageWarning}
        </p>{/if}
      {#if error || view.error}<p role="alert" class="text-sm text-destructive">
          {error || view.error}
        </p>{/if}
      {#if view.refreshError}<p role="status" class="text-sm">
          {view.refreshError}
        </p>{/if}
      {#if !open}
        <Button
          disabled={!ready || loading || !accounts.length || view.blocked}
          onclick={() => (open = true)}>Lançar despesa</Button
        >
      {:else if details}
        <div
          bind:this={reviewElement}
          tabindex="-1"
          class="review space-y-3 rounded-lg border bg-muted/20 p-4"
        >
          <h3 class="font-medium">
            {view.receipt
              ? 'Despesa salva'
              : view.pending
                ? 'Tentativa pendente de confirmação'
                : 'Confira antes de salvar'}
          </h3>
          {#if view.receipt}<p role="status" class="text-sm">
              A gravação foi confirmada{view.receipt.replayed
                ? ' para a tentativa já enviada'
                : ''}.
            </p>
          {:else if view.pending}<p class="text-sm">
              O resultado ainda não foi confirmado. Reenvie os mesmos dados para
              resolver esta tentativa antes de começar outra. Fechar ou
              recarregar esta página mantém a tentativa quando o armazenamento
              da sessão está disponível.
            </p>
            {#if view.error}<p class="text-sm">
                Se a rejeição continuar, <a
                  class="underline underline-offset-4"
                  href={`/transacoes?month=${details.date.slice(0, 7)}`}
                  >confira as transações deste mês</a
                >
                e peça ajuda com o identificador desta tentativa:
                <span class="break-all">{show(details.requestId)}</span>. Não
                inicie uma nova tentativa para a mesma despesa enquanto houver
                dúvida.
              </p>{/if}
          {/if}
          <dl class="grid gap-2 text-sm">
            <div>
              <dt>Valor</dt>
              <dd>{show(money(details.amountCents / 100))}</dd>
            </div>
            <div>
              <dt>Descrição</dt>
              <dd>{show(details.description)}</dd>
            </div>
            <div>
              <dt>Dia</dt>
              <dd>{displayDate(details.date)}</dd>
            </div>
            <div>
              <dt>Conta</dt>
              <dd>
                {show(accountLabel(details.accountId))}
              </dd>
            </div>
            <div>
              <dt>Categoria</dt>
              <dd>{show(label(manualCategories, details.category))}</dd>
            </div>
            <div>
              <dt>Meio de pagamento</dt>
              <dd>
                {show(label(manualPaymentMethods, details.paymentMethod))}
              </dd>
            </div>
          </dl>
          <div class="flex flex-wrap gap-2">
            {#if view.receipt}
              <Button
                href={`/transacoes?month=${view.receipt.date.slice(0, 7)}`}
                variant="outline">Ver mês do lançamento</Button
              >
              <Button disabled={view.saving || !enabled} onclick={startAnother}
                >Lançar outra despesa</Button
              >
            {:else}
              <Button
                disabled={view.saving || view.blocked || !enabled}
                onclick={save}
                >{view.saving
                  ? 'Confirmando…'
                  : view.pending
                    ? 'Reenviar os mesmos dados'
                    : 'Confirmar e salvar despesa'}</Button
              >
              {#if !view.pending}<Button
                  variant="outline"
                  disabled={view.saving}
                  onclick={() => (confirmation = null)}>Voltar e editar</Button
                >{/if}
            {/if}
          </div>
        </div>
      {:else if !view.blocked}
        <form
          class="grid min-w-0 gap-4 sm:grid-cols-2"
          aria-label="Lançar despesa paga"
          onsubmit={(event) => {
            event.preventDefault();
            void review();
          }}
        >
          <label
            >Valor (R$)<input
              type={hidden ? 'password' : 'text'}
              inputmode="decimal"
              autocomplete="off"
              placeholder="1.234,56"
              bind:value={amount}
              required
              aria-describedby="manual-amount-help"
            /></label
          >
          <label
            >Dia<input
              type="date"
              bind:value={date}
              min={manualMinimumDate}
              max={referenceDate}
              required
            /><span class="text-xs text-muted-foreground"
              >De 01/01/2000 até hoje (São Paulo).</span
            ></label
          >
          <p
            id="manual-amount-help"
            class="text-xs text-muted-foreground sm:col-span-2"
          >
            Use vírgula para os centavos. Exemplo: 1.234,56. Limite: R$
            9.999.999.999,99.
          </p>
          <label class="sm:col-span-2"
            >Descrição<input
              type={hidden ? 'password' : 'text'}
              autocomplete="off"
              bind:value={description}
              required
            /></label
          >
          <label
            >Conta<select
              bind:value={accountId}
              required
              disabled={loading || !accounts.length}
              ><option value="">Escolha uma conta</option
              >{#each accounts as account}<option value={account.id}
                  >{show(manualAccountLabel(account, accounts))}</option
                >{/each}</select
            ></label
          >
          <label
            >Categoria<select bind:value={category} required
              ><option value="">Escolha a categoria</option
              >{#each manualCategories as [value, text]}<option {value}
                  >{text}</option
                >{/each}</select
            ></label
          >
          <label
            >Meio de pagamento<select bind:value={paymentMethod} required
              ><option value="">Escolha o meio</option
              >{#each manualPaymentMethods as [value, text]}<option {value}
                  >{text}</option
                >{/each}</select
            ></label
          >
          <div class="flex flex-wrap items-end gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={loading || !accounts.length || !ready}
              >Revisar despesa</Button
            >
            <Button variant="outline" onclick={() => (open = false)}
              >Fechar formulário</Button
            >
          </div>
        </form>
      {/if}
    {/if}
  </Card.Content>
</Card.Root>

<style>
  label {
    display: grid;
    min-width: 0;
    gap: 0.4rem;
    font-size: 0.875rem;
  }
  input,
  select {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--background);
    padding: 0.6rem 0.75rem;
    color: inherit;
  }
  input:focus-visible,
  select:focus-visible,
  .review:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  dt {
    color: var(--muted-foreground);
  }
  dd {
    overflow-wrap: anywhere;
  }
  .review :global(button),
  .review :global(a[data-slot='button']) {
    max-width: 100%;
    height: auto;
    min-height: 2rem;
    white-space: normal;
    text-align: center;
  }
</style>
