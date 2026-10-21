# FA-06 — Levar a revisão de gastos para a página inicial

[Índice e protocolo de execução](README.md) · [Contexto e pesquisa](../plano-melhorias-produto.md)

**Prioridade:** P1 · **Esforço:** M · **Dependências:** FA-02; FA-05 melhora a qualidade, mas não bloqueia a primeira versão.

- **Status:** Concluída
- **Responsável:** agente FA-06 (GPT-6.1 Sol high), integração e validação visual pelo coordenador
- **Última atualização:** 21/10/2026 — integração, testes, build e QA pelo coordenador concluídos
- **PR/commit:** alterações locais, sem commit por orientação da execução

## Objetivo e escopo

**Escopo:** bloco “O que precisa da sua atenção” com até três prioridades: possível duplicidade, aumento de cobrança e assinatura a revisar. Reaproveitar revisão e decisões de economia do Go, com acesso ao histórico relevante.

## Antes de implementar

- [x] Ler o protocolo do índice e revalidar os arquivos de referência no código atual.
- [x] Confirmar as dependências aplicáveis; registrar evidência ou bloqueio na seção de retomada.
- [x] Delimitar os modos afetados (Go/cloud), contratos e casos de erro; registrar decisões relevantes.

## Implementação

- [x] Mapear candidatos, decisões e dispensas existentes no Go e seus contratos.
- [x] Integrar a leitura da revisão e a persistência das decisões no modo escolhido.
- [x] Priorizar até três sugestões na página inicial, com evidências e acesso ao histórico.
- [x] Distinguir hipótese, economia potencial e economia observada; tratar ausência de evidência.

## Critérios de aceite

- [x] Explicar motivo, período e transações usados em cada sugestão.
- [x] Apresentar duplicidade como possibilidade a revisar.
- [x] Persistir dispensas e decisões registradas pelo usuário.
- [x] Distinguir economia potencial de observada e não gerar alertas sem evidência suficiente.

## Validação

- [x] Cobrir compra legítima repetida, reajuste, histórico curto e retorno de cobrança cancelada.
- [x] Verificar persistência de dispensa após recarga e sincronização.
- [x] Registrar forma de avaliar utilidade versus dispensa das sugestões.
- [x] Executar as verificações existentes aplicáveis aos arquivos alterados e registrar comando, resultado e limitações.
- [x] Revisar o diff, confirmar o escopo e atualizar documentação de comportamento/contratos quando necessário.

Orientação original de verificação: compra legítima repetida, assinatura com reajuste, histórico curto, cobrança que retorna após cancelamento registrado. Medir sugestões úteis versus dispensadas.

## Referências para começar

Os caminhos são pontos de entrada, não uma lista obrigatória de arquivos a alterar. Reaproveitar implementações existentes e conferir seu comportamento antes de criar novas.

- [backend/internal/usecase/review/review.go](../../backend/internal/usecase/review/review.go)
- [backend/internal/usecase/review/savings.go](../../backend/internal/usecase/review/savings.go)
- [backend/internal/infra/http/review_api.go](../../backend/internal/infra/http/review_api.go)
- [backend/internal/infra/http/savings_api.go](../../backend/internal/infra/http/savings_api.go)
- [web/src/routes/[[section]]/+page.svelte](../../web/src/routes/[[section]]/+page.svelte)

## Evidências de conclusão

Preencher durante a execução; não marcar critérios apenas porque o código foi escrito.

| Critério ou verificação | Evidência (arquivo, teste, comando ou revisão manual) | Resultado/data |
| --- | --- | --- |
| Hipóteses, prioridade até três e rótulos honestos | `web/tests/spending-review.test.mjs`: priorização, dispensa, duplicata legítima, aumento por categoria sem alegar reajuste; `SpendingReview.svelte` | 4 testes Node aprovados em 21/10/2026 |
| Transações e período usados | `review/evidence_test.go`, `http/review_evidence_test.go`: IDs individuais, datas e valores, duplicatas só da sequência relevante, meses da média incluindo zero de categoria em mês observado | Go aprovado em 21/10/2026 |
| Dispensa e decisão persistentes | `db/review_persistence_test.go`: gravar, RefreshExternal duas vezes, nova conexão, mesma identidade sem duplicar, reler dispensa e decisão, desfazer | PostgreSQL sintético aprovado em 21/10/2026 |
| Fluxos persistentes legados | `TEST_DATABASE_URL=<descartável> go test ./internal/infra/db -run 'TestReview_' -count=1 -v` | 2 testes aprovados em 21/10/2026 |
| Sem histórico versus retorno de cobrança | `review/savings_test.go`: ausência total não confirma economia, meses parciais observados, retorno no mês aberto | Go aprovado em 21/10/2026 |
| Regressões do domínio/API | `go test ./internal/usecase/review ./internal/usecase/insights ./internal/infra/http` e `go vet` nesses pacotes e `infra/db` | Aprovados em 21/10/2026 |
| Contratos e Svelte | `npm run check` | Zero erros e avisos em 21/10/2026 |
| Testes do cliente/helpers | `node --experimental-strip-types --test web/tests/spending-review.test.mjs` | 4 aprovados em 21/10/2026 |
| Integração página inicial, rota, build e navegador | Coordenador integra páginas; não executado por este agente | Aprovado pelo coordenador; ver validação integrada, 21/10/2026 |

- [x] Todos os critérios de aceite foram demonstrados; limitações e pendências estão explícitas.
- [x] Evidências foram preenchidas e o próximo passo foi atualizado.
- [x] Status deste arquivo e linha correspondente no índice foram atualizados juntos.

## Validação integrada pelo coordenador

Integração na visão geral com overview e rota /revisao. Chrome com API/DB reais: dispensar sugestão, recarregar e restaurar; evidências e economia potencial identificadas. Limite de três prioridades coberto pelo teste de helper e integração do componente.

Verificações finais: web **66/66 testes**, Svelte check **0 erros/0 avisos**, build Vercel aprovado; Go completo com PostgreSQL descartável (`go test -p 1 ./... -count=1`), `go vet`, `golangci-lint` **0 issues** e gofmt; regressão React **125/125 testes**, TypeScript e oxlint. [Relatório reproduzível e limites](validacao-integrada.md).

## Retomada e decisões

- **Último passo concluído:** implementação integrada, critérios verificados e evidências finais registradas pelo coordenador.
- **Próximo passo concreto:** nenhum trabalho de implementação pendente nesta tarefa. Publicação e migrações de produção não foram executadas.
- **Bloqueios:** nenhum no escopo entregue.
- **Decisões e justificativas:** ADR 0009 respeitada: Go/PostgreSQL calculam e persistem; cloud mostra indisponibilidade. GET `/api/review` adiciona `historyMonths`, `candidates[].evidence` (id/data/descrição/valor) e `history` (mês/total). Os candidatos INCREASE são aumentos de categoria, sem alegar reajuste de assinatura. Duplicata é hipótese, inclusive compras legítimas repetidas. As evidências individuais são do mês; histórico comparativo é agregado pelo Go. Dispensa mantém a chave tipo/descrição global já existente; UI explica esse alcance e permite restaurar. A decisão registra que parou de pagar, sem cancelar serviço externamente.
- **Economia observada:** corrigido `BuildSavings` para só confirmar meses fechados com alguma despesa observada; ausência total de dados não vira economia. Isso ainda não prova cobertura completa; a interface explicita essa limitação e a tolerância residual de metade do custo, preservando o domínio existente. Retorno de cobrança permanece destacado mesmo no mês em aberto.
- **Avaliação de utilidade:** começar registro manual sintético/uso do proprietário com contagens de sugestões revisadas, decisões consideradas úteis e dispensas por tipo. O painel permite consultar dispensadas e decisões; não foram criados eventos com valores ou estabelecimentos, nem inferidas métricas de mercado.
- **Pendências / fora do escopo:** Sugestões são hipóteses, não confirmação de cobrança indevida. Meses com despesas não garantem cobertura integral; sem evidência não se confirma economia. Nenhum dado real, envio externo ou deploy foi usado na validação.
