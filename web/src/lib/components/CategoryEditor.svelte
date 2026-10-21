<script lang="ts">
  import { money } from '#lib/finance.js';
  import {
    categoryOptions,
    categoryRequest,
    previewStillApplies,
    type CategoryPreview,
    type CategoryReviewItem,
    type CategoryScope
  } from '#lib/category-review.js';
  let {
    transaction,
    reviewItem,
    hidden = false,
    onchanged
  }: {
    transaction: {
      id: string;
      description: string;
      category: string;
      kind?: string;
    };
    reviewItem?: CategoryReviewItem;
    hidden?: boolean;
    onchanged?: () => void | Promise<void>;
  } = $props();
  let open = $state(false);
  let category = $state('OTHER');
  let scope = $state<CategoryScope>('transaction');
  let item = $state<CategoryReviewItem | null>(null);
  let preview = $state<CategoryPreview | null>(null);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  let version = 0;
  async function start() {
    open = true;
    category = transaction.category;
    scope = 'transaction';
    preview = null;
    error = '';
    message = '';
    item = reviewItem ?? null;
    if (!item) {
      busy = true;
      try {
        item = await categoryRequest<CategoryReviewItem>(
          `/api/categorize/transactions/${encodeURIComponent(transaction.id)}`
        );
      } catch (e) {
        error =
          e instanceof Error ? e.message : 'Falha ao carregar lançamento.';
      } finally {
        busy = false;
      }
    }
  }
  async function showPreview() {
    if (!item) return;
    const requestVersion = ++version;
    const key = item.key,
      selected = category;
    busy = true;
    error = '';
    preview = null;
    try {
      const result = await categoryRequest<CategoryPreview>(
        '/api/categorize/preview',
        'POST',
        { key, category: selected }
      );
      if (requestVersion === version && category === selected) preview = result;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Falha ao carregar prévia.';
    } finally {
      busy = false;
    }
  }
  async function save() {
    if (
      !item ||
      (scope !== 'transaction' &&
        !previewStillApplies(preview, item.key, category))
    )
      return;
    busy = true;
    error = '';
    message = '';
    try {
      if (scope === 'transaction') {
        await categoryRequest(
          `/api/categorize/transactions/${encodeURIComponent(item.id)}`,
          'PUT',
          { category }
        );
      } else {
        await categoryRequest('/api/categorize/rules', 'PUT', {
          key: item.key,
          category,
          applyExisting: scope === 'existing',
          previewHash: preview?.hash
        });
      }
      message =
        scope === 'transaction'
          ? 'Categoria salva para este lançamento.'
          : scope === 'future'
            ? 'Regra salva para os próximos lançamentos.'
            : 'Regra salva e aplicada aos lançamentos da prévia.';
      open = false;
      preview = null;
      await onchanged?.();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Falha ao salvar.';
      preview = null;
    } finally {
      busy = false;
    }
  }
</script>

{#if transaction.kind === undefined || transaction.kind === 'EXPENSE'}
  {#if !open}<button type="button" class="category-trigger" onclick={start}
      >Editar categoria<span class="sr-only">
        de {transaction.description}</span
      ></button
    >{/if}
  {#if message}<p class="feedback" role="status">{message}</p>{/if}
  {#if open}
    <form
      class="category-editor"
      onsubmit={(event) => {
        event.preventDefault();
        save();
      }}
      aria-label={`Categoria de ${transaction.description}`}
    >
      <p class="editor-title">
        {transaction.description || 'Lançamento sem descrição'}
      </p>
      <label
        >Categoria
        <select
          bind:value={category}
          onchange={() => {
            preview = null;
            version++;
          }}
          disabled={busy}
        >
          {#each categoryOptions as [value, label]}<option {value}
              >{label}</option
            >{/each}
        </select>
      </label>
      <label
        >Alcance da alteração
        <select
          bind:value={scope}
          onchange={() => {
            preview = null;
            version++;
          }}
          disabled={busy || !item}
        >
          <option value="transaction">Somente este lançamento</option>
          {#if item?.ruleAllowed}<option value="future"
              >Criar regra só para próximos semelhantes</option
            ><option value="existing"
              >Criar regra e reaplicar aos existentes</option
            >{/if}
        </select>
      </label>
      {#if item && !item.ruleAllowed}<p class="hint">
          Pix e transferências exigem correção individual para evitar
          classificar destinatários diferentes juntos.
        </p>{/if}
      {#if scope === 'transaction'}<p class="hint">
          Outras parcelas e recorrências não mudam. A correção permanece após
          sincronizar.
        </p>
      {:else}
        <p class="hint">
          A regra compara a descrição completa, preservando números e pontuação.
          Correções individuais têm prioridade.
        </p>
        <button type="button" onclick={showPreview} disabled={busy}
          >Ver prévia do alcance</button
        >
        {#if previewStillApplies(preview, item?.key ?? '', category) && preview}
          <div class="preview" aria-live="polite">
            <p>
              <strong
                >{preview.count} lançamento(s) existente(s) com a mesma descrição.</strong
              >
            </p>
            <p>
              {scope === 'future'
                ? 'Estes lançamentos ficam como estão; a regra vale somente para os próximos.'
                : 'Estes lançamentos recebem a categoria selecionada; valores e situações permanecem.'}
            </p>
            <ul>
              {#each preview.items as entry (entry.id)}<li>
                  {entry.date.slice(0, 10).split('-').reverse().join('/')} · {entry.description}
                  · {hidden ? '••••' : money(entry.amount)} · {entry.status}
                </li>{/each}
            </ul>
            <p>
              Remover a regra depois interrompe a aplicação futura. As correções
              já aplicadas permanecem.
            </p>
          </div>
        {/if}
      {/if}
      {#if error}<p role="alert" class="error">{error}</p>{/if}
      <div class="actions">
        <button
          type="submit"
          disabled={busy ||
            !item ||
            (scope !== 'transaction' &&
              !previewStillApplies(preview, item.key, category))}
          >{busy ? 'Processando…' : 'Salvar categoria'}</button
        ><button
          type="button"
          disabled={busy}
          onclick={() => {
            open = false;
          }}>Cancelar</button
        >
      </div>
    </form>
  {/if}
{/if}

<style>
  .category-trigger {
    font-size: 0.75rem;
    color: var(--accent, #665cdb);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .category-editor {
    text-align: left;
    display: grid;
    gap: 0.8rem;
    padding: 1rem;
    border: 1px solid var(--border, #ddd);
    border-radius: 0.8rem;
    min-width: min(23rem, 100%);
    background: var(--surface, #fff);
    color: var(--text, #17203a);
  }
  .editor-title {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  label {
    display: grid;
    gap: 0.35rem;
    font-size: 0.8rem;
  }
  select {
    padding: 0.6rem;
    border: 1px solid #c9ced8;
    border-radius: 0.4rem;
    width: 100%;
    background: inherit;
    color: inherit;
  }
  button {
    cursor: pointer;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--border, #d5d8e0);
    border-radius: 0.4rem;
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .actions button:first-child {
    background: #6155ca;
    color: white;
  }
  .hint,
  .preview,
  .feedback {
    font-size: 0.75rem;
    line-height: 1.6;
  }
  .preview {
    padding: 0.75rem;
    border-radius: 0.4rem;
    background: #f0effb;
  }
  .preview ul {
    max-height: 12rem;
    overflow: auto;
    padding-left: 1rem;
  }
  .error {
    color: #b42318;
    font-size: 0.8rem;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
