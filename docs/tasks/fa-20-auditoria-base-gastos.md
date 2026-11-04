# FA-20 — Auditar a base da análise de gastos

[Índice e protocolo](README.md) · [Pesquisa e decisão de escopo](../pesquisa-controle-gastos-2026-11.md)

**Prioridade:** P1 · **Esforço:** pequeno/médio · **Dependências:** Dashboard/Transaction existentes; integração pelo coordenador

- **Status:** Concluída
- **Responsável:** implementação por GPT-6.1 Sol (high); escopo Astra; integração coordenador
- **Última atualização:** 04/11/2026

## Objetivo e limite

Permitir conferir três aspectos dos lançamentos disponíveis antes de interpretar gastos: despesas pendentes, categoria ampla/ausente e estornos confirmados. Não calcular score de qualidade, diagnosticar fraude, marcar estorno como erro ou transformar ausência de registros em certeza de cobertura.

## Ownership e contrato

Editar somente `web/src/lib/spending-audit.ts`, `web/src/lib/components/SpendingAudit.svelte`, `web/tests/spending-audit.test.mjs` e este documento. Props: `{dashboard: Dashboard; hidden?: boolean}`. Sem fetch ou escrita. Coordenador integra em `analise` e atualiza índice. Não editar outras tarefas, rotas, lista principal, API, `finance.ts` ou `transactions.ts`.

Modo cloud é identificado por `dashboard.source==='pluggy'`; Go live não tem esse marcador. A auditoria usa `Transaction` já normalizada, sem consultar snapshot bruto ou duplicar classificação/recorrência do Go.

## Regras precisas

1. Exigir modo live, mês válido, lista completa (`total===items.length`, IDs únicos) e valores finitos. Lista parcial/ausente gera aviso de indisponibilidade, sem indicadores zerados. Restringir tudo ao mês selecionado e `kind==='EXPENSE'`; não reavaliar transferências, pagamentos de fatura ou competência.
2. Grupo **Pendentes, fora dos gastos confirmados**: somente `status==='PENDING'`. Mostrar contagem, soma positiva em centavos como “Despesas pendentes” e magnitude da soma negativa como “Estornos pendentes”. Não misturar os dois em um único total que oculte exposição. Não somar aos gastos confirmados, prever vencimento ou afirmar que esses registros serão cobrados.
3. Grupo **Categoria ampla ou ausente**: despesas confirmadas `POSTED|PAID` cujo `category==='OTHER'`, categoria vazia ou `categoryLabel` vazio/“Sem categoria” (comparação trim/case-insensitive apenas desse marcador). `OTHER` pode ser uma escolha correta; rotular “Outros ou sem categoria”, nunca “classificação errada”. Exibir contagem e valor líquido (positivos menos estornos), além de compras e estornos separados quando presentes. Categorias específicas não entram por heurística do texto da compra.
4. Grupo **Estornos confirmados**: despesas `POSTED|PAID` com `amount<0`; magnitude total positiva rotulada “Redução das despesas”. Explicar que esses créditos já reduzem os totais; não adicionar novamente nem sugerir excluir.
5. Grupos podem se sobrepor: um estorno em OTHER pertence aos grupos 2 e 3. Informar que cartões não são somáveis e não criar “total de problemas”. Pending não pode entrar no grupo de estornos confirmados. Status desconhecido não vira confirmado; apresentar nota de registros com status não reconhecido caso existam, sem incorporá-los aos valores.
6. Cada grupo permite expandir todas as evidências, com data, descrição, categoria, conta, valor e status. Ordenar data desc/ID; paginar em 20 registros se necessário. Vazio deve dizer “Nenhum registro disponível neste grupo”, sem selo de contas em dia ou de cobertura completa.
7. Link geral `/transacoes?month=<mês>&flow=EXPENSE` para conferir despesas. No Go oferecer `/classificar?month=<mês>` junto ao grupo de categoria; cloud informa que corrigir categorias exige backend Go, sem CTA de escrita indisponível. Não inventar parâmetros de filtro por status ou ID que a lista atual não suporta. Os detalhes locais são a evidência exata.
8. Mostrar data da última consulta cloud quando disponível e nota de que não comprova cobertura bancária completa. Uma consulta antiga não é um erro da transação. Não enviar evidências ao Gemini.

## Critérios de aceite

- [x] Três grupos têm bases separadas, contagens, valores e evidências sem dupla soma global.
- [x] Pendentes positivos e negativos não se anulam; estornos são apresentados como ajuste legítimo.
- [x] OTHER é categoria ampla, não ausência garantida; links respeitam capacidade do modo.
- [x] Renda/transferência/cancelado/status desconhecido não contaminam totais confirmados.
- [x] Estados vazio, lista parcial e modo indisponível não exibem sucesso financeiro fictício.
- [x] `hidden` mascara todos os montantes, inclusive detalhes e texto acessível; nenhum valor em tooltip ou atributo de título.
- [x] Teclado, expansão `aria-expanded`, foco e layout 320 px verificados; mudança de mês limpa expansão/paginação antiga.

## Testes e evidências

Testes mínimos: PENDING positivo/negativo separados; estorno PAID/POSTED; pending negativo fora de confirmado; OTHER confirmado com estorno sobreposto; categoria específica correta; label “Sem categoria”; status desconhecido; renda e transferências excluídas; centavos; dados fora do mês; lista vazia/ parcial/IDs duplicados; nenhum “total de problemas” que some sobreposições. Verificar link cloud/Go e mais de 20 evidências na UI.

| Verificação | Comando/evidência | Resultado |
| --- | --- | --- |
| Unitários | `cd web && node --experimental-strip-types --test tests/spending-audit.test.mjs` | 9/9 testes passando em 04/11/2026; inclui payload malformado, overflow, datas inválidas e 45 evidências sintéticas |
| Svelte | `cd web && npm run check` | 0 erros e 0 avisos em 04/11/2026 |
| Regressão e build | `npm test`, `npm run build` (coordenador) | Aprovado em 04/11/2026; ver relatório integrado |
| UI integrada | 320 px, teclado, privacidade, estados e links por modo | Aprovado em 04/11/2026; ver relatório integrado |

## Retomada e decisões

Helper `buildSpendingAudit` e componente `SpendingAudit` entregues em 04/11/2026 por GPT-6.1 Sol (high), sem fetch, escrita ou acesso a dados reais. A base inteira é validada antes de produzir grupos: lista completa, IDs únicos/não vazios, centavos finitos/seguros, datas reais ISO e campos de apresentação tipados. Soma fora da precisão segura também indisponibiliza a auditoria, sem exibir indicadores zerados. Cancelados ficam excluídos com nota própria; status string não reconhecido gera contagem separada, sem entrar nos grupos.

Evidências preservam a transação normalizada, ordenadas por data descendente/ID, paginadas em 20; não há soma entre cartões. Os grupos usam centavos inteiros por lançamento. A privacidade usa uma única função de apresentação para todos os montantes, inclusive evidências, sem valor em `aria-label`, tooltip ou `title`. Botões expõem `aria-expanded`/`aria-controls`; alterações de mês limpam expansão e paginação. Essas propriedades foram revisadas no código e verificadas no navegador durante a integração.

Integração concluída pelo coordenador em 04/11/2026, com check sem erros/avisos, 122 testes web, build Vercel e validação Chrome em 1440/768/390/320 px. Expansão/paginação, privacidade, teclado, troca de mês e estados Go/cloud verificados com dados sintéticos. Veja [evidências e limites](validacao-controle-gastos-2026-11.md). Sem migração ou publicação em produção nesta rodada.
