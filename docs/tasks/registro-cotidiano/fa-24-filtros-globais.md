# FA-24 — Aplicar período e conta de forma coerente

[Rodada](README.md)

- **Prioridade:** P1
- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 04/11/2026
- **Dependências:** consultas de dashboard/transações; FA-18–20 existentes; contratos equivalentes Go e cloud.

## Escopo e contrato a definir

Tornar mês e conta selecionados visíveis e persistentes na URL ao navegar entre visão inicial, Transações e Análise. Primeira versão usa **mês civil**, já suportado pelas APIs, e todas as contas ou uma conta. Intervalos arbitrários e comparação anual ficam fora até que todos os endpoints possuam semântica explícita. Separar lançamentos sem conta de todas as contas; não atribuí-los por aproximação.

Mapear cada indicador antes de implementar: resumo, séries, categorias, concentração, auditoria, comparação, lista e exportação devem declarar o mesmo escopo. Não filtrar só a lista deixando cartões com totais de todas as contas. Saldos são snapshots e não podem ser apresentados como saldo histórico do mês selecionado. Orçamento/metas globais permanecem identificados como globais onde não existe dimensão conta.

Go deve receber filtros nas APIs agregadas, com validação central e mesmo recorte das transações. Cloud aplica filtros sobre dados normalizados sem reimplementar regras financeiras. Comparação de períodos equivalentes conserva a mesma conta nos dois meses e a distinção de dados ausentes. Estado de URL permite link direto, voltar/avançar e recarga; troca rápida de filtros não deve exibir resposta atrasada como atual.

## Aceite e testes

- [ ] Registrar matriz indicador → filtros suportados → fonte; fechar contrato de consulta e semântica de conta ausente.
- [ ] URL preserva mês/conta entre telas, exportação e reload; parâmetros inválidos têm fallback explícito ou erro controlado.
- [ ] Dois bancos com valores sintéticos diferentes produzem os mesmos totais na lista, cartões e análise sob o mesmo filtro.
- [ ] Comparação, concentração e auditoria usam exatamente o recorte ativo; mês anterior usa a mesma conta.
- [ ] Sem movimentos não se confunde com fonte indisponível; lançamento sem conta não desaparece da opção todas.
- [ ] Snapshot de saldo e indicadores globais têm abrangência identificada, sem falsa precisão histórica.
- [ ] Troca rápida, falha parcial, navegação do browser, teclado, 320 px e privacidade são verificados.
- [ ] Executar testes de contratos e regressões Go/cloud e checks Go/web pertinentes.

## Evidências e retomada

Nenhuma implementação. Próximo passo: mapear `dashboard-page.ts`, `finance-data.ts`, endpoints summary/timeseries/breakdown e filtros locais de Transações. Não liberar seleção global antes de garantir consistência dos agregados.
