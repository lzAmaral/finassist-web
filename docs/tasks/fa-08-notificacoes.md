# FA-08 — Criar notificações configuráveis a partir de regras prontas

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P1 · **Esforço:** G · **Dependências:** FA-02 e FA-06; lembretes dependem também de FA-04; alertas de metas, de FA-07.

- **Status:** Concluída
- **Responsável:** agente FA-08 (GPT-6.1 Sol, high)
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações locais; sem commit/deploy por instrução do usuário

## Objetivo e escopo

**Escopo:** primeira entrega com resumo semanal e alertas dentro da aplicação. Usar o Telegram já existente quando configurado. Permitir habilitar/desabilitar tipos, escolher horário/fuso e ver prévia. WhatsApp é uma avaliação posterior, apesar de existir adaptador Evolution no projeto.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Definir agendador, armazenamento de preferências e identidade persistente das notificações conforme FA-02.
- [x] Integrar resumo semanal e alertas dentro da aplicação; habilitar apenas tipos com dados já entregues.
- [x] Adicionar preferência de horário/fuso, ativação por tipo, ocultação de valores e prévia.
- [x] Integrar Telegram quando configurado e implementar deduplicação, retentativa limitada e registro de falhas.

## Critérios de aceite

- [x] Executar agendamento sem depender de navegador aberto.
- [x] Impedir notificações duplicadas em reexecuções, com identidade persistente.
- [x] Limitar retentativas e interromper novos envios quando a preferência for desativada.
- [x] Permitir ocultar valores e visualizar a prévia.
- [x] Validar configuração do canal e agendador antes de prometer entrega.

## Validação

- [x] Simular job duplicado, erro de entrega, canal desconectado e mudança de fuso.
- [x] Verificar desativação de regra e persistência das preferências.
- [x] Usar transporte simulado nos testes, sem enviar mensagens reais como efeito colateral; conferir logs sem conteúdo financeiro.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações.
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: job executado duas vezes, falha de entrega, canal desconectado, alteração de fuso e desativação da regra. Medir entregas úteis, dispensas e falhas, sem gravar conteúdo financeiro em telemetria.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [backend/internal/usecase/insights/digest.go](../../backend/internal/usecase/insights/digest.go)
- [backend/internal/usecase/insights/digest_job.go](../../backend/internal/usecase/insights/digest_job.go)
- [backend/internal/chat/digest.go](../../backend/internal/chat/digest.go)
- [backend/internal/app/jobs.go](../../backend/internal/app/jobs.go)
- [web/src/lib/server/cloud-api.ts](../../web/src/lib/server/cloud-api.ts)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| Persistência, identidade e concorrência | `infra/db/notifications_test.go`: insert concorrente, claim concorrente, nova conexão, migração idempotente, leitura/dispensa, job não reaparece e cancelamento | 2 testes PostgreSQL aprovados em schema descartável, 21/10/2026 |
| Agendamento sem navegador, fuso e repetição | `usecase/notifications/service_test.go`: Run independente, horário local, reinício, fuso alterado, desativação, canal desconectado | Testes Go e `go test -race ./internal/usecase/notifications ./internal/infra/http` aprovados, 21/10/2026 |
| Entrega e privacidade | Transporte falso: três tentativas em recusa confirmada; erro ambíguo sem retentativa; prévia sem Store/transport; valores ocultos e erros genéricos | Aprovado sem chamadas externas, 21/10/2026 |
| Dependências FA02/04/06/07 reais | `app/notification_source_test.go` aplica migrations em schema próprio e calcula resumo/revisão/meta/lembrete a partir das queries/casos de uso reais; exclui compra importada e testa prévia sem efeitos; Tick repetido após remontagem não duplica | Teste PostgreSQL aprovado, 21/10/2026 |
| Preferências e segurança HTTP | `notifications_api_test.go`: sessão, origem, validação, erro de persistência, estado real scheduler/canal; `notification_settings_test.go`: compatibilidade bidirecional com React e reset | 3 testes HTTP dedicados aprovados; bridge cobre rejeição de lote misto sem mutação e reset; suíte HTTP completa e race aprovadas, 21/10/2026 |
| Web | `node --experimental-strip-types --test tests/notifications.test.mjs`: máscara, fuso/horário, status incerto e erro HTTP; `npm run check` | 4 testes aprovados; 0 erros/0 avisos Svelte, 21/10/2026 |
| Verificações Go | `go test ./internal/usecase/notifications ./internal/app ./internal/infra/http ./internal/infra/db ./internal/infra/telegram ./internal/usecase`; `go vet` dos mesmos módulos; `gofmt` | Aprovados; testes de integração usam `TEST_DATABASE_URL` sintética e schema próprio, 21/10/2026 |
| Visual e build integrados | Root integra `/notificacoes`, executa build e browser; corrigido bug de clonagem de Proxy Svelte ao usar payload local antes de `$state` | Aprovado pelo coordenador; ver validação integrada, 21/10/2026 |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Chrome: prévia sem envio, valores mascarados, salvar preferências, recarregar, marcar lida e dispensar. Corrigido clone de Proxy Svelte; builder sintético no navegador com Store/Service/HTTP/DB reais, builder financeiro real coberto no teste app. Nenhum Telegram real enviado.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** Go/PostgreSQL oficial conforme ADR0009; polling a cada minuto no processo Go, chave por semana/regra-meta-mês/compromisso-data; tipos só com regras entregues. Preferências iniciais herdam a agenda legada uma única vez; bridge de API antiga lê/grava o mesmo registro para Telegram. Documentação completa de comportamento/contratos em [notificacoes.md](../notificacoes.md).
- **Retentativa:** até três tentativas somente em recusas confirmadas. Telegram não tem idempotency key; falha ambígua de rede/resposta ou claim interrompido fica incerta sem retentar, impedindo duplicação automática. Canal desconectado não bloqueia in-app. Desativar tipo/Telegram cancela pendências; dispensa também cancela pendência.
- **Persistência e privacidade:** conteúdo privado no PostgreSQL, sem telemetria de conteúdo financeiro. Ocultação atua na prévia, leitura e envio; avisos novos já mascarados não recuperam valores ao reativar exibição. Leitura/dispensa/tentativas/falhas ficam persistidas. Lista limitada aos 100 avisos não dispensados mais recentes.
- **Pendências / fora do escopo:** Novo canal de notificações externo é Telegram; resumo WhatsApp legado preservado. Entrega ambígua não é repetida automaticamente. Migration 021 necessária; processo Go ativo para agendamento. Nenhum dado real, envio externo ou deploy foi usado na validação.
