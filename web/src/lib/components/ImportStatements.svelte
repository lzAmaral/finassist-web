<script lang="ts">
  import { onMount } from 'svelte';
  import { money } from '#lib/finance.js';
  import {
    importRequest,
    defaultImportChoice,
    type ImportBatch,
    type ImportList
  } from '#lib/statement-import.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  let { available, hidden = false }: { available: boolean; hidden?: boolean } =
    $props();
  let data = $state<ImportList | null>(null),
    batch = $state<ImportBatch | null>(null);
  let busy = $state(false),
    error = $state(''),
    message = $state('');
  let accountId = $state(''),
    format = $state('csv'),
    file = $state<File | null>(null);
  let dateColumn = $state(1),
    descriptionColumn = $state(2),
    amountColumn = $state(3),
    currencyColumn = $state(0);
  let header = $state(true),
    decimal = $state(','),
    dateFormat = $state('DMY');
  let newAccountName = $state(''),
    newAccountBalance = $state<number | undefined>();
  let choices = $state<Record<number, string>>({}),
    pendingRevert = $state('');
  const show = (cents: number) => (hidden ? '••••••' : money(cents / 100));
  async function load() {
    data = await importRequest<ImportList>('/api/imports');
    if (!accountId && data.accounts.length) accountId = data.accounts[0].id;
  }
  async function run(work: () => Promise<void>) {
    busy = true;
    error = '';
    message = '';
    try {
      await work();
    } catch (e) {
      error =
        e instanceof Error ? e.message : 'Falha ao importar. Tente novamente.';
    } finally {
      busy = false;
    }
  }
  function selectBatch(value: ImportBatch) {
    batch = value;
    choices = Object.fromEntries(
      value.rows.map((row) => [row.number, defaultImportChoice(row)])
    );
  }
  onMount(() => {
    if (available) void run(load);
  });
  async function createAccount() {
    await run(async () => {
      const result = await importRequest<{ id: string }>(
        '/api/imports/accounts',
        { name: newAccountName, balance: newAccountBalance }
      );
      accountId = result.id;
      newAccountName = '';
      newAccountBalance = undefined;
      await load();
      message =
        'Conta local criada com o saldo informado. Importar movimentos não atualiza esse saldo.';
    });
  }
  async function preview() {
    if (!file || !accountId) {
      error = 'Selecione uma conta e um arquivo.';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      error = 'O arquivo deve ter até 2 MB.';
      return;
    }
    await run(async () => {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(
        await file!.arrayBuffer()
      );
      selectBatch(
        await importRequest<ImportBatch>('/api/imports/preview', {
          accountId,
          filename: file!.name,
          content,
          format,
          mapping: {
            date: dateColumn - 1,
            description: descriptionColumn - 1,
            amount: amountColumn - 1,
            currency: currencyColumn - 1,
            header,
            decimal,
            dateFormat
          }
        })
      );
      await load();
      if (batch?.status !== 'PREVIEW')
        message =
          'Este arquivo já foi processado nesta conta. Consulte o lote abaixo.';
    });
  }
  async function confirmBatch() {
    if (!batch) return;
    await run(async () => {
      const current = batch!;
      const decisions = current.rows.map((row) => {
        const choice = choices[row.number] ?? 'skip';
        return {
          row: row.number,
          action: choice.startsWith('match:') ? 'match' : choice,
          ...(choice.startsWith('match:')
            ? { paymentId: choice.slice(6) }
            : {}),
          candidateIds: row.candidates.map((candidate) => candidate.id)
        };
      });
      selectBatch(
        await importRequest<ImportBatch>(`/api/imports/${current.id}/confirm`, {
          decisions
        })
      );
      message = `Lote confirmado: ${batch!.created} movimento(s) criado(s). Correspondências e duplicados preservam os registros existentes.`;
      await load();
    });
  }
  async function openBatch(id: string) {
    await run(async () =>
      selectBatch(await importRequest<ImportBatch>(`/api/imports/${id}`))
    );
  }
  async function revert(id: string) {
    await run(async () => {
      selectBatch(
        await importRequest<ImportBatch>(`/api/imports/${id}/revert`, {})
      );
      pendingRevert = '';
      message =
        'Lote revertido. Registros preexistentes e movimentos já conciliados com Open Finance foram preservados.';
      await load();
    });
  }
</script>

<div class="space-y-5">
  <Card.Root class="shadow-none">
    <Card.Header
      ><Card.Title>Importar extrato</Card.Title><Card.Description
        >Revise os movimentos antes de gravar. CSV e OFX de contas bancárias em
        reais, até 2 MB e 2.000 linhas.</Card.Description
      ></Card.Header
    >
    <Card.Content>
      {#if !available}
        <p class="text-sm text-muted-foreground">
          A importação exige o backend Go conectado e pronto.
        </p>
      {:else}
        <details class="mb-5 rounded-lg border p-3">
          <summary class="cursor-pointer text-sm font-medium"
            >Banco sem conexão? Criar conta para importar</summary
          >
          <form
            class="mt-3 flex flex-wrap items-end gap-3"
            onsubmit={(event) => {
              event.preventDefault();
              void createAccount();
            }}
          >
            <label class="min-w-48 flex-1"
              >Nome da conta<input
                bind:value={newAccountName}
                required
                maxlength="100"
                disabled={busy}
              /></label
            ><label class="min-w-48 flex-1"
              >Saldo atual informado (R$)<input
                type="number"
                step="0.01"
                min="-1000000000"
                max="1000000000"
                bind:value={newAccountBalance}
                required
                disabled={busy}
              /></label
            ><Button type="submit" variant="outline" disabled={busy}
              >Criar conta local</Button
            >
          </form>
          <p class="mt-2 text-xs text-muted-foreground">
            Use uma conta já conectada para conciliar com Open Finance. O saldo
            informado é uma fotografia atual e não é recalculado pela
            importação. Uma conta local mantém histórico separado; conectar o
            mesmo banco depois exige revisar essa separação.
          </p>
        </details>
        <form
          class="grid gap-4 sm:grid-cols-2"
          onsubmit={(event) => {
            event.preventDefault();
            void preview();
          }}
          aria-label="Importar extrato"
        >
          <label
            >Conta<select bind:value={accountId} disabled={busy} required
              ><option value="">Selecione</option
              >{#each data?.accounts ?? [] as account}<option value={account.id}
                  >{account.name}</option
                >{/each}</select
            ></label
          >
          <label
            >Formato<select bind:value={format} disabled={busy}
              ><option value="csv">CSV</option><option value="ofx">OFX</option
              ></select
            ></label
          >
          <label class="sm:col-span-2"
            >Arquivo UTF-8<input
              type="file"
              accept=".csv,.ofx,text/csv,application/x-ofx"
              disabled={busy}
              required
              onchange={(event) => {
                file = event.currentTarget.files?.[0] ?? null;
              }}
            /></label
          >
          {#if format === 'csv'}
            <label
              >Coluna da data<input
                type="number"
                min="1"
                max="100"
                bind:value={dateColumn}
                required
                disabled={busy}
              /></label
            >
            <label
              >Coluna da descrição<input
                type="number"
                min="1"
                max="100"
                bind:value={descriptionColumn}
                required
                disabled={busy}
              /></label
            >
            <label
              >Coluna do valor com sinal<input
                type="number"
                min="1"
                max="100"
                bind:value={amountColumn}
                required
                disabled={busy}
              /></label
            >
            <label
              >Coluna da moeda (0 = BRL)<input
                type="number"
                min="0"
                max="100"
                bind:value={currencyColumn}
                required
                disabled={busy}
              /></label
            >
            <label
              >Datas<select bind:value={dateFormat} disabled={busy}
                ><option value="DMY">DD/MM/AAAA</option><option value="YMD"
                  >AAAA-MM-DD</option
                ></select
              ></label
            >
            <label
              >Separador decimal<select bind:value={decimal} disabled={busy}
                ><option value=",">Vírgula: 1.234,56</option><option value="."
                  >Ponto: 1234.56</option
                ></select
              ></label
            >
            <label class="flex items-center gap-2 sm:col-span-2"
              ><input
                class="checkbox"
                type="checkbox"
                bind:checked={header}
                disabled={busy}
              /> Primeira linha é cabeçalho</label
            >
            <p class="text-xs text-muted-foreground sm:col-span-2">
              Colunas começam em 1. Saídas têm sinal negativo; entradas,
              positivo. Separadores ; , e tabulação são detectados
              automaticamente. Usar BRL configura a moeda do arquivo.
            </p>
          {/if}
          {#if data && !data.accounts.length}<p class="text-sm sm:col-span-2">
              Nenhuma conta disponível. Crie uma conta local acima ou conecte um
              banco nas configurações.
            </p>{/if}
          <div class="sm:col-span-2">
            <Button type="submit" disabled={busy || !data?.accounts.length}
              >{busy ? 'Processando…' : 'Gerar prévia'}</Button
            >
          </div>
        </form>
      {/if}
    </Card.Content>
  </Card.Root>
  {#if error}<div
      role="alert"
      class="space-y-2 rounded-lg border border-destructive/40 p-4 text-sm"
    >
      <p>{error}</p>
      <Button
        variant="outline"
        disabled={busy}
        onclick={() =>
          run(async () => {
            if (batch)
              selectBatch(
                await importRequest<ImportBatch>(`/api/imports/${batch.id}`)
              );
            await load();
          })}>Recarregar dados e prévia</Button
      >
    </div>{/if}
  {#if message}<p role="status" class="text-sm">{message}</p>{/if}
  {#if batch}
    <Card.Root class="shadow-none"
      ><Card.Header
        ><Card.Title>Prévia: {batch.filename}</Card.Title><Card.Description
          >{batch.status === 'PREVIEW'
            ? 'Ainda não gravado. Revise possíveis correspondências; linhas inválidas serão ignoradas.'
            : batch.status === 'CONFIRMED'
              ? 'Lote confirmado'
              : 'Lote revertido'} · {batch.rows.length} linhas</Card.Description
        ></Card.Header
      ><Card.Content class="space-y-4">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead
              ><tr
                ><th>Linha / data</th><th>Descrição</th><th>Valor</th><th
                  >Revisão</th
                ></tr
              ></thead
            ><tbody
              >{#each batch.rows as row}<tr class="border-t"
                  ><td class="whitespace-nowrap"
                    >{row.number} · {row.date || '—'}</td
                  ><td class="min-w-40"
                    >{hidden ? '••••••' : row.description || '—'}</td
                  ><td class="whitespace-nowrap"
                    >{row.error ? '—' : show(row.cents)}</td
                  ><td class="min-w-60">
                    {#if row.error}<span class="text-destructive"
                        >{row.error}</span
                      >{:else if row.duplicate}<span
                        >Já importado nesta conta</span
                      >{:else if batch.status !== 'PREVIEW'}<span
                        >{row.action === 'created'
                          ? 'Criado'
                          : row.action === 'matched'
                            ? 'Correspondência preservada'
                            : row.action === 'preserved'
                              ? 'Preservado após conciliação'
                              : row.action === 'removed'
                                ? 'Removido na reversão'
                                : 'Ignorado'}</span
                      >{:else}<label
                        class="sr-only"
                        for={`import-choice-${row.number}`}
                        >Ação para linha {row.number}</label
                      ><select
                        id={`import-choice-${row.number}`}
                        bind:value={choices[row.number]}
                        disabled={busy}
                        ><option value="create">Criar movimento</option><option
                          value="skip">Ignorar linha</option
                        >{#each row.candidates as candidate}<option
                            value={`match:${candidate.id}`}
                            >Vincular: {candidate.external
                              ? 'Open Finance'
                              : 'existente'} · {candidate.date} · {hidden
                              ? '••••••'
                              : candidate.description}</option
                          >{/each}</select
                      >{#if row.candidates.length}<p
                          class="mt-1 text-xs text-muted-foreground"
                        >
                          Mesmo tipo, valor e conta, até 3 dias de diferença.
                          Confira a descrição antes de vincular.
                        </p>{/if}{/if}
                  </td></tr
                >{/each}</tbody
            >
          </table>
        </div>
        {#if batch.status === 'PREVIEW'}<p
            class="text-xs text-muted-foreground"
          >
            A prévia não altera saldos bancários. Ignore pagamentos de fatura,
            transferências entre suas contas e outros movimentos que já estejam
            contabilizados. A confirmação interpreta valores negativos como
            despesas e positivos como receitas; extratos de cartão não são
            aceitos.
          </p>
          <Button disabled={busy} onclick={confirmBatch}
            >Confirmar lote revisado</Button
          >{/if}
      </Card.Content></Card.Root
    >
  {/if}
  {#if data?.batches.length}<Card.Root class="shadow-none"
      ><Card.Header><Card.Title>Lotes recentes</Card.Title></Card.Header
      ><Card.Content
        ><ul class="divide-y">
          {#each data.batches as item}<li
              class="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div class="min-w-0">
                <p class="break-all text-sm font-medium">{item.filename}</p>
                <p class="text-xs text-muted-foreground">
                  {item.status === 'PREVIEW'
                    ? 'Prévia pendente'
                    : item.status === 'CONFIRMED'
                      ? 'Confirmado'
                      : 'Revertido'}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onclick={() => openBatch(item.id)}>Abrir lote</Button
                >{#if item.status === 'CONFIRMED'}{#if pendingRevert === item.id}<Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onclick={() => revert(item.id)}>Confirmar reversão</Button
                    ><Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onclick={() => (pendingRevert = '')}>Cancelar</Button
                    >{:else}<Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onclick={() => (pendingRevert = item.id)}
                      >Reverter lote</Button
                    >{/if}{/if}
              </div>
              {#if pendingRevert === item.id}<p
                  class="w-full text-xs text-muted-foreground"
                >
                  Remove apenas movimentos criados por este lote que ainda não
                  foram conciliados com Open Finance.
                </p>{/if}
            </li>{/each}
        </ul></Card.Content
      ></Card.Root
    >{/if}
</div>

<style>
  label {
    display: grid;
    gap: 0.375rem;
    font-size: 0.875rem;
  }
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
  .checkbox {
    width: auto;
  }
  th,
  td {
    padding: 0.75rem 0.5rem;
    vertical-align: top;
  }
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
</style>
