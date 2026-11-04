# Registro cotidiano — rodada Money Flow

[Índice geral e protocolo](../README.md) · Escopo preparado por Astra em 04/11/2026.

Esta pasta transforma seis recomendações da pesquisa em trabalho executável. A primeira entrega desta rodada é **FA-21: lançar uma despesa pela web e encontrá-la após recarregar**. As demais são backlog; iniciar esta rodada não significa entregar todas agora. Implementação: GPT-6.1 Sol, raciocínio high, por tarefa; o coordenador integra e valida. Hospedagem continua uma decisão adiada.

## Evidência e diagnóstico

A [landing page do Money Flow](https://landing-page-money-flow.vercel.app/) foi indicada na pesquisa como anunciando registro por áudio no Telegram e confirmação no chat/painel. São alegações promocionais, sem teste do produto, da precisão de áudio ou de sincronização. A releitura por ferramenta web em 04/11/2026 não retornou conteúdo acessível; esta rodada não acrescenta comprovação independente. As referências a Monarch, Organizze e YNAB e seus limites estão na [pesquisa anterior](../../pesquisa-controle-gastos-2026-11.md). A ideia de despesas anuais deriva dessa pesquisa de planejamento; não é atribuída ao Money Flow.

Inspeção do código em 04/11/2026: o Go já recebe texto e registra lançamentos pelo caso de uso `ledger/AnalyzeExpense.ExecuteText`; não refazer o bot de texto. A API de transações é de leitura; a web ainda não expõe formulário manual. `payments.account_id`, categorias e contas BANK/CREDIT já existem. A importação já cria contas locais. `LedgerRepo.Save` não persiste o vínculo de conta: o novo caminho precisa fazê-lo explicitamente. `ReconcileExternal` já considera conta e janela de datas, enquanto a proteção concorrente `claimStatementExternal` é específica de importações; validar a concorrência do novo caminho. A [ADR 0009](../../decisoes/0009-persistencia-web-go.md) mantém escritas financeiras no Go/PostgreSQL e cloud em consulta.

## Tarefas e dependências

| Recomendação | Tarefa | Status | Dependências e limite |
| --- | --- | --- | --- |
| Ativar a base Go existente | [FA-17](../fa-17-ativacao-backend.md), sem novo ID | Pendente | Destino Go/PostgreSQL e configuração de Preview ainda não decididos. Não bloqueia desenvolver/testar localmente. |
| Lançamento rápido web | [FA-21](fa-21-lancamento-rapido.md) | Concluída | FA-02; API e UI implementáveis agora com dados sintéticos. |
| Conferir, corrigir e desfazer | [FA-22](fa-22-conferir-corrigir-desfazer.md) | Pendente | FA-21; contratos compartilhados com FA-14, sem duplicar conversação. |
| Áudio no Telegram | [FA-23](fa-23-audio-telegram.md) | Pendente | Fluxo textual existente; confirmação e idempotência; ativação real depende de FA-17. |
| Filtros globais de período/conta | [FA-24](fa-24-filtros-globais.md) | Pendente | Contratos de consulta e abrangência validados em Go e cloud. |
| Despesas anuais | [FA-25](fa-25-despesas-anuais.md) | Pendente | Planejamento Go existente; sem duplicar orçamento/metas. |

- [ ] FA-17: ativar backend quando houver destino definido; manter evidências no documento original.
- [x] FA-21: API, UI, integração e [validação](validacao-fa-21.md) concluídas.
- [ ] FA-22: implementar revisão e reversão explícitas.
- [ ] FA-23: acrescentar áudio ao canal existente.
- [ ] FA-24: aplicar filtros coerentes nas consultas.
- [ ] FA-25: planejar despesas não mensais.

## Primeira execução e responsabilidades

FA-21 divide-se em dois pacotes Sol que compartilham o contrato de seu documento: API/persistência e formulário/helper. São subtarefas da mesma entrega, não dois IDs. O coordenador altera as rotas Svelte, capacidades e testes integrados. Integração em dev pelo coordenador após validação; produção segue o fluxo separado de publicação. Usar somente contas e lançamentos sintéticos e PostgreSQL descartável; a Vercel publica apenas `web/` e não ativa o Go.

O responsável muda o arquivo individual para Em andamento ao iniciar implementação; testes não executados e ativação operacional não viram concluídos por inferência. Seguir o [protocolo geral](../README.md), [CONTRIBUTING](../../../CONTRIBUTING.md) e [CI/CD](../../ci-cd.md).
