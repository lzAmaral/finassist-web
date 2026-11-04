# FA-18 — Comparar gastos em períodos equivalentes

[Índice e protocolo](README.md) · [Pesquisa e decisão de escopo](../pesquisa-controle-gastos-2026-11.md)

**Prioridade:** P1 · **Esforço:** médio · **Dependências:** contratos existentes de Dashboard/Transaction; integração do loader pelo coordenador

- **Status:** Concluída
- **Responsável:** implementação por GPT-6.1 Sol (high); escopo Astra; integração coordenador
- **Última atualização:** 04/11/2026

## Objetivo

Substituir a porcentagem que compara mês corrente parcial com mês anterior inteiro por comparação explícita dos lançamentos confirmados disponíveis. Funciona em cloud e Go, sem novos cálculos de planejamento ou persistência.

## Ownership e contrato

O agente edita somente `web/src/lib/spending-comparison.ts`, `web/src/lib/components/SpendingComparison.svelte`, `web/src/lib/components/SpendingAnalysis.svelte`, `web/tests/spending-comparison.test.mjs` e este documento. Não editar rota, loader, `finance.ts`, `analysis.ts`, API ou componentes das demais tarefas. O coordenador atualiza índice e integra.

`SpendingComparison.svelte` recebe:

```ts
{
  dashboard: Dashboard;
  previous: { month: string; transactions: Dashboard['transactions'] } | null;
  referenceDate: string; // AAAA-MM-DD, hoje em America/Sao_Paulo, fornecido pelo servidor
  hidden?: boolean;
}
```

Exportar o tipo `PreviousSpendingPeriod` do helper para o loader reutilizar. `previous=null` significa carga indisponível, nunca mês com zero. Resposta válida `{items:[],total:0}` significa nenhum lançamento disponível; não prova ausência real de gastos. O componente não faz fetch. O helper é puro e recebe a data explicitamente; não lê relógio global. O coordenador carrega mês anterior somente em `analise`, repassa `referenceDate` também no SSR e trata 401 como sessão expirada. Outras falhas preservam dashboard/AI e permitem recarregar a página.

## Regras precisas

1. Verificar `dashboard.mode==='live'`, mês válido, anterior exatamente `shiftMonth(month,-1)` e listas completas (`total===items.length`, IDs únicos). Mês inválido, lista parcial ou data inválida resulta em estado indisponível, sem fallback de zeros. Restringir cada lista ao próprio mês.
2. Usar somente `kind==='EXPENSE'` e `status` em `POSTED|PAID`; somar `Math.round(amount*100)` inteiro e dividir por 100 somente na saída. Valor negativo reduz gasto; transferências, rendas e pendentes não entram. Não reavaliar descrição, moeda, fatura ou parcela, já normalizadas na origem.
3. Mês atual: corte é o dia de `referenceDate`. Em cloud (`source==='pluggy'`), reduzir esse corte à data local de `syncedAt` em America/Sao_Paulo, nunca avançá-lo. `syncedAt` ausente/inválido ou anterior ao início do mês atual deixa a comparação indisponível. Para igualdade de dias, usar `N=min(corte,diasDoMesAnterior)` nos DOIS meses: dia 1 até dia N inclusive. Exemplo: 31/mar vs fevereiro de 28 dias compara 1–28 em ambos, informando datas reais.
4. Mês passado: comparar os dois meses completos e rotular como meses completos, sem afirmar igual duração. Mês futuro: não comparar, mostrando que o período ainda não começou. Nunca incluir lançamentos futuros no corte corrente.
5. `delta=current-previous`. Porcentagem somente se anterior for estritamente positivo: `delta/previous*100`. Anterior zero ou negativo: exibir diferença em reais e “Sem base positiva para percentual”; não usar infinito, 100% artificial ou recomendação de economia.
6. Se uma janela não possui nenhum lançamento de despesa confirmado, mostrar os totais disponíveis e “Sem base de despesas confirmadas para comparar”, sem percentual nem afirmação de queda/economia. Diferenciar lista ausente de lista vazia e de total zero resultante de compras compensadas por estornos. Zero com despesas registradas continua um resultado válido.
7. Exibir ambos os intervalos, ambos os valores, diferença assinada, percentual quando aplicável, data de consulta cloud e a nota: comparação dos lançamentos disponíveis; sincronização não comprova cobertura completa. Não anualizar, projetar fim do mês, classificar como saudável ou alertar estouro de limite.

## Critérios de aceite

- [x] Componente funciona com POSTED cloud e PAID Go, sem serviço novo.
- [x] Comparação parcial usa o mesmo número de dias; calendário lida com fevereiro, ano bissexto e virada de ano.
- [x] Consulta cloud antiga reduz corte; consulta anterior ao mês não produz queda artificial.
- [x] Falha/anterior vazio/futuro/lista parcial possuem mensagens distintas e recuperação por link de recarga com mês preservado.
- [x] Remover o terceiro card “Despesas vs. mês anterior” de `SpendingAnalysis.svelte` e ajustar grade; não alterar `localAnalysis`, `anonymousIndicators` ou Gemini.
- [x] Valores e percentual são mascarados com `hidden`; não vazar por texto auxiliar, tooltip, ARIA ou gráfico.
- [x] Interface legível em 320 px, navegação por teclado e mudança de mês sem resultado anterior persistente.

## Testes e evidências

Testes mínimos: 0,10+0,20; compra100/estorno20; pending excluído; PAID/POSTED; transferências/renda excluídas; dia 4 atual vs dia 4 anterior com compra posterior excluída; 31/mar vs fevereiro; fevereiro bissexto; janeiro/dezembro; sync UTC que cai no dia anterior em São Paulo; sync antes do mês; seleção histórica/futura; base anterior zero/negativa; compras que zeram com estorno; lista vazia, ausente, parcial, mês incorreto e IDs duplicados. Testar dados inválidos sem montar números fictícios.

| Verificação | Comando/evidência | Resultado |
| --- | --- | --- |
| Unitários | `cd web && node --experimental-strip-types --test tests/spending-comparison.test.mjs` | 22/22 passaram; fixtures sintéticas cobrem todos os casos mínimos, calendário gregoriano secular, precisão inteira segura e pureza |
| Compilação isolada | `svelte/compiler.compile` com `generate: 'server'` nos dois componentes alterados | Sem avisos; não substitui check/build ou teste visual integrado |
| Svelte e regressão | `npm run check`, `npm test`, `npm run build` (coordenador) | Aprovado em 04/11/2026; ver relatório integrado |
| UI integrada | 320 px, teclado, privacidade, mês atual/passado/futuro e falha opcional | Aprovado em 04/11/2026; ver relatório integrado |

## Retomada e decisões

Implementação entregue em 04/11/2026 por GPT-6.1 Sol (high), sem commits, deploy, dados reais ou alterações fora do ownership. `compareSpendingPeriods(dashboard, previous, referenceDate)` é puro e exporta `PreviousSpendingPeriod`. Retorna `available`, `empty`, `future` ou `unavailable` com motivo específico; indisponibilidade não inclui valores fictícios. Agrega apenas `Transaction` normalizada, sem reclassificar domínio, e recusa datas, IDs, listas ou valores inválidos. A proteção de inteiros seguros inclui soma e diferença. Datas de lançamentos seguem o contrato normalizado `AAAA-MM-DD`; timestamps de consulta exigem fuso explícito. Consulta ausente no mês histórico aparece como data indisponível e não impede comparar meses completos; mês corrente exige consulta válida e não anterior ao início do mês.

`SpendingComparison.svelte` reage diretamente às props, sem fetch ou estado de resultado persistente. Exibe intervalos, totais, diferença, percentual aplicável, última consulta dos dados das contas e ressalva de cobertura. Valores e percentual usam máscara no texto visível; não há gráfico, tooltip ou atributo ARIA contendo números financeiros. Link de recarga preserva `month`. `SpendingAnalysis.svelte` teve apenas o terceiro card removido e grade ajustada para duas colunas; `localAnalysis`, `anonymousIndicators` e Gemini não foram alterados.

Integração concluída pelo coordenador em 04/11/2026, com check sem erros/avisos, 122 testes web, build Vercel e validação Chrome em 1440/768/390/320 px. Expansão/paginação, privacidade, teclado, troca de mês e estados Go/cloud verificados com dados sintéticos. Veja [evidências e limites](validacao-controle-gastos-2026-11.md). Sem migração ou publicação em produção nesta rodada.
