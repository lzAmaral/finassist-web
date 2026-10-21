# FA-03 — Completar busca e exportação no modo Go

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P0 · **Esforço:** M · **Dependências:** nenhuma.

- **Status:** Concluída
- **Responsável:** agente FA-03 (coordenação: agente raiz)
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações locais, sem commit conforme instrução de execução

## Objetivo e escopo

**Escopo:** paginação real ou consulta filtrada no servidor, mantendo contagem total correta. A exportação precisa abranger todo o resultado filtrado, mesmo quando a tela renderiza uma página.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Inspecionar filtros e paginação suportados pela API e definir a estratégia para consulta e exportação completas.
- [x] Implementar carregamento paginado ou consulta filtrada no servidor, com ordem estável e contagem total correta.
- [x] Exportar todos os resultados filtrados, independentemente da página visível.
- [x] Preservar mês/filtros na navegação e o comportamento completo do modo cloud.

## Critérios de aceite

- [x] Encontrar uma transação além da primeira página em um mês com mais de 100 movimentos.
- [x] Exportar o conjunto filtrado completo, sem duplicação ou truncamento silencioso.
- [x] Preservar filtros e mês ao navegar entre páginas.
- [x] Manter o comportamento de consulta/exportação do cloud.

## Validação

- [x] Usar conjunto sintético com mais de 100 transações e verificar IDs e totais esperados.
- [x] Combinar busca, categoria, conta e direção; testar resultado vazio e erro ao buscar página adicional.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações.
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: conjunto sintético com mais de 100 transações, filtros combinados e mudança de página. No cloud, preservar a paginação de origem já implementada.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [web/src/routes/[[section]]/+page.server.ts](../../web/src/routes/[[section]]/+page.server.ts)
- [web/src/lib/components/TransactionActivity.svelte](../../web/src/lib/components/TransactionActivity.svelte)
- [web/src/lib/transactions.ts](../../web/src/lib/transactions.ts)
- [backend/internal/infra/http/transactions_api.go](../../backend/internal/infra/http/transactions_api.go)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| Leitura completa Go e busca além de 100 | `web/tests/transaction-pages.test.mjs`: 237 registros, 3 páginas, IDs únicos, soma 28025,25; combinação busca/categoria/conta/direção encontra `transaction-236` | Passou, 21/10/2026 |
| CSV completo e ordem estável | Mesmo teste: 158 despesas filtradas, 50 linhas na página 2, CSV contém exatamente os 158 IDs; entrada embaralhada mantém data desc./ID asc. | Passou, 21/10/2026 |
| Navegação e resultado vazio | Mesmo teste: URLs retêm mês e todos os filtros, alteração de filtro remove página; página excessiva/inválida e resultado vazio são tratados | Passou, 21/10/2026 |
| Falhas sem conjunto parcial | Mesmo teste: página adicional com falha, duplicação, total alterado, envelope incorreto ou página curta rejeita a carga inteira | Passou, 21/10/2026 |
| Cloud preservado | Mesmo teste: snapshot sintético com 237 movimentos gera 237 linhas completas; contas homônimas permanecem distintas por ID; CSV contém todas | Passou, 21/10/2026 |
| Regressões de transações | `cd web && node --experimental-strip-types --test tests/transaction-pages.test.mjs tests/transactions.test.mjs` — 10/10 | Passou, 21/10/2026 |
| Verificações Web | `cd web && npm run check` — 0 erros/avisos; `cd web && npm test` — 26/26 | Passou, 21/10/2026 |
| Ordem na origem Go | Revisão de `backend/internal/infra/db/transactions_queries.go`: `ORDER BY date DESC, pay.created_at DESC, pay.id`; API retorna `items,total,page,limit` | Confirmado, sem alteração backend |
| Build e uso no navegador | Coordenador executará build global e verificará mobile, teclado, carregamento e recuperação de erro com fixture sintética | Aprovado pelo coordenador; ver validação integrada, 21/10/2026 |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Chrome: 237 movimentos, 50 por página, busca encontra item 237, CSV com todas as 158 saídas, filtros conta/direção e URL preservados após recarga. Corrigida reação à navegação superficial do SvelteKit 3.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** Go continua autoridade das transações. Como a API já pagina até 100 por requisição e ordena com desempate por ID, o servidor Svelte lê todas as páginas do mês sequencialmente e somente publica a lista completa. Total inconsistente, IDs duplicados, página incompleta e falhas rejeitam a carga inteira, preservando a recuperação definida em FA-01. Limite máximo segue o contrato Go (10.000 páginas); exceder falha explicitamente. Filtros são locais após carga completa, com a mesma regra de exclusão de transferências já existente; visualização limita a 50 resultados, CSV usa todos os resultados filtrados. Mês/filtros/página ficam na URL via navegação rasa, sem requisição adicional ao alterar filtro. Cloud mantém sua coleta completa; apenas expõe `accountId` para distinguir contas homônimas.
- **Contrato:** helper `loadAllTransactions(get, month)` espera envelope Go `{ items, total, page, limit: 100 }` e devolve `{ items, total }` somente ao completar. `Transaction.accountId` é opcional para compatibilidade; fallback de conta usa nome ou manual. CSV mantém as colunas anteriores e acrescenta Conta/ID, protege fórmulas preservando o texto original e inclui BOM UTF-8.
- **Pendências / fora do escopo:** A carga usa todas as páginas do mês e recusa conjunto inconsistente. Não há benchmark de milhões de movimentos. Nenhum dado real, envio externo ou deploy foi usado na validação.
