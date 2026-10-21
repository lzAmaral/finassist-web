# FA-09 — Adicionar perguntas sobre os próprios dados na web

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P2 · **Esforço:** G · **Dependências:** FA-02 e FA-03; pode aproveitar FA-04/FA-07 depois.

- **Status:** Concluída
- **Responsável:** agente FA-09 (GPT-6.1 Sol high), integração e QA final pelo coordenador
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações locais, sem commit solicitado

## Objetivo e escopo

**Escopo:** começar com perguntas sugeridas e consultas somente de leitura: total de uma categoria, diferença para o mês anterior e compromissos conhecidos. Evoluir para linguagem livre após validar esse fluxo. Cálculos ficam no servidor; modelo de linguagem, se usado, interpreta a intenção e explica resultados estruturados.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Definir perguntas prontas e consultas determinísticas para categorias, comparações e compromissos disponíveis.
- [x] Integrar respostas com período, origem, atualização e links para os movimentos.
- [x] Garantir consultas prontas sem IA; adicionar linguagem livre apenas depois de validar o fluxo básico.
- [x] Se necessário, documentar o contrato do modelo para interpretação de intenção, limites e tratamento de instruções nos dados externos.

## Critérios de aceite

- [x] Mostrar período, origem e links para movimentos utilizados.
- [x] Identificar dados insuficientes ou desatualizados.
- [x] Manter totais iguais aos relatórios para os mesmos filtros.
- [x] Manter consultas prontas operantes sem IA.
- [x] Documentar explicitamente qualquer ampliação do payload enviado ao Gemini e atualizar a informação ao proprietário.
- [x] Manter escritas por conversa e comprovantes fora desta entrega.

## Validação

- [x] Cobrir pergunta ambígua, categoria inexistente e período sem dados.
- [x] Cobrir instrução maliciosa em descrição de extrato e limite/indisponibilidade da IA.
- [x] Comparar resposta com os relatórios usando o mesmo conjunto sintético.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações.
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: pergunta ambígua, categoria inexistente, período sem dados, tentativa de instrução em descrição de extrato e limite de uso da IA. Escritas por conversa e comprovantes ficam fora desta primeira entrega.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [backend/internal/chat/handler.go](../../backend/internal/chat/handler.go)
- [backend/internal/usecase/ledger/process_query.go](../../backend/internal/usecase/ledger/process_query.go)
- [web/src/lib/server/gemini-analysis.ts](../../web/src/lib/server/gemini-analysis.ts)
- [web/src/lib/components/SpendingAnalysis.svelte](../../web/src/lib/components/SpendingAnalysis.svelte)
- [docs/uso-do-chat.md](../../docs/uso-do-chat.md)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| Contrato somente leitura, categoria inválida, intenção ausente/ambígua, sessão, 405 em escrita, capacidade de agenda ausente | `questions_api_test.go`: `TestAPI_QuestionsValidationAndSession` | Aprovado em 21/10/2026 |
| Zero observado, base anterior zero, mês sem dados, categoria sem movimento, evidência literal maliciosa, links internos, erro sem segredo | `TestAPI_QuestionsZeroMissingHistoryAndLiteralExternalText` | Aprovado em 21/10/2026 |
| Atualização desconhecida/desatualizada, agenda sem advisor/chave/cota Gemini | `TestAPI_QuestionsFreshnessAndAgendaWithoutAI` | Aprovado em 21/10/2026 |
| Igualdade com relatórios reais: centavos, cancelados, receitas, transferências, correção FA05 e precedência da data do pagamento | `TEST_DATABASE_URL=<PostgreSQL descartável> go test ./internal/infra/http -run 'Test.*Questions' -count=1 -v` | 4 testes aprovados; categoria Alimentação R$20, Saúde R$20, diferença R$36,67 em fixture sintética |
| Consulta no cliente sem IA, argumentos e erros 401/429/500/501/503/JSON inválido | `web/tests/questions.test.mjs`; `npm test` | 64/64 testes web aprovados em 21/10/2026 |
| Tipagem e acessibilidade estática | `cd web && npm run check` | 0 erros e 0 avisos em 21/10/2026 |
| Regressão HTTP, análise estática e revisão do diff | `cd backend && go test ./internal/infra/http -count=1`; `go vet ./internal/infra/http`; `gofmt -l internal/infra/http/questions*.go`; `git diff --check` | Aprovados; integração PostgreSQL dedicada executada separadamente, sem suíte legada concorrente |
| Integração da rota, build, browser/mobile/teclado | Coordenador integra `/perguntas` e executa QA final | Aprovado pelo coordenador; ver validação integrada, 21/10/2026 |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Chrome com API/DB reais: total Alimentação R$ 1.554,84 com mais de 100 movimentos, agenda mostra compromisso conhecido e comparação sem mês anterior informa histórico insuficiente. API/DB comparam as mesmas bases dos relatórios; nenhuma IA usada.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** reaproveitar `MonthlyTotals`, `ExpenseBreakdown` e `Transactions` para as mesmas regras dos relatórios. Categorias usam `effective_payment_category` da FA05. Agenda reutiliza `agenda.Build` da FA04; não exige ampliar `DashboardReader` nem migration. FA02 fornece o proxy autenticado; FA03 fornece a navegação/exportação completa dos movimentos.
- **Pendências / fora do escopo:** Perguntas livres, escrita por conversa e comprovantes ficam fora. Schema Go preexistente não armazena estorno negativo em payments; consultas mantêm semântica dos relatórios existentes. Nenhum dado real, envio externo ou deploy foi usado na validação.

## Contrato implementado

- `GET /api/questions/options`: categorias e rótulos oficiais do Go, protegidos por sessão.
- `GET /api/questions?kind=category_total&month=AAAA-MM&category=FOOD`: despesas da categoria; `month_comparison` compara o total das despesas com o mês anterior; `commitments` usa hoje em São Paulo, pendências vencidas/sem data e próximos 30 dias. A UI explica que o seletor mensal não recorta compromissos.
- Resposta inclui `source: go-postgres`, `generatedAt`, `sourceUpdatedAt`, `freshness`, `status`, períodos com total/contagem/link e até 20 evidências por período. Totais usam todos os registros, independentemente do limite visual. Links usam rótulo de categoria e `flow=EXPENSE`, compatíveis com `/transacoes`.
- `difference`/`percent` ficam nulos quando falta histórico; base anterior zero/negativa não produz percentual. Zero observado e ausência de registros são estados diferentes. Datas seguem os mesmos filtros dos relatórios, inclusive precedência de vencimento sobre mês de referência.
- A atualização bancária exibida é a mais antiga conhecida entre instituições; ausente ou parcial fica `unknown`, fonte antiga há mais de 48h ou futura fica `stale`. A data da consulta não é apresentada como sincronização. A UI informa que a atualização bancária não certifica os registros manuais nem cobertura completa.
- Compromissos preservam fontes e estimativas da agenda. Links dos pagamentos usam o mês efetivo do pagamento; recorrências estimadas remetem à agenda, sem inventar movimento ou fatura quitada.
- Sem IA: nenhum payload, descrição ou indicador adicional é enviado ao Gemini; logo não há ampliação de payload nem contrato de interpretação de linguagem livre nesta entrega. Sem chave, IA indisponível ou cota esgotada, as perguntas continuam sendo leituras locais. Dados externos são texto literal, renderizado com escape padrão do Svelte; URLs e instruções na descrição não viram ações.
- Erros 400 (intenção/categoria/período), 401 (sessão), 429 (limite geral), 500 (leitura) e 501 (agenda ausente) são explícitos e recuperáveis; respostas financeiras usam `no-store`. Modo cloud apresenta indisponibilidade sem consultar nem preencher com zero fictício.
