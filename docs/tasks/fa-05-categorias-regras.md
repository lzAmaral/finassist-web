# FA-05 — Corrigir categorias e reaplicar regras pela web

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P1 · **Esforço:** M · **Dependências:** FA-02; FA-03 para cobertura completa no modo Go.

- **Status:** Concluída
- **Responsável:** agente FA-05 (coordenação root)
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações locais; sem commit por instrução da execução

## Objetivo e escopo

**Escopo:** fila de movimentos sem classificação útil e edição contextual na lista. Reaproveitar a API Go e tornar explícito o alcance: somente este lançamento ou regra para próximos semelhantes.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Inspecionar a API e distinguir correção individual, regra futura e eventual reaplicação histórica.
- [x] Integrar persistência da correção e precedência sobre a classificação importada.
- [x] Criar fila de revisão e edição contextual, com prévia do alcance de cada regra.
- [x] Implementar remoção de regra e explicar seu efeito sobre correções já aplicadas.

## Critérios de aceite

- [x] Persistir a correção após nova sincronização.
- [x] Mostrar prévia dos movimentos afetados antes de criar uma regra.
- [x] Permitir remover a regra com efeito explicado.
- [x] Manter valor, situação e identidade bancária do lançamento ao alterar categoria.

## Validação

- [x] Cobrir descrições semelhantes de estabelecimentos distintos e Pix genérico.
- [x] Cobrir sincronização repetida, remoção de regra e regras que não devem atingir outros lançamentos.
- [x] Registrar como medir correções repetidas sem incluir conteúdo financeiro em telemetria.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações.
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: dois estabelecimentos com descrições parecidas, Pix genérico, regra removida e sincronização repetida. Medir redução de movimentos que exigem correção manual.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [backend/internal/infra/http/categorize_api.go](../../backend/internal/infra/http/categorize_api.go)
- [backend/internal/usecase/coach/categorize.go](../../backend/internal/usecase/coach/categorize.go)
- [web/src/lib/components/TransactionActivity.svelte](../../web/src/lib/components/TransactionActivity.svelte)
- [web/src/lib/server/finance-data.ts](../../web/src/lib/server/finance-data.ts)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| Dependências e modos | ADR 0009; operações no PostgreSQL/Go; componente mostra indisponibilidade em cloud. FA-03 fornece identidade de pagamento e filtros completos. | Verificado no código, 21/10/2026 |
| Persistência e isolamento individual | `TestCategoryReview_IndividualSurvivesSyncAndIsolatesSibling`: dois pagamentos da mesma compra, correção HEALTH/OTHER, duas sincronizações, campos financeiros e identidade preservados; filtro e detalhes do chat leem categoria efetiva. | PASS, 21/10/2026 |
| Prévia e alcance | `TestCategoryReview_ExactPreviewFutureReapplyRemoval`: descrição completa mantém Loja 101/102 separadas; prévia obrigatória e hash obsoleto recusados; correções manuais excluídas; regra só futura não muda histórico. | PASS, 21/10/2026 |
| Remoção e sincronização | Mesmo teste: remoção mantém classificação aplicada, novos movimentos seguem categoria importada; `TestCategoryRules_RetroactiveFutureAndListing` preserva comportamento legado. | PASS, 21/10/2026 |
| Novos lançamentos manuais/recorrências | Mesmo teste cobre `LedgerRepo.Save` e `SavePayment`, além de `SaveExternal`, usando o mesmo aplicador transacional de regras exatas. | PASS, 21/10/2026 |
| Pix genérico/estabelecimentos distintos | `TestCategoryReview_ProtectsGenericPixAndSimilarDebitNames`: Pix exige correção individual; descrições de débito que compartilham primeiro nome não se fundem. | PASS, 21/10/2026 |
| Sessão, origem, contratos e erros | `category_review_api_test.go`: 401 sem sessão, 403 origem diferente, 400 categoria inválida, 409 prévia alterada, 503 contrato apenas de leitura; encaminhamento do alcance e remoção. | PASS, 21/10/2026 |
| Consultas compartilhadas | `TEST_DATABASE_URL=<PostgreSQL sintético> /tmp/finassist-go-toolchain/go/bin/go test ./internal/infra/db -count=1` após migration 020; suíte completa, sem produção. | PASS, 21/10/2026 |
| Backend focal e vet | `go test ./internal/infra/http ./internal/infra/db ./internal/domain/...`; `go vet ./internal/infra/db ./internal/infra/http ./internal/domain/...`; gofmt nos arquivos alterados. | PASS, 21/10/2026 |
| Backend global | `go test ./...`: pacotes alterados passam; verificação arquitetural inicialmente apontou registro ausente do novo contexto agenda (FA-04), comunicado ao responsável. | Root/FA-04 revalidar após integração |
| Interface e helpers | `npm run check`: zero erros/avisos; `node --experimental-strip-types --test tests/category-review.test.mjs`: quatro testes passam (prévia inválida após edição, alcance/hash, erro recuperável). | PASS, 21/10/2026 |
| Integração visual | Componentes `CategoryReview.svelte` e `CategoryEditor.svelte` prontos, incluindo ocultação de valores, estados de erro, paginação, confirmação de remoção e controles nativos de teclado. Root integra navegação e edição contextual e executa build/browser mobile/teclado. | Aprovado pelo coordenador; ver validação integrada, 21/10/2026 |
| Lint | `golangci-lint` não encontrado no PATH deste agente; `go vet` focal passou. | Root verificar ferramenta/lint final |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Chrome com API/DB reais: categoria individual Outros → Saúde, tabela filtrada e recarga confirmam persistência; restauração para Outros. Prévia/regras/conflitos/sincronização cobertos adicionalmente pelos testes HTTP/DB.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** correção é por `payments.id`, pois parcelas e recorrências compartilham compra. A categoria efetiva prioriza `payment_category_overrides` sobre a categoria importada; valores, situação e identidade bancária não são reescritos. `OTHER` explícito é preservado e sai da fila. Consultas de transações, filtros, grupos, orçamento, revisão e resumo/chat usam a mesma função SQL `effective_payment_category`.
- **Regras novas:** chave `exact:` + descrição inteira em minúsculas e espaços compactados; conserva números e pontuação para evitar agrupar estabelecimentos distintos. Regras legadas continuam com a normalização original, sem migração destrutiva, e são identificadas na interface. Regras exatas têm precedência nas novas entradas. Pix/TED/DOC/transferências exigem correção individual; não há regra automática nova para destinatários ambíguos.
- **Alcance e concorrência:** individual, só próximos ou próximos + históricos são escolhas explícitas. Prévia retorna todos os pagamentos elegíveis e hash do estado, categoria desejada e regra anterior; reaplicação exclui overrides manuais. Escritas usam transações, bloqueios por chave e por pagamentos; estado alterado exige nova prévia (409). Remover regra só interrompe aplicações futuras, mantendo correções já aplicadas.
- **Contratos Go:** `GET /api/categorize/review?offset=0` retorna `{items,total,offset,limit,rules,categories}` (fila de todos os meses, páginas de 60). `GET /api/categorize/transactions/{id}` retorna metadados e chave calculada no Go; `PUT` com `{category}` salva override individual. `POST /api/categorize/preview` com `{key,category}` retorna `{key,category,hash,count,items}`. `PUT /api/categorize/rules` com chave `exact:` exige `{key,category,applyExisting,previewHash}`; chave legada mantém contrato anterior. `DELETE /api/categorize/rules?key=...` remove com efeito explicado. Todas exigem sessão; escritas passam pelos guards existentes de origem/JSON. Interface estreita `CategoryReviewStore` evita ampliar mocks/contratos de leitura.
- **Migration:** `020_payment_category_overrides.sql`, idempotente e aplicada somente no PostgreSQL sintético. Aplicar antes do backend novo em bancos existentes; root adicionará comando no README/CHANGELOG junto das demais migrations da entrega.
- **Medição sem conteúdo financeiro:** comparar semanalmente contagem agregada de correções individuais repetidas e aplicações de regra, com linha de base antes de metas. Se instrumentado, registrar só semana, tipo de ação/alcance e contagem; excluir IDs de pagamentos, chaves, descrições, destinatários, datas específicas e valores. Esta entrega não adiciona telemetria nem afirma redução medida.
- **Pendências / fora do escopo:** Regras novas usam descrição completa; Pix/transferência genérica exige correção individual. Remover regra não desfaz correções históricas já aplicadas. Nenhum dado real, envio externo ou deploy foi usado na validação.
