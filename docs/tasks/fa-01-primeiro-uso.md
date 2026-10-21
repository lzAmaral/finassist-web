# FA-01 — Guiar o primeiro uso e distinguir capacidades por modo

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P0 · **Esforço:** M · **Dependências:** nenhuma.

- **Status:** Concluída
- **Responsável:** agente FA-01; validação integrada pelo coordenador
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações no workspace compartilhado, sem commit

## Objetivo e escopo

**Problema:** uma lista vazia pode significar ausência de dados, configuração incompleta ou recurso indisponível; hoje essas situações se confundem.

**Escopo:** apresentar estados explícitos de configuração, primeira sincronização, falha e dados disponíveis. Conduzir o usuário de “conectar contas” para “ver primeiro resumo” e “revisar um gasto”. Informar no produto quais ações estão disponíveis, com texto de uso cotidiano.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Mapear estados e capacidades reais dos modos Go, cloud e não configurado.
- [x] Adaptar o carregamento para distinguir ausência de snapshot de falha de leitura e indisponibilidade de recurso.
- [x] Implementar uma ação principal por estado, incluindo primeira sincronização e retentativa autenticadas.
- [x] Revisar mensagens de orçamento e metas, navegação por teclado e apresentação móvel (verificados pelo coordenador no ambiente sintético).

## Critérios de aceite

- [x] A ausência de orçamento/metas no cloud não é apresentada como ausência de despesas/metas pessoais nem promete solução apenas com sincronização.
- [x] Sem snapshot, a página permite iniciar/repetir a primeira sincronização após autenticação, em vez de encerrar em erro genérico.
- [x] Uma ação principal por etapa; progresso corresponde a etapas realmente concluídas; sem valores fictícios.
- [x] Estados de carregamento, erro e configuração podem ser usados em celular e por teclado.

## Validação

- [x] Exercitar configuração ausente, primeiro snapshot pendente, sincronização com erro e dados existentes (loader, POST e retentativa verificados no navegador com fonte sintética).
- [x] Verificar que recursos indisponíveis não exibem conclusões financeiras falsas.
- [x] Verificar teclado e viewport móvel; registrar o caminho até o primeiro resumo útil.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações (test/check/build integrados aprovados).
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: cenários sem configuração, configurado sem snapshot, falha de sincronização e snapshot existente; medir tempo do login até o primeiro resumo útil.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [web/src/routes/[[section]]/+page.server.ts](../../web/src/routes/[[section]]/+page.server.ts)
- [web/src/routes/[[section]]/+page.svelte](../../web/src/routes/[[section]]/+page.svelte)
- [web/src/lib/server/cloud-api.ts](../../web/src/lib/server/cloud-api.ts)
- [web/src/lib/server/empty.ts](../../web/src/lib/server/empty.ts)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| Estados sem configuração, snapshot pendente e falha de leitura/rede | `web/tests/dashboard-page.test.mjs`; loader extraído para `web/src/lib/server/dashboard-page.ts` | Passou em 21/10/2026 |
| Autenticação, setup e recursos opcionais | Testes preservam redirects 401/409, erro de carteira sem apagar resumo e companion Go condicionado a armazenamento | Passou em 21/10/2026 |
| Capacidade por modo e ausência distinta de zero | `web/src/lib/dashboard-state.ts`; testes de cloud/Go; UI não renderiza métricas sem estado `ready` | Passou em 21/10/2026; revisão estática |
| Primeira sincronização com contrato inequívoco | Cloud retorna `503` com `code: snapshot_pending` (alinhado e implementado por FA-02); apenas essa combinação abre `first-sync` | Testado no loader e POST no navegador com fonte sintética; nenhum Pluggy real |
| Testes web existentes + novos | `cd web && npm test`: 40 testes, 40 passaram, 0 falhas | Passou em 21/10/2026 |
| Tipagem e acessibilidade estática | `cd web && npm run check`: 0 erros, 0 avisos | Passou em 21/10/2026 |
| Mobile/teclado, erro de sync e tempo até primeiro resumo | Chrome em cópia sem `.env`, com dados sintéticos | Aprovado pelo coordenador; ver validação integrada, 21/10/2026 |
| Build | `npm run build` integrado, adapter Vercel concluído | Aprovado pelo coordenador; ver validação integrada, 21/10/2026 |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Chrome: configuração ausente em 1440/768/390/320 px; snapshot pendente → ação por teclado → erro 502 → retry → resumo; 401 redireciona login. Fonte cloud sintética, sem Pluggy real. README alinhado ao primeiro acesso autenticado.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** FA-02 definiu Go como autoridade de orçamento/metas; cloud não anuncia esses recursos. `Dashboard.mode` continua distinguindo dados ausentes de live para consumidores existentes; estado operacional separado `app.status` usa `unconfigured`, `first-sync`, `error`, `ready`. Login/setup preservam redirecionamentos. Falha opcional de carteira/IA não apaga resumo. A UI de sync só é exposta no cloud, onde configuração é comprovada; Go possui integração opcional não atestada por `/api/me`, explicitada nas conexões. FA-03 forneceu `loadAllTransactions`, integrado ao loader sem resultados parciais. Progresso não afirma revisão concluída: apenas conexão verificada e resumo disponível; revisar é ação disponível.
- **Pendências / fora do escopo:** Latência de Pluggy e tempo de ativação de usuários reais não foram medidos. O caminho sintético confirma estados e interação, não SLA. Nenhum dado real, envio externo ou deploy foi usado na validação.
