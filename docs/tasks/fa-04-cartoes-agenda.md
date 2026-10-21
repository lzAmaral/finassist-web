# FA-04 — Mostrar cartões, faturas e agenda de compromissos

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P1 · **Esforço:** G · **Dependências:** FA-01 e decisão de dados de FA-02.

- **Status:** Concluída
- **Responsável:** agente FA-04 (GPT-6.1 Sol high); integração e QA final pelo coordenador
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações locais, sem commit conforme instrução

## Objetivo e escopo

**Escopo:** visão por cartão com fechamento/vencimento quando fornecidos, parcelas conhecidas e agenda de vencidos, hoje e próximos 7/30 dias. Começar por leitura; modelar obrigações futuras sem presumir que toda transação bancária representa uma conta a pagar.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Confirmar campos realmente disponíveis na fonte escolhida e na documentação oficial do provedor.
- [x] Definir contratos para cartões, faturas, obrigações futuras, estimativas e estado de pagamento.
- [x] Implementar agregação que evita dupla contagem entre compras, parcelas, recorrências e faturas.
- [x] Construir visão por cartão e agenda de vencidos, hoje e próximos 7/30 dias, com origem e atualização dos dados.

## Critérios de aceite

- [x] Valor em conta, fatura e compromisso futuro têm significado distinto na interface.
- [x] Datas ausentes aparecem como não informadas; compromissos estimados são identificados como estimativas.
- [x] Pagamento de fatura não duplica despesa das compras; estornos e parcelas mantêm as regras do projeto.
- [x] Um compromisso não vira pago apenas porque a data passou; exibir a origem da confirmação ou ação manual prevista no contrato.
- [x] O mesmo evento não aparece duplicado como recorrência, parcela e fatura na soma de compromissos.

## Validação

- [x] Cobrir cartão sem data, fatura quitada, compra parcelada, estorno e virada de mês (fatura quitada é indisponibilidade explícita: postagem e data não inventam confirmação; regras de estorno/pagamento existentes preservadas).
- [x] Cobrir atraso e recorrência estimada; comprovar que passar a data não marca uma obrigação como paga.
- [x] Conferir totais da agenda com eventos sobrepostos e regras financeiras existentes.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações.
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: cartão sem data, fatura quitada, compra parcelada, estorno, virada do mês e obrigação em atraso. Confirmar disponibilidade dos campos junto à documentação oficial do provedor na implementação.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [web/src/lib/finance.ts](../../web/src/lib/finance.ts)
- [web/src/lib/server/finance-data.ts](../../web/src/lib/server/finance-data.ts)
- [web/src/lib/server/pluggy-sync.ts](../../web/src/lib/server/pluggy-sync.ts)
- [backend/internal/domain/payment.go](../../backend/internal/domain/payment.go)
- [docs/regras-de-calculo.md](../../docs/regras-de-calculo.md)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| Campos reais e limitações de fatura | Documentação oficial Pluggy [Account](https://docs.pluggy.ai/en/docs/products/accounts), [Transaction](https://v2.docs.pluggy.ai/en/docs/products/transactions); `domain/account.go`, `openfinance/sync.go`, `finance-data.ts`; [contrato de cartões/agenda](../agenda-cartoes.md) | Conferido 21/10/2026: saldo/limite usado não substitui fatura; fonte atual não persiste recurso de faturas |
| API Go protegida e sem segredos | `agenda_api.go`, `agenda_api_test.go`; `go test ./internal/usecase/agenda ./internal/infra/http ./internal/infra/pluggy` | PASS: sessão obrigatória, HTTP 501 em leitor antigo, falha genérica, sem item_id privado, nulls preservados; suites completas desses 3 pacotes verdes |
| Cartão sem data, compra parcelada/quitada, não duplicação, centavos | `TestBuildSeparatesDebtInstallmentsAndObligations`, `TestBuildWindowsCentsUnknownDatesAndLocalDay` | PASS: saldo/cartão/parcela importada fora dos totais; pagamento lançado não confirma quitação de fatura; IDs repetidos ignorados; 0,10+0,20=0,30 |
| Atraso, estimativa, meses pagos/cancelados e dia 31 | `TestBuildRecurrenceMonthEndAndPaymentCoverage`; demais testes de `agenda` | PASS: referência paga/cancelada suprime previsão, dia 31 vira 28/fev, vencido continua sem confirmação, virada local São Paulo |
| Reader PostgreSQL real | `TEST_DATABASE_URL=<banco sintético> go test ./internal/infra/db -run TestAgendaQueries -v` | PASS, fixture exclusiva + cleanup: filtra renda/transferência, conserva origem/status/datas, mês pago não reaparece como previsão |
| Regras existentes de pagamento de fatura/estornos/parcelas | Suite completa `internal/infra/pluggy` (inclui `TestToExternal`, `TestToExternal_CardPaymentCategoryOnlyIgnoresRealInvoices`, `TestToExternal_InstallmentDate`) | PASS, sem alterar mapeamento financeiro existente |
| Cloud: zero real versus ausente e calendário | `node --experimental-strip-types --test tests/card-agenda.test.mjs` | 2/2 PASS: saldo zero preservado, limite/datas/fatura null, agenda indisponível, sem IDs privados, janelas 7/30 na virada do mês |
| Tipos/Svelte, formatação e análise estática | `npm run check`; prettier nos 4 arquivos web próprios; gofmt nos módulos/testes Go; `go vet ./internal/usecase/agenda ./internal/infra/db ./internal/infra/http` | Check inicial 0 erros/0 warnings; vet PASS; repetições integradas apontaram apenas imports de componentes FA05 (corrigidos) e depois 6 imports em GoalsManager FA07 recém-chegado (informados ao coordenador); nenhum erro nos módulos FA04; build/lint/QA final pelo coordenador |
| Integração página/loader/nav/cloud | Coordenador integrou `/cartoes`, `CardAgenda`, loader `GET agenda` e `cloudAgenda(snapshot)` | Código integrado; verificação visual mobile/teclado/recuperação de erro pendente com coordenador |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Chrome com API/DB reais: cartão com R$ 1.200 de saldo devedor e compromisso de R$ 150 separados; fatura e quitação indisponíveis explicitamente. Viewports 768/390/320 sem overflow.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** decisão FA02 aplicada: Go/PostgreSQL autoridade; cloud apenas consulta. FA01 fornece capacidades e estados do loader. Leitor opcional `AgendaReader` evita ampliar contratos/mocks de outros contextos. `payments.due_date` importado é data da transação, portanto nunca vira automaticamente obrigação. Não há fatura/quitação própria persistida: `invoice:null` e aviso explícito. Datas manuais de parcelas e recorrências são estimativas; estimativas separadas dos valores registrados. Dedup por pagamento e compra/mês; faturas e importadas fora dos totais.
- **Pendências / fora do escopo:** Faturas identificadas e quitação não estão disponíveis na fonte atual; UI não as infere de saldo ou data. Agenda cloud permanece indisponível; cartões cloud somente em BRL. Nenhum dado real, envio externo ou deploy foi usado na validação.
