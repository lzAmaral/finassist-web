<script lang="ts">
  import { onMount } from 'svelte';
  import { money } from '#lib/finance.js';
  import {
    categoryName,
    categoryRequest,
    ruleLabel,
    type CategoryReviewData
  } from '#lib/category-review.js';
  import CategoryEditor from './CategoryEditor.svelte';
  let {
    available = false,
    hidden = false,
    onchanged
  }: {
    available?: boolean;
    hidden?: boolean;
    onchanged?: () => void | Promise<void>;
  } = $props();
  let data = $state<CategoryReviewData | null>(null);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  let offset = $state(0);
  let removing = $state('');
  async function load(next = offset) {
    if (!available) return;
    busy = true;
    error = '';
    try {
      const result = await categoryRequest<CategoryReviewData>(
        `/api/categorize/review?offset=${next}`
      );
      data = result;
      offset = next;
    } catch (e) {
      error =
        e instanceof Error ? e.message : 'Falha ao carregar classificação.';
    } finally {
      busy = false;
    }
  }
  async function changed() {
    await load(0);
    await onchanged?.();
  }
  async function remove(key: string) {
    busy = true;
    error = '';
    message = '';
    try {
      await categoryRequest(
        `/api/categorize/rules?key=${encodeURIComponent(key)}`,
        'DELETE'
      );
      message =
        'Regra removida. As correções já aplicadas permanecem; próximos lançamentos seguem a classificação importada ou outra regra existente.';
      removing = '';
      await changed();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Falha ao remover regra.';
    } finally {
      busy = false;
    }
  }
  onMount(() => {
    if (available) void load();
  });
</script>

<section class="classification" aria-labelledby="classification-title">
  <header>
    <div>
      <p class="eyebrow">Organização dos lançamentos</p>
      <h2 id="classification-title">Classificar e criar regras</h2>
      <p>
        Revise despesas em Outros ou edite uma categoria diretamente na lista de
        transações.
      </p>
    </div>
    {#if available}<button type="button" disabled={busy} onclick={() => load()}
        >Atualizar fila</button
      >{/if}
  </header>
  {#if !available}
    <div class="notice">
      <h3>Classificação disponível com o backend Go</h3>
      <p>
        Este modo permite consultar os dados sincronizados. Para corrigir
        categorias e salvar regras, configure a conexão com o backend
        Go/PostgreSQL.
      </p>
    </div>
  {:else}
    {#if error}<div class="notice error" role="alert">
        <p>{error}</p>
        <button type="button" onclick={() => load()} disabled={busy}
          >Tentar novamente</button
        >
      </div>{/if}
    {#if message}<p class="notice" role="status">{message}</p>{/if}
    {#if busy}<p role="status">Carregando classificação…</p>{/if}
    {#if data}
      <div class="review-heading">
        <h3>Fila de revisão</h3>
        <span>{data.total} pendente(s) · todos os meses</span>
      </div>
      <p class="help">
        Uma correção individual afeta apenas o lançamento escolhido. Regras
        exigem prévia e podem valer só para os próximos ou também para os
        existentes.
      </p>
      {#if data.total === 0}<p class="notice">
          Nenhuma despesa pendente em Outros. Você pode corrigir categorias pela
          lista de transações.
        </p>
      {:else}
        <div class="review-list">
          {#each data.items as item (item.id)}
            <article>
              <div class="entry">
                <div>
                  <strong>{item.description || 'Sem descrição'}</strong>
                  <p>
                    {item.date.slice(0, 10).split('-').reverse().join('/')} · {item.status}{#if !item.ruleAllowed}
                      · transferência{/if}
                  </p>
                </div>
                <strong>{hidden ? '••••' : money(item.amount)}</strong>
              </div>
              <CategoryEditor
                {hidden}
                transaction={item}
                reviewItem={item}
                onchanged={changed}
              />
            </article>
          {/each}
        </div>
        <div class="pagination">
          <button
            type="button"
            disabled={busy || offset === 0}
            onclick={() => load(Math.max(0, offset - data!.limit))}
            >Anteriores</button
          ><span
            >{offset + 1}–{Math.min(offset + data.items.length, data.total)} de {data.total}</span
          ><button
            type="button"
            disabled={busy || offset + data.limit >= data.total}
            onclick={() => load(offset + data!.limit)}>Próximos</button
          >
        </div>
      {/if}
      <div class="review-heading">
        <h3>Regras salvas</h3>
        <span>{data.rules.length} regra(s)</span>
      </div>
      <p class="help">
        Ao remover uma regra, as correções já aplicadas permanecem. Novos
        lançamentos deixam de receber essa regra. Regras antigas usam o
        agrupamento original; novas regras comparam a descrição completa.
      </p>
      {#if data.rules.length === 0}<p class="notice">
          Nenhuma regra salva.
        </p>{:else}
        <div class="rules">
          {#each data.rules as rule (rule.key)}<article>
              <div class="entry">
                <div>
                  <strong>{ruleLabel(rule.key)}</strong>
                  <p>
                    {categoryName(rule.category)} · {rule.key.startsWith(
                      'exact:'
                    )
                      ? 'descrição completa'
                      : 'regra legada'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onclick={() => {
                    removing = removing === rule.key ? '' : rule.key;
                  }}
                  >Remover<span class="sr-only">
                    regra de {ruleLabel(rule.key)}</span
                  ></button
                >
              </div>
              {#if removing === rule.key}<div class="confirmation">
                  <p>
                    Remover a regra de {ruleLabel(rule.key)}? As correções já
                    aplicadas permanecem. A mudança vale para os próximos
                    lançamentos.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onclick={() => remove(rule.key)}>Confirmar remoção</button
                  ><button
                    type="button"
                    disabled={busy}
                    onclick={() => {
                      removing = '';
                    }}>Cancelar</button
                  >
                </div>{/if}
            </article>{/each}
        </div>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .classification {
    display: grid;
    gap: 1.25rem;
    color: var(--text, #17203a);
  }
  header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }
  h2 {
    font-size: 1.45rem;
    font-weight: 650;
    margin: 0.25rem 0 0.5rem;
  }
  h3 {
    font-size: 1rem;
    font-weight: 600;
  }
  header p,
  .help,
  .notice,
  .entry p,
  .confirmation {
    font-size: 0.82rem;
    line-height: 1.7;
  }
  .eyebrow {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #7568cc;
  }
  .help,
  .entry p {
    color: var(--text-muted, #677187);
  }
  .review-heading,
  .entry,
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .review-heading span,
  .pagination span {
    font-size: 0.75rem;
    color: var(--text-muted, #677187);
  }
  .review-list,
  .rules {
    display: grid;
    gap: 0.75rem;
  }
  article {
    border: 1px solid var(--border, #e0e3eb);
    border-radius: 0.75rem;
    padding: 1rem;
    display: grid;
    gap: 0.6rem;
    background: var(--surface, #fff);
  }
  .entry strong {
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }
  .entry > strong {
    white-space: nowrap;
  }
  .notice {
    border-radius: 0.75rem;
    background: #f1f0fa;
    padding: 1rem;
  }
  button {
    cursor: pointer;
    border: 1px solid var(--border, #d5d8e0);
    border-radius: 0.4rem;
    padding: 0.5rem 0.7rem;
    font-size: 0.75rem;
    flex-shrink: 0;
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  .confirmation {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .confirmation p {
    flex-basis: 100%;
  }
  .error {
    color: #b42318;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-width: 600px) {
    header {
      flex-direction: column;
    }
    .review-heading {
      align-items: start;
      flex-direction: column;
      gap: 0.3rem;
    }
    article {
      padding: 0.8rem;
    }
  }
</style>
