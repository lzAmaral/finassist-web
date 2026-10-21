# FA-02 — Definir e integrar a persistência das operações financeiras

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P0 · **Esforço:** G · **Dependências:** nenhuma; antecede escritas das tarefas seguintes.

- **Status:** Concluída
- **Responsável:** agente FA-02 (GPT-6.1 Sol high), integração final pelo coordenador
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações locais, sem commit conforme instrução

## Objetivo e escopo

**Problema:** snapshot cloud e instalação Go são bases separadas. Apenas acrescentar formulários não torna metas, regras e lançamentos compartilhados.

**Escopo:** registrar uma decisão de arquitetura com um caminho principal. Recomendação inicial: reaproveitar Go e PostgreSQL para operações de planejamento, classificação e chat, com backend acessível remotamente e adaptadores no Svelte. Comparar com manter a execução cloud independente antes de confirmar a opção, incluindo custo e operação. Não iniciar duas implementações concorrentes das mesmas regras.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Etapa A — comparar Go remoto/PostgreSQL e execução cloud independente, incluindo dados existentes, operação e custo; registrar a decisão em docs/decisoes/.
- [x] Etapa A — definir contratos de leitura/escrita e a fonte oficial de transações, metas, regras, carteira, proventos e configuração de IA.
- [x] Etapa B — implementar a integração mínima em desenvolvimento: criar meta pelo Svelte, persistir e reler pela API.
- [x] Etapa B — preservar autenticação, conciliação e funcionalidades já presentes nos adaptadores afetados.
- [x] Etapa C — preparar e ensaiar migração e reversão com dados sintéticos, incluindo concorrência e reexecução; registrar o procedimento operacional sem executar migração em produção como parte deste planejamento.

## Critérios de aceite

- [x] Decisão identifica a fonte oficial de cada dado, o responsável pela sincronização, autenticação, agendamento, backup e migração.
- [x] Prova de integração em desenvolvimento: criar uma meta pelo Svelte, persistir, recarregar e obter o mesmo resultado pela API.
- [x] Estratégia cobre a carteira manual, proventos e configuração de IA já existentes no Blob; trocar para `FINASSIST_API_URL` não pode fazer essas funções desaparecerem sem tratamento explícito.
- [x] Importação repetida não duplica movimentos; lançamento manual e importado preservam as regras de conciliação existentes.
- [x] Existe plano de migração e reversão validado com dados sintéticos antes de tocar no armazenamento real.

## Validação

- [x] Validar contrato do adaptador, persistência após recarga e comportamento diante de falha de escrita.
- [x] Validar escrita concorrente e reexecução sem duplicação.
- [x] Ensaiar migração e reversão de carteira/proventos/configuração e registrar contagens e resultados sintéticos.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações.
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: teste de contrato entre adaptador e fonte escolhida, concorrência de escrita e exercício de migração/reversão. Entrega inicial pode ser apenas decisão e prova técnica; a migração é etapa separada dessa tarefa.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [docs/plano-web.md](../../docs/plano-web.md)
- [web/src/lib/server/backend.ts](../../web/src/lib/server/backend.ts)
- [web/src/lib/server/cloud-store.ts](../../web/src/lib/server/cloud-store.ts)
- [web/src/lib/server/portfolio-store.ts](../../web/src/lib/server/portfolio-store.ts)
- [backend/internal/infra/http/goals_api.go](../../backend/internal/infra/http/goals_api.go)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| Arquitetura, fonte oficial, operação/custo, autenticação e reversão | [ADR 0009](../decisoes/0009-persistencia-web-go.md), índice de decisões atualizado | Concluído, 21/10/2026 |
| Prova adaptador Svelte → Go real → PostgreSQL | `TEST_DATABASE_URL=<banco sintético> go test ./internal/infra/http -run TestWebGoalsPostgresRoundTrip -count=1 -v`; fixture `web/tests/fixtures/go-goals-bridge.mjs` | PASS inicial e reexecução final (0,22s, com migration 020 da FA05); meta criada/recarregada, idêntica via Go e conexão PostgreSQL reaberta; sessão/CSRF/validação, 21/10/2026 |
| Preservação carteira/proventos/IA com backend ativo | `companion-api.ts`, proxy `/api/[...path]`, `privateStorageConfigured`; loader FA01; texto de fonte cloud e data junto à carteira pela integração do coordenador | Código integrado; companions autenticados pelo Go; QA visual final pelo coordenador |
| Concorrência e persistência cifrada | `node --experimental-strip-types --test tests/private-persistence.test.mjs` | 3 PASS: carteira/provento/recarga, uma escrita aceita e outra recusada por ETag, snapshot atualizável, chave IA preservada e cache separado por fonte |
| Migração/reexecução/reversão | `node --experimental-strip-types --test tests/companion.test.mjs` | 5 PASS; inventário 2 posições/1 provento/1 IA; 2 documentos criados, 2 unchanged na reexecução, hashes iguais, origem preservada, conflitos recusados |
| Conciliação e identidade de movimentos existentes | Banco descartável separado `finassist_fa02_validation`, migrations aplicadas; `go test ./internal/infra/db -run 'Test(ReconcileExternal|SaveExternal|UpsertAccount|Goals_CreateListDelete)' -count=1 -v` | 5 PASS; manuais single/recurring conciliados, índice externo recusa duplicação sem compra órfã, conta atualizada no mesmo ID; banco dedicado removido após validação |
| Regressão web e tipos | `cd web && npm test && npm run check` | 41/41 PASS na execução inicial; check 0 erros/0 warnings. Mais 2 testes store adicionados e executados com sucesso depois (3/3 store no total); suíte integrada final pelo coordenador |
| Diff e formatação | `git diff --check`; prettier nos módulos/rota alterados; gofmt no teste novo | Sem erros; sem build concorrente com coordenador |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Proxy Svelte → Go → PostgreSQL real: criar meta, recarregar e excluir na UI. Teste adicional relê por conexão nova. Companions e migração/reversão/ETag cobertos pelas suites; fonte e data da carteira cloud explicitadas na página.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** Go/PostgreSQL é a única autoridade de operações; cloud independente mantém consulta, sem duplicar domínio. Carteira/proventos/configuração continuam nos mesmos documentos Blob, com sessão Go validada antes de acessá-los. Sem Blob/chave, a capacidade auxiliar retorna 503 explícito. `Origin` público é conferido antes de adaptação para a origem Go; Node pode ignorar Host sobrescrito. Atualizações Blob usam `allowOverwrite:true` apenas junto a ETag. Cache de análise é separado por fonte para não exibir conteúdo cloud antigo como Go.
- **Pendências / fora do escopo:** Blob testado com transporte em memória e criptografia/stores reais. Migração operacional real depende do procedimento da ADR; não se mescla snapshot cloud automaticamente ao ledger Go. Nenhum dado real, envio externo ou deploy foi usado na validação.
