# FA-10 — Importar extratos com prévia e conciliação

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P2 · **Esforço:** G · **Dependências:** FA-02, FA-03 e FA-05.

- **Status:** Concluída
- **Responsável:** agente FA-10 (GPT-6.1 Sol, high)
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações locais; sem commit por instrução do usuário

## Objetivo e escopo

**Escopo:** importação web CSV e depois OFX, com seleção de conta, mapeamento e prévia. Útil para bancos sem conexão ou histórico que a integração não fornece. Reaproveitar princípios do fluxo de extrato existente, sem assumir que a leitura de PDF por IA já resolve CSV/OFX.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Definir contrato de lote, identidade de importação, conta, prévia e correspondências candidatas.
- [x] Implementar CSV com mapeamento de colunas e formatos brasileiros; depois acrescentar OFX.
- [x] Integrar revisão e confirmação do lote, com conciliação e prevenção de duplicação.
- [x] Implementar reversão dos registros criados pelo lote preservando registros existentes e conciliados.

## Critérios de aceite

- [x] Validar datas, moeda e sinal; apontar motivo por linha inválida.
- [x] Não duplicar registros ao importar novamente o mesmo arquivo.
- [x] Permitir revisar possíveis correspondências com Open Finance.
- [x] Gravar somente após confirmar a prévia do lote.
- [x] Permitir reverter apenas os registros criados pelo lote.

## Validação

- [x] Cobrir separadores brasileiros, arquivo inválido e duplicidade parcial.
- [x] Cobrir arquivo repetido e movimento recebido depois pelo Open Finance.
- [x] Verificar reversão com registros preexistentes e registros conciliados após a importação.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações.
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: separadores brasileiros, arquivo inválido, duplicidade parcial, arquivo repetido e mesmo movimento recebido depois pela sincronização.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [backend/internal/usecase/ledger/process_statement.go](../../backend/internal/usecase/ledger/process_statement.go)
- [backend/internal/usecase/openfinance/sync.go](../../backend/internal/usecase/openfinance/sync.go)
- [web/src/lib/server/finance-data.ts](../../web/src/lib/server/finance-data.ts)
- [docs/regras-de-calculo.md](../../docs/regras-de-calculo.md)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| CSV brasileiro/tab/comma, datas impossíveis, sinais, moeda, UTF-8, CSV inválido e OFX SGML | `go test ./internal/usecase/statementimport -count=1 -v` (`parse_test.go`) | Aprovado 21/10/2026 |
| Sessão, origem, validação, saldo obrigatório explícito/zero, prévia sem confirmar, conflitos 409, modo indisponível | `go test ./internal/infra/http -run TestStatement -count=1 -v` | Aprovado 21/10/2026 |
| Prévia sem ledger; repetição SHA; duplicidade parcial; confirmação transacional; candidatos bancários; reversão idempotente | `TEST_DATABASE_URL=<PostgreSQL descartável> go test ./internal/infra/db -run TestStatementImport -count=1 -v` (5 testes) | Aprovado 21/10/2026 |
| Movimento recebido depois via ReconcileExternal e via SaveExternal após conciliação obsoleta; ID canônico preservado na reversão | `TestStatementImportPersistenceIdempotencePartialAndFutureSync`, `TestStatementImportExternalSaveRechecksStaleReconciliation` | Aprovado 21/10/2026 |
| Conta cruzada recusada, regra exata FA-05 preservada, correspondência nova pede revisão | `TestStatementImportCandidatesAtomicityAndExistingPreserved`, `TestStatementImportChangedCandidatesAndRules` | Aprovado 21/10/2026 |
| Regressão conciliação manual e SaveExternal existente | `go test ./internal/infra/db -run 'TestStatementImport\|TestSaveExternal\|TestReconcile' -count=1 -v` | 8 testes aprovados 21/10/2026 |
| Seleção conservadora e erro de gravação mostrado | `node --experimental-strip-types --test tests/statement-import.test.mjs` | 2 testes aprovados 21/10/2026 |
| Concorrência entre dois lotes sobrepostos | `TestStatementImportConcurrentOverlappingBatches` (2 goroutines, 1 pagamento) | Aprovado 21/10/2026 |
| Verificação estática Go e diff | `go vet ./internal/usecase/statementimport ./internal/infra/db ./internal/infra/http`; `git diff --check` | Aprovado 21/10/2026 |
| Tipos Svelte/TypeScript | `cd web && npm run check` | 0 erros/0 avisos 21/10/2026 |
| Layout/mobile/teclado e integração página final | coordenador executa build/browser sobre o aplicativo integrado | Aprovado pelo coordenador; ver validação integrada, 21/10/2026 |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Chrome com API/DB reais: CSV de duas linhas → prévia → confirmar dois movimentos → recarregar → reverter; conta local com saldo explícito via teclado; OFX → prévia → confirmação e reversão. Prévia móvel sem overflow, sem erros de runtime.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** somente Go/Postgres; prévia persiste staging, não ledger; identidade de arquivo por conta/hash e de linha por conteúdo/ocorrência ou FITID; revisão obrigatória de candidatos; conta local exige saldo atual explícito; reversão preserva canônicos; confirmação e SaveExternal compartilham trava de conta.
- **Pendências / fora do escopo:** Somente extratos de contas bancárias BRL; cartões excluídos. Conta local não se funde automaticamente à futura conta conectada. Revisão precisa ignorar transferências próprias e pagamentos de fatura sem metadados. Saldo informado não é recalculado pelo extrato. Nenhum dado real, envio externo ou deploy foi usado na validação.
