# Controle de gastos — pesquisa e escopo de novembro de 2026

Data: 04/11/2026. Pesquisa e ajuste de escopo: Astra. Base inspecionada: `origin/dev` em `a7f9bd1`. Esta rodada contém somente FA-18, FA-19 e FA-20; a implementação e a publicação exigem suas próprias evidências.

## Evidência de mercado

| Fonte primária consultada | O produto apresenta | Aplicação ao FinAssist — inferência de produto |
| --- | --- | --- |
| [Monarch — Budgeting](https://www.monarch.com/features/budgeting) | Histórico por categoria, barras de progresso, divisão entre gastos fixos, flexíveis e não mensais, planejamento e rollover. | Contextualizar o gasto ajuda mais que acrescentar outro total isolado. Limites e planejamento já existem no Go; não reproduzi-los no cloud. |
| [Monarch — Tracking](https://www.monarch.com/features/tracking) | Relatórios por categoria e período, busca de transações, contas e assinaturas em lista/calendário; padrões recorrentes são apresentados para revisão. | A leitura agregada deve permitir conferir os lançamentos que a sustentam. Uma descrição bancária, sozinha, não comprova estabelecimento ou assinatura. |
| [Organizze — página oficial](https://www.organizze.com.br/) | Comparação de períodos, categorias, limites de gastos, centralização de contas/cartões e projeções com compromissos. | Comparação temporal e acesso à evidência são úteis antes de automatizar recomendações ou ampliar planejamento. |
| [YNAB — Auto-Assign](https://support.ynab.com/en_us/auto-assign-a-guide-r1gBNbBJo) e [Targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks) | Reaproveitar valores atribuídos ou gastos no mês anterior; metas semanais, mensais, anuais e personalizadas. | Referências históricas podem orientar o orçamento, mas copiar valores e criar metas já se aproxima do planejamento existente. Primeiro melhorar a leitura das despesas que alimenta essas decisões. |

As páginas acima foram relidas em 04/11/2026. São descrições dos próprios produtos, não estudo de eficácia. Não foi verificado uso real, conversão, economia obtida ou preferência de usuários. Nenhuma estatística de benefício foi inferida.

O coordenador consultou o conteúdo de YNAB na pesquisa inicial desta rodada; a releitura do Astra não retornou corpo legível. Nenhum comportamento foi inferido dessa falha de leitura. As funções citadas acima vêm do conteúdo consultado, sem teste de uma conta desses serviços.

Foi aplicado o filtro de custo permanente e foco no uso central da skill `revenue-centric-design`, seção Product Strategy & Feature Discipline. A aplicação neste projeto pessoal é uma escolha de escopo: preferir melhorias de consulta sem novos cadastros, serviços ou custos operacionais; não adotar metas de receita ou métricas não medidas.

## Diagnóstico do código

- `web/src/lib/analysis.ts` compara `summary.current.expense` com o mês anterior inteiro. `SpendingAnalysis.svelte` avisa que o mês atual pode estar incompleto, mas ainda apresenta a porcentagem. Não existe comparação com janelas equivalentes.
- `Dashboard.transactions` contém os lançamentos normalizados do mês. Cloud usa `dashboardFromSnapshot`; Go usa `loadAllTransactions`, que recusa paginação inconsistente. Ambos entregam valores em reais; a aritmética de apresentação deve operar em centavos.
- A conversão cloud já decide direção, estorno, competência de parcelas, BRL e transferências próprias. Não reinterpretar `Movement`, descrição bancária ou fatura nos novos helpers. Estornos são `EXPENSE` com valor negativo. Confirmação usa `POSTED` no cloud e `PAID` no Go.
- A lista atual permite busca, categoria, conta, entrada/saída e CSV. Ainda não mostra concentração por descrição com evidências, nem uma visão agrupada de pendências e qualidade de categorias. A análise conta pendências, sem detalhar seu efeito.
- FA-06 já possui candidatos `FIXED`, `ANT`, `NEW`, `INCREASE` e `DUPLICATE` no Go, com evidência e decisões. FA-12 já entrega limites, gastos pagos/pendentes, saldo restante e estados. Refazer recorrências ou limites em TypeScript seria duplicação.
- `syncedAt` informa a consulta do snapshot; não comprova que cada banco entregou todos os lançamentos até essa data. Lista completa da API também não comprova cobertura bancária completa.

## Rodada delimitada

| Tarefa | Decisão que passa a ser possível | Entrega |
| --- | --- | --- |
| [FA-18](tasks/fa-18-comparacao-gastos.md) | Avaliar se os gastos disponíveis aumentaram em janelas comparáveis. | Comparação confirmada mês atual/anterior com corte explícito; substituir o indicador enganoso da análise. |
| [FA-19](tasks/fa-19-concentracao-despesas.md) | Escolher quais grupos de despesas conferir primeiro. | Concentração por descrição exata e conta, compras e estornos separados, evidências expansíveis. |
| [FA-20](tasks/fa-20-auditoria-base-gastos.md) | Entender o que está pendente, pouco categorizado ou reduzindo as despesas antes de interpretar os resultados. | Auditoria de pendências, categoria ampla/ausente e estornos; sem classificar estorno como erro. |

As três entregas são consultas sobre `Transaction` já normalizada, para cloud e Go. São projeções de apresentação de dados existentes: não criam fonte financeira, persistência, regras de recorrência, orçamento, planejamento ou conciliação. Isso preserva a [ADR 0009](decisoes/0009-persistencia-web-go.md). O Go continua responsável pelos casos de uso financeiros e pelas escritas. Não alterar cálculos do Gemini ou payload enviado ao provedor nesta rodada.

Não entram: hospedagem Go, multiusuário, notificações novas, cópia de orçamento, rollover, novos limites, previsão de saldo, identificação automática de assinaturas, faturas identificadas, importação de cartão ou união de contas. FA-11 e FA-13–17 permanecem no backlog, com seus escopos intactos.

## Integração e execução paralela

Cada tarefa é implementada por um agente GPT-6.1 Sol, raciocínio high, em arquivos próprios. Os documentos individuais fixam os contratos. O coordenador é dono de `web/src/routes/[[section]]/+page.svelte`, `+page.server.ts`, `web/src/lib/server/dashboard-page.ts` e testes de loader/integrados; também consolida este índice e documentação geral. Os agentes não editam esses arquivos compartilhados.

Na rota `analise`, o coordenador apresenta a comparação antes da análise existente, depois concentração e auditoria. Não criar navegação principal adicional. A comparação recebe os lançamentos do mês anterior carregados separadamente; falha opcional não apaga o dashboard nem a análise. No cloud, consultar `dashboard?month=<anterior>`; no Go, reutilizar `loadAllTransactions`. Não somar fontes, não acrescentar API e não enviar dados novos ao Gemini. A carga anterior ocorre somente em `analise`, podendo ser omitida para meses futuros.

Todos os componentes recebem `hidden`, funcionam em 320 px e expõem estados vazios e indisponíveis diferentes. A opção de privacidade mascara valores, percentuais e representações visuais quantitativas. Evidências continuam mostrando descrições como o comportamento atual da lista.

## Validação

Cada tarefa precisa de testes de cálculo com dados sintéticos e verificação visual de teclado, mobile, privacidade e troca de mês. O coordenador executa `npm run check`, `npm test`, `npm run build` em `web/`, testa a integração dos dois modos e registra limitações. CI e publicação seguem [CONTRIBUTING.md](../CONTRIBUTING.md) e [ci-cd.md](ci-cd.md); nenhuma ação desta pesquisa acessa dados reais ou publica produção.
