# Tarefas de melhoria do FinAssist Web

Este é o ponto de entrada para executar e retomar as tarefas. O [plano de produto](../plano-melhorias-produto.md) preserva pesquisa, diagnóstico e direção. **Os arquivos individuais são a fonte do escopo, checklists e evidências de cada tarefa.**

Preparado em 21/10/2026. Progresso: **11 de 17 tarefas concluídas** (primeira etapa: 10/10; segunda etapa: 1/7). Primeira etapa implementada por agentes GPT-6.1 Sol (high), com integração e validação pelo coordenador. Veja o [relatório integrado](validacao-integrada.md). Primeira etapa integrada em `main` no commit `19e1ec5` e publicada no web. A ativação do backend é acompanhada separadamente na FA-17.

## Índice e dependências

P0 = base/correção; P1 = próxima entrega de valor; P2 = expansão posterior. Esforço nos arquivos é relativo, não prazo.

| ID | Tarefa | Prioridade | Status | Dependências |
| --- | --- | --- | --- | --- |
| FA-01 | [Guiar o primeiro uso e distinguir capacidades por modo](fa-01-primeiro-uso.md) | P0 | Concluída | nenhuma. |
| FA-02 | [Definir e integrar a persistência das operações financeiras](fa-02-persistencia-integracao.md) | P0 | Concluída | nenhuma; antecede escritas das tarefas seguintes. |
| FA-03 | [Completar busca e exportação no modo Go](fa-03-busca-exportacao.md) | P0 | Concluída | nenhuma. |
| FA-04 | [Mostrar cartões, faturas e agenda de compromissos](fa-04-cartoes-agenda.md) | P1 | Concluída | FA-01 e decisão de dados de FA-02. |
| FA-05 | [Corrigir categorias e reaplicar regras pela web](fa-05-categorias-regras.md) | P1 | Concluída | FA-02; FA-03 para cobertura completa no modo Go. |
| FA-06 | [Levar a revisão de gastos para a página inicial](fa-06-revisao-gastos.md) | P1 | Concluída | FA-02; FA-05 melhora a qualidade, mas não bloqueia a primeira versão. |
| FA-07 | [Tornar orçamento e metas utilizáveis no Svelte](fa-07-orcamento-metas.md) | P1 | Concluída | FA-02; FA-05 e FA-04 alimentam classificações e compromissos quando disponíveis. |
| FA-08 | [Criar notificações configuráveis a partir de regras prontas](fa-08-notificacoes.md) | P1 | Concluída | FA-02 e FA-06; lembretes dependem também de FA-04; alertas de metas, de FA-07. |
| FA-09 | [Adicionar perguntas sobre os próprios dados na web](fa-09-perguntas-web.md) | P2 | Concluída | FA-02 e FA-03; pode aproveitar FA-04/FA-07 depois. |
| FA-10 | [Importar extratos com prévia e conciliação](fa-10-importacao-extratos.md) | P2 | Concluída | FA-02, FA-03 e FA-05. |

## Checklist geral

Marcar uma tarefa somente quando o aceite e a validação dela estiverem demonstrados no arquivo individual. Uma etapa parcial concluída não conclui a tarefa inteira.

- [x] [FA-01 — Guiar o primeiro uso e distinguir capacidades por modo](fa-01-primeiro-uso.md)
- [x] [FA-02 — Definir e integrar a persistência das operações financeiras](fa-02-persistencia-integracao.md)
- [x] [FA-03 — Completar busca e exportação no modo Go](fa-03-busca-exportacao.md)
- [x] [FA-04 — Mostrar cartões, faturas e agenda de compromissos](fa-04-cartoes-agenda.md)
- [x] [FA-05 — Corrigir categorias e reaplicar regras pela web](fa-05-categorias-regras.md)
- [x] [FA-06 — Levar a revisão de gastos para a página inicial](fa-06-revisao-gastos.md)
- [x] [FA-07 — Tornar orçamento e metas utilizáveis no Svelte](fa-07-orcamento-metas.md)
- [x] [FA-08 — Criar notificações configuráveis a partir de regras prontas](fa-08-notificacoes.md)
- [x] [FA-09 — Adicionar perguntas sobre os próprios dados na web](fa-09-perguntas-web.md)
- [x] [FA-10 — Importar extratos com prévia e conciliação](fa-10-importacao-extratos.md)

## Ordem recomendada

1. FA-01 e FA-03 podem começar sem FA-02. Em seguida, executar FA-02 por etapas: decisão, prova de integração e preparação/ensaio da migração.
2. Com a integração definida e funcional, executar FA-05 e a entrega A de FA-07 (metas).
3. Entregar FA-04, FA-06 e a entrega B de FA-07 (orçamento).
4. Implementar FA-08 com os tipos de alerta cujas dependências foram entregues.
5. FA-09 e FA-10 executadas conforme autorização explícita para as dez tarefas.

FA-04 pode começar a modelagem após a decisão de dados de FA-02; a integração final depende dos contratos e da fonte estarem disponíveis. FA-05 não bloqueia a primeira revisão de FA-06. FA-04/FA-05 enriquecem FA-07 sem bloquear sua entrega A. Na FA-08, lembretes aguardam FA-04 e alertas de metas aguardam FA-07; resumo semanal pode ser entregue antes desses tipos.

## Protocolo para o agente

1. Ler este índice, o arquivo da tarefa e o contexto relevante do plano. Conferir instruções do repositório e alterações locais existentes.
2. Revalidar as observações no código atual: o diagnóstico é de 21/10/2026. Não tratar a lista de referências como arquitetura imutável.
3. Conferir dependências por evidência no código e nos registros, não apenas por checkbox. Se faltar pré-requisito, registrar exatamente o que impede a etapa. Trabalho independente pode continuar dentro do escopo solicitado.
4. Marcar a tarefa como **Em andamento**, informar responsável e data; atualizar também o índice. Trabalhar em uma tarefa delimitada e registrar alterações de contrato antes de propagar para outras.
5. Marcar cada checkbox somente depois da ação ou verificação correspondente. Registrar resultados reproduzíveis na tabela de evidências. Teste não executado continua pendente; se um item não se aplicar, explicar o motivo e ajustar explicitamente o checklist.
6. Ao interromper ou transferir contexto, atualizar **Retomada e decisões** com último passo, próximo comando/arquivo a inspecionar, bloqueios e decisões. Não deixar apenas “continuar implementação”.
7. Antes de concluir, revisar critérios de aceite, regressões dos modos afetados e validações aplicáveis. Atualizar arquivo, tabela do índice, checklist geral e contador juntos.

**Estados:** Pendente → Em andamento → Em validação → Concluída. Usar Bloqueada quando uma dependência impedir avanço e descrever como desbloquear. Se houver mudança de escopo, registrá-la com justificativa; não apagar silenciosamente um critério difícil.

## Critérios comuns de qualidade

- Preservar as regras de centavos, parcelas, estornos, transferências próprias e pagamentos de fatura; cálculos precisam permanecer consistentes entre telas e relatórios.
- Reutilizar regras e contratos existentes. Não duplicar domínio Go/TypeScript sem a decisão de FA-02.
- Manter dados ausentes, zero real e recurso indisponível distintos; não inventar dados financeiros para preencher a UI.
- Considerar erros, recarga, sincronização repetida e concorrência quando houver escrita; não prometer capacidade que o modo ativo não oferece.
- Nas telas alteradas, verificar mobile, teclado, carregamento e recuperação de erro. Relatar o que foi verificado manualmente.
- Usar dados sintéticos nas validações; preservar credenciais e dados reais. Registros de progresso e testes não devem conter extratos ou segredos.
- Alterações de código usam as verificações adequadas do projeto: em `web/`, `npm run check`, `npm test`, `npm run build`; para backend, testes Go pertinentes e verificações exigidas em [CONTRIBUTING.md](../../CONTRIBUTING.md). Ampliar testes quando risco ou falhas justificarem; não criar testes que apenas repitam a implementação.
- Editar apenas documentação não exige executar a aplicação: verificar estrutura, links e diff é suficiente.

## Como iniciar uma tarefa

Exemplo de instrução para um agente:

> Execute a FA-01 em `docs/tasks/fa-01-primeiro-uso.md`. Leia primeiro `docs/tasks/README.md`, confira as dependências e o código atual, implemente o escopo, registre as evidências e mantenha checklists e retomada atualizados. Não marque a tarefa como concluída enquanto houver critérios de aceite sem validação.

## Segunda etapa — 23/10/2026

Backlog autorizado pelo usuário. FA-12 concluída usando dados e contratos já disponíveis; implementação e validações registradas no arquivo individual. FA-11 exige verificar a fonte de faturas; FA-13 antecede FA-14; FA-15 depende da semântica de faturas e estornos; FA-16 exige plano de conciliação e reversão. FA-17 é operacional.

| ID | Tarefa | Prioridade | Status | Dependências |
| --- | --- | --- | --- | --- |
| FA-11 | [Faturas identificadas e confirmação de quitação](fa-11-faturas-identificadas.md) | P1 | Pendente | FA-04; contrato do provedor validado |
| FA-12 | [Limites mensais por categoria](fa-12-limites-categoria.md) | P1 | Concluída | FA-02, FA-05 e FA-07 |
| FA-13 | [Perguntas livres sobre os dados](fa-13-perguntas-livres.md) | P2 | Pendente | FA-09; calculadores existentes |
| FA-14 | [Alterações financeiras por conversa](fa-14-alteracoes-conversa.md) | P2 | Pendente | FA-13 e APIs de escrita correspondentes |
| FA-15 | [Importação de extratos de cartão](fa-15-extratos-cartao.md) | P2 | Pendente | FA-10 e FA-11; semântica de estornos resolvida |
| FA-16 | [União de contas locais e conectadas](fa-16-uniao-contas.md) | P2 | Pendente | FA-02, FA-05 e FA-10 |
| FA-17 | [Ativação operacional do backend](fa-17-ativacao-backend.md) | P0 | Pendente | FA-02; ambiente de destino identificado; migrações das entregas ativadas |

- [ ] [FA-11 — Faturas identificadas e confirmação de quitação](fa-11-faturas-identificadas.md)
- [x] [FA-12 — Limites mensais por categoria](fa-12-limites-categoria.md)
- [ ] [FA-13 — Perguntas livres sobre os dados](fa-13-perguntas-livres.md)
- [ ] [FA-14 — Alterações financeiras por conversa](fa-14-alteracoes-conversa.md)
- [ ] [FA-15 — Importação de extratos de cartão](fa-15-extratos-cartao.md)
- [ ] [FA-16 — União de contas locais e conectadas](fa-16-uniao-contas.md)
- [ ] [FA-17 — Ativação operacional do backend](fa-17-ativacao-backend.md)
