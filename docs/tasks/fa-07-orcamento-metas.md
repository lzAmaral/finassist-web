# FA-07 — Tornar orçamento e metas utilizáveis no Svelte

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P1 · **Esforço:** G · **Dependências:** FA-02; FA-05 e FA-04 alimentam classificações e compromissos quando disponíveis.

- **Status:** Concluída
- **Responsável:** agente FA-07 (GPT-6.1 Sol, high), coordenação pelo agente principal
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações locais; sem commit conforme autorização

## Objetivo e escopo

**Escopo:** duas entregas: (A) criação/exclusão de metas com os tipos existentes no Go — juntar, reduzir e reserva; (B) orçamento com fixas, variáveis e parcelas, correção de classe e estimativa de sobra com premissas explícitas. Limites por categoria são uma extensão a modelar, não uma capacidade já confirmada do orçamento atual.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Entrega A — integrar criação/exclusão de metas SAVE, CUT e RESERVE e os campos completos de progresso.
- [x] Entrega A — construir formulários e estados de validação sem depender do painel original.
- [x] Entrega B — integrar fixas, variáveis, parcelas e correção de classe.
- [x] Entrega B — apresentar projeção de sobra e premissas, incluindo histórico insuficiente e eventual sobreposição patrimonial entre metas.

## Critérios de aceite

- [x] Criar, excluir e acompanhar metas no Svelte.
- [x] Apresentar prazo, progresso e necessidade mensal quando aplicáveis.
- [x] Sinalizar histórico insuficiente e separar saldo atual de sobra projetada.
- [x] Explicar que metas podem compartilhar a mesma base patrimonial, sem representar reservas separadas.
- [x] Tratar limites por categoria como extensão fora desta entrega, salvo revisão explícita de escopo.

## Validação

- [x] Cobrir renda irregular, mês sem receita, histórico incompleto, meta vencida e duas metas simultâneas.
- [x] Conferir resultados contra os cálculos existentes do Go.
- [x] Validar erros de formulário, exclusão e recarga sem perda de estado persistido.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações.
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: renda irregular, mês sem receita, histórico incompleto, meta vencida e duas metas simultâneas. Evitar apresentar estimativa como valor garantidamente disponível para gastar.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [backend/internal/infra/http/goals_api.go](../../backend/internal/infra/http/goals_api.go)
- [backend/internal/infra/http/budget_api.go](../../backend/internal/infra/http/budget_api.go)
- [backend/internal/usecase/planning/goals.go](../../backend/internal/usecase/planning/goals.go)
- [backend/internal/usecase/planning/budget.go](../../backend/internal/usecase/planning/budget.go)
- [web/src/routes/[[section]]/+page.svelte](../../web/src/routes/[[section]]/+page.svelte)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| Componentes Svelte próprios e contratos oficiais | `GoalsManager.svelte`, `BudgetPlanner.svelte`, `planning.ts`; Go existente `GET/POST/DELETE /api/goals`, `GET /api/budget`, `GET /api/projection?months=6`, `PUT /api/expense-rules` | Implementado em 21/10/2026; sem duplicar cálculos Go |
| Formulários, centavos, limites, prazo vencido, renda zero e histórico ausente | `cd web && node --experimental-strip-types --test tests/planning.test.mjs` | 4 testes aprovados; inclui cliente HTTP sintético com criar/recargar/excluir e falha de validação/persistência |
| Renda irregular, mês sem receita, histórico parcial, meta vencida e duas metas | `cd backend && /tmp/finassist-go-toolchain/go/bin/go test ./internal/usecase/planning` | Aprovado; testes existentes de mediana/atípicos/prazo e novos `web_planning_test.go` para patrimônio compartilhado e zero versus ausência |
| Contratos Go de criar/excluir/classificar/projetar | `go test ./internal/infra/http -run 'TestAPI_(Budget\|SetExpenseRule\|Projection\|Goals\|CreateGoal\|DeleteGoal)$' -count=1` com toolchain nativo | Aprovado; valida SAVE/CUT/RESERVE e respostas de erro |
| Tipagem Svelte e análise Go | `cd web && npm run check`; `cd backend && /tmp/finassist-go-toolchain/go/bin/go vet ./internal/usecase/planning` | Zero erros/warnings; vet aprovado |
| Formatação e revisão de escopo | Prettier nos quatro arquivos web; gofmt no teste Go; `git diff --check` | Aprovado; sem alteração de rotas centrais ou índice pelo agente FA07 |
| Build e navegação final desktop/mobile/teclado | Coordenação pelo agente principal, após integrar os componentes em `/metas` e `/orcamento` | Aprovado pelo coordenador; ver validação integrada, 21/10/2026 |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Chrome com API/DB reais: criar meta SAVE, recarregar e excluir; alterar despesa para fixa, recarregar e voltar ao automático. Histórico insuficiente e premissas visíveis. Casos CUT/RESERVE e projeções cobertos pelas suites.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** componentes fazem fetch client autenticado pelos endpoints oficiais e releem após escrita; falhas de projeção não apagam metas/orçamento. Props: `GoalsManager {enabled, hidden?}`; `BudgetPlanner {enabled, month, currentBalance?, hidden?}`; `enabled` exige modo Go e status ready. Projeção sempre começa no mês atual, independentemente do mês de consulta do orçamento. Valor necessário e mediana vêm do Go; no cliente há apenas apresentação da diferença renda − despesas do contrato projetado. Metas de reserva sem base não exibem objetivo zero como conclusão; CUT não trata mês aberto como sucesso definitivo. Esconder valores mascara dinheiro e campo de valor da meta.
- **Pendências / fora do escopo:** Limites por categoria fora desta entrega. Metas compartilham patrimônio e não reservam dinheiro. Planejamento requer Go. Nenhum dado real, envio externo ou deploy foi usado na validação.
