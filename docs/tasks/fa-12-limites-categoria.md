# FA-12 — Limites mensais por categoria

[Índice e protocolo](README.md)

**Prioridade:** P1 · **Dependências:** FA-02, FA-05 e FA-07

- **Status:** Concluída
- **Responsável:** agente principal
- **Última atualização:** 23/10/2026

## Objetivo e critérios de aceite

- [x] Definir centavos inteiros, competência mensal, limite zero e ausência de limite como estados distintos.
- [x] Criar migração idempotente, persistência e API autenticada com proteção de origem e conflito de versão.
- [x] Calcular despesas pagas e pendentes com categorias efetivas, excluindo receitas, transferências e cancelamentos.
- [x] Criar, editar e remover limites na tela de orçamento; preservar mês e privacidade dos valores.
- [x] Validar persistência, concorrência, competência, erro recuperável, navegação por teclado e mobile.

## Validação e entrega

- [x] Conferir contratos e modos afetados no código atual.
- [x] Implementar e validar com dados sintéticos; registrar comandos e resultados abaixo.
- [x] Verificar erros, recuperação, recarga e concorrência quando aplicável.
- [x] Revisar diff e documentação; manter índice e checklists coerentes.

## Evidências

| Verificação | Evidência | Resultado em 23/10/2026 |
| --- | --- | --- |
| Cálculo e estados | `backend/internal/usecase/planning/category_budget_test.go`: ausência/zero, pendentes, teto exato, excesso de um centavo e histórico ausente | Aprovado |
| Consulta e persistência | `backend/internal/infra/db/category_budget_queries_test.go`: categoria efetiva, competência, exclusões, nova conexão, meses independentes, concorrência e remover/recriar | Aprovado em PostgreSQL 17 descartável |
| Migração idempotente | `023_category_budget_limits.sql` aplicada duas vezes no banco sintético; reaplicação preservou tabela | Aprovado |
| Segurança e API | `backend/internal/infra/http/category_budget_api_test.go`: sessão, origem, JSON, entradas inválidas, zero, conflito 409, remoção, no-store, modo indisponível e erro sem segredo | Aprovado |
| Regressão Go | `TEST_DATABASE_URL=<banco descartável> go test -p 1 ./... -count=1`; `go vet ./...`; `golangci-lint run ./...`; gofmt | Todos aprovados; lint com 0 issues |
| Entrada de valores | `web/tests/category-budgets.test.mjs`: centavos, zero, limite máximo, decimais e entradas ambíguas | Aprovado; suite web com 67 testes |
| Svelte | `npm run check`; `npm run build` | Check com 0 erros/0 avisos; build aprovado (aviso de chunk acima de 500 kB) |
| Fluxo real web → Go → banco | Chrome/Playwright com dados sintéticos: criar, editar, recarregar, zero, cancelar/confirmar remoção, duas sessões em conflito, atualizar após erro e alternar meses | Aprovado |
| Mobile, privacidade e acessibilidade | 320/390/768/1440 px sem overflow, inclusive teto máximo; abertura por teclado com foco no campo; valores e entrada mascarados | Aprovado |
| Ausência e respostas atrasadas | Categoria sem despesas pode receber limite; zero sem despesas não vira sucesso; resposta do mês anterior ignorada depois da navegação | Aprovado |

Para repetir a verificação de UI: em uma instalação **sintética** com Go e migrations até 023, abrir `/orcamento`, definir limite com centavos, recarregar, editar para zero, abrir o mesmo editor em duas abas e salvar valores diferentes (a segunda deve receber conflito). Trocar o mês, conferir isolamento, voltar e remover com confirmação. Repetir em 320 px e ocultar os valores. Simular falha/demora em `GET /api/budget-limits` no navegador, conferir recuperação e que a resposta antiga não substitui o mês atual.

As sessões de QA usaram cópias em `/tmp/finassist-task-qa`, sem carregar `.env` real. Os testes de banco requerem `TEST_DATABASE_URL` e são pulados sem essa variável; nesta validação foram executados com PostgreSQL, não pulados.

## Retomada e decisões

- **Último passo:** API, persistência, cálculo e interface concluídos; evidências acima verificadas.
- **Contratos:** `GET /api/budget-limits?month=YYYY-MM`; `PUT/DELETE /api/budget-limits/{category}?month=YYYY-MM`, com versão de edição. Valores inteiros em centavos; detalhes em [docs/api.md](../api.md).
- **Decisões:** modo Go; categorias da mesma lista de despesas da classificação. Cada limite vale exclusivamente para o mês selecionado, sem recorrência implícita. Zero é explícito. A remoção mantém uma revisão sem limite ativo para impedir sobrescrita por formulário antigo. O painel mostra categorias com despesas ou limite e permite escolher as demais.
- **Próximo passo:** integrar pelo fluxo `dev` → `main` quando solicitado; ativação real do backend e migrations é acompanhada pela FA-17. As outras seis tarefas desta etapa continuam pendentes.
- **Limitações:** despesas disponíveis não comprovam cobertura completa. Sem backend conectado, limites ficam indisponíveis. Não há notificações de estouro nem cópia automática para outros meses nesta entrega.
- **Branch:** `feat/proximas-melhorias`, criada de `origin/dev`. Sem publicação desta etapa e sem migração de banco real.

Publicação segue o fluxo de desenvolvimento do repositório. Dependência não confirmada não é critério concluído.
