# Plano de melhorias do FinAssist Web

Pesquisa realizada em 21/10/2026. Status: proposta de backlog; nenhuma funcionalidade implementada por este documento.

## Direção proposta

Transformar o FinAssist em uma ferramenta que responde três perguntas: **como estou neste mês, o que preciso resolver agora e quanto já comprometi para os próximos meses?**

O foco inicial é o aplicativo pessoal de um proprietário, com a interface SvelteKit em `web/`. O backend Go e o frontend React original são referências de funcionalidades reaproveitáveis. Não se pressupõe lançamento comercial, cadastro público ou mudança do modelo de privacidade.

A recomendação é aproximar as funcionalidades existentes da experiência web antes de ampliar integrações. Os mecanismos de produto usados são **tempo até o primeiro resultado útil** (onboarding com uma ação concreta) e **hierarquia de atenção** (destacar pendências e decisões). A disciplina de escopo segue o filtro de custo permanente da skill `revenue-centric-design`: cada recurso precisa reforçar a utilidade principal e justificar seu custo de operação. São critérios de projeto, não resultados de experimentos realizados no FinAssist.

## Pesquisa dos concorrentes

As observações abaixo vêm de páginas públicas, não de testes em contas autenticadas. Recursos anunciados não foram validados operacionalmente. Não foram verificadas alegações regulatórias, de segurança ou números de clientes.

| Referência | Proposta observada | Aplicação ao FinAssist |
| --- | --- | --- |
| [Pierre — Converse](https://lp.pierre.finance/lp/converse) | Conversa natural, consolidação bancária, identificação de padrões, parcelas e assinaturas, objetivos e visão de investimentos; destaca acesso somente de leitura. | Aproximar a análise da pergunta do usuário, mostrar compromissos futuros e explicar as evidências de cada alerta. |
| [Grana Smart — página principal](https://granasmart.com.br/) e [planos](https://granasmart.com.br/planos) | Exemplos de automações, alertas de aumento de despesas, lembretes, resumo de parcelas, categorização, conversa e integração com planilhas. | Oferecer algumas regras prontas, configuráveis, com prévia da notificação e controle de frequência. |
| [Contas Online — pessoal](https://www.contasonline.com.br/pessoal/) | Ênfase em vencidos, vencimentos de hoje e futuros, recorrências, cartões, importação OFX/CSV e fluxo de caixa. Metas e aplicativo móvel aparecem com indicação de “em breve” em trechos da página. | Dar prioridade à agenda financeira e à separação entre valores previstos e realizados; considerar importação como alternativa posterior. |

A URL específica `https://granasmart.com.br/lp/suas-contas` não ficou acessível na ferramenta de pesquisa. As conclusões sobre esse concorrente usam as páginas oficiais alternativas acima. Não há conclusão visual sobre essa landing page.

Minha interpretação: Pierre enfatiza entendimento por conversa; Grana Smart, acompanhamento por automações; Contas Online, organização cotidiana. A oportunidade para o FinAssist é reunir acompanhamento e ação em uma rotina curta, aproveitando a base existente.

## O que já existe e o que falta integrar

| Área | Evidência no repositório | Lacuna identificada |
| --- | --- | --- |
| Consulta bancária | [web/README.md](../web/README.md), [sincronização](../web/src/lib/server/pluggy-sync.ts) e [agregação](../web/src/lib/server/finance-data.ts) | Há sincronização cloud e snapshots privados. A conexão inicial ainda depende de configuração externa. |
| Transações | [carregamento da página](../web/src/routes/[[section]]/+page.server.ts) | No modo Go, busca `limit=100`; busca e exportação da interface não têm o conjunto completo quando o mês ultrapassa esse limite. |
| Orçamento e metas | [agregação cloud](../web/src/lib/server/finance-data.ts) e [tela](../web/src/routes/[[section]]/+page.svelte) | Cloud retorna `budget.items: []` e `goals.goals: []`. A tela sugere sincronizar ou usar o painel original, o que não resolve a ausência dessas operações no cloud. |
| Classificação e revisão | [API de classificação](../backend/internal/infra/http/categorize_api.go), [revisão](../backend/internal/usecase/review/review.go) e [economias](../backend/internal/usecase/review/savings.go) | A base Go já tem lógica e APIs que não estão expostas na nova navegação Svelte. |
| Metas completas | [API de metas](../backend/internal/infra/http/goals_api.go) | Go já cria e exclui metas e calcula progresso. Svelte apresenta apenas parte dos campos e não oferece criação. |
| Resumo proativo | [digest](../backend/internal/usecase/insights/digest.go) e [agendamento](../backend/internal/usecase/insights/digest_job.go) | Go já produz resumo semanal determinístico, com possíveis duplicidades e metas em risco. Falta integrá-lo à experiência web/cloud. |
| Conversa e recibos | [uso do chat](uso-do-chat.md) e [handler](../backend/internal/chat/handler.go) | Fluxos existentes na instalação Go não estão disponíveis como conversa dentro da nova web. |
| Cartões e vencimentos | [modelo de pagamento](../backend/internal/domain/payment.go), [contrato web](../web/src/lib/finance.ts), [snapshot](../web/src/lib/server/finance-data.ts) | Go tem vencimento e situação de pagamento. O contrato web não apresenta um modelo completo de cartões/faturas; o snapshot cloud preserva apenas parte dos metadados necessários. |
| Investimentos e análise | [web/README.md](../web/README.md) | Já existem carteira importada/manual, proventos, gráficos e análise opcional. Prioridade menor que completar a rotina financeira básica. |

Inspeção estática de código e documentação: não foi feita auditoria do ambiente de produção nem acesso a dados financeiros reais. As funcionalidades documentadas como existentes não foram revalidadas por execução nesta pesquisa.

## Backlog e acompanhamento

As tarefas foram separadas em [docs/tasks/](tasks/README.md). O índice contém ordem de execução, dependências, status e protocolo de retomada. Cada arquivo contém checklists de implementação, critérios de aceite, validação e evidências.

Este plano mantém o contexto de produto; o escopo detalhado e o progresso são mantidos nos arquivos individuais, evitando duas versões das mesmas tarefas.

- [FA-01 — Guiar o primeiro uso e distinguir capacidades por modo](tasks/fa-01-primeiro-uso.md)
- [FA-02 — Definir e integrar a persistência das operações financeiras](tasks/fa-02-persistencia-integracao.md)
- [FA-03 — Completar busca e exportação no modo Go](tasks/fa-03-busca-exportacao.md)
- [FA-04 — Mostrar cartões, faturas e agenda de compromissos](tasks/fa-04-cartoes-agenda.md)
- [FA-05 — Corrigir categorias e reaplicar regras pela web](tasks/fa-05-categorias-regras.md)
- [FA-06 — Levar a revisão de gastos para a página inicial](tasks/fa-06-revisao-gastos.md)
- [FA-07 — Tornar orçamento e metas utilizáveis no Svelte](tasks/fa-07-orcamento-metas.md)
- [FA-08 — Criar notificações configuráveis a partir de regras prontas](tasks/fa-08-notificacoes.md)
- [FA-09 — Adicionar perguntas sobre os próprios dados na web](tasks/fa-09-perguntas-web.md)
- [FA-10 — Importar extratos com prévia e conciliação](tasks/fa-10-importacao-extratos.md)

## Sequência de entrega

1. **Confiabilidade e orientação:** FA-01 e FA-03; decisão/prova técnica de FA-02. Resultado: estados claros e busca/exportação completas no modo Go.
2. **Dados e ações básicas:** concluir a integração escolhida em FA-02, depois FA-05 e criação de metas de FA-07. Resultado: decisões persistem e o usuário opera pelo novo frontend.
3. **Rotina financeira:** FA-04, FA-06 e restante de FA-07. Resultado: compromissos e prioridades ficam visíveis.
4. **Acompanhamento:** FA-08, começando pelo resumo semanal e usando apenas os tipos de alerta cujos dados já foram entregues.
5. **Expansão por necessidade observada:** FA-09 e FA-10, reavaliando prioridade conforme uso real.

FA-01 e FA-03 são independentes. Depois de FA-02, classificação, cartões e revisão podem evoluir separadamente, desde que compartilhem os contratos definidos. A sequência é planejamento; nenhum agente, job ou sistema externo de tarefas foi criado.

## Como verificar se melhorou

- **Primeiro valor:** tempo do login até o primeiro resumo real e acionável; registrar motivo de bloqueio quando não acontece.
- **Confiança:** diferenças entre totais equivalentes dos relatórios e resultado da busca; duplicações e erros de conciliação.
- **Esforço poupado:** quantidade de correções repetidas que passam a ser resolvidas por regras.
- **Utilidade:** pendências resolvidas e alertas considerados úteis, em vez de contagem de notificações enviadas.
- **Continuidade:** capacidade de repetir a rotina semanal sem depender do painel original para as tarefas entregues.

Como o produto é pessoal, começar com um registro de validação do proprietário e cenários sintéticos. Não há base para inferir conversão ou retenção de mercado. Coletar linha de base antes de definir metas numéricas; eventos técnicos não devem carregar saldos, extratos, credenciais ou nomes de estabelecimentos.

## Itens fora da primeira sequência

Pagamentos/Pix, recomendações de ativos, multiusuário/família, integração com Google Planilhas, aplicativo nativo, landing page comercial e cobrança de assinaturas exigem objetivos próprios. O roadmap atual prioriza a rotina pessoal existente. Importação e conversa sobem de prioridade se o uso revelar que são o maior bloqueio.

## Critério de conclusão das futuras tarefas

Cada entrega precisa demonstrar o fluxo completo com dados sintéticos, erros recuperáveis, comportamento móvel e regras financeiras consistentes. Usar as verificações existentes de `web/` (`npm run check`, `npm test`, `npm run build`) e os testes Go relevantes quando houver alteração no backend. Não é necessário executar a suíte de aplicação apenas para editar este plano.
