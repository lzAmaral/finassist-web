# FA-19 — Conferir concentração de despesas com evidências

[Índice e protocolo](README.md) · [Pesquisa e decisão de escopo](../pesquisa-controle-gastos-2026-11.md)

**Prioridade:** P1 · **Esforço:** pequeno/médio · **Dependências:** Dashboard/Transaction existentes; integração pelo coordenador

- **Status:** Concluída
- **Responsável:** implementação por GPT-6.1 Sol (high); escopo Astra; integração coordenador
- **Última atualização:** 04/11/2026

## Objetivo e limite

Mostrar onde se concentram as compras confirmadas do mês, agrupadas por descrição exatamente igual e conta, com acesso aos registros de origem. Não identificar estabelecimento, assinatura, recorrência, duplicidade ou oportunidades automáticas de cancelamento. Esses casos exigem evidências e domínio que já pertencem à revisão Go.

## Ownership e contrato

Editar somente `web/src/lib/spending-concentration.ts`, `web/src/lib/components/SpendingConcentration.svelte`, `web/tests/spending-concentration.test.mjs` e este documento. Props do componente: `{dashboard: Dashboard; hidden?: boolean}`. Sem fetch, sem persistência. Coordenador insere o componente em `analise` e atualiza índice. Não editar componentes compartilhados, rotas, `transactions.ts`, `finance.ts` ou helpers das demais tarefas.

## Regras precisas

1. Exigir modo live, mês válido e lista completa (`total===items.length`, IDs únicos). Lista parcial ou conteúdo inválido gera indisponibilidade explícita. Filtrar mês selecionado e despesas confirmadas `EXPENSE` com `POSTED|PAID`. Não reinterpretar fatura, transferência, moeda ou parcelas.
2. Agrupar por tupla sem colisão `[transactionAccount(t), t.description]`, reutilizando `transactionAccount` existente. Descrição permanece exata: não remover números, parcelas, acentos, palavras, maiúsculas, sufixos ou pontuação. Contas distintas nunca se fundem por nome se possuem IDs diferentes. Ausência de conta segue fallback existente e rótulo Manual/conta disponível.
3. Em centavos: `purchases=sum(amount>0)`, `refunds=abs(sum(amount<0))`, `net=purchases-refunds`. Manter quantidade de compras e de estornos separadas. Incluir grupos somente com estornos: não escondê-los por saldo negativo. Zero não vira compra nem estorno, mas o registro pode permanecer na evidência.
4. Ordenar por compras brutas decrescentes, depois descrição e chave de conta para desempate determinístico. Participação é `purchases/totalPurchases*100` quando totalPurchases>0; estornos não alteram o denominador nem criam percentuais negativos ou maiores que 100. Rotular “das compras confirmadas, antes dos estornos”. Sem compras: percentual indisponível.
5. Mostrar inicialmente cinco grupos e um controle “Ver todos/Mostrar menos”, sem truncar silenciosamente resultados. Cada grupo expande evidências com data, descrição, conta, valor e indicação de estorno. A soma visível de compras menos estornos explica o líquido. Paginar evidências em 20 itens se necessário, sem perder acesso a nenhuma, com ordenação data desc/ID estável.
6. Texto identifica “Descrição no extrato”, nunca estabelecimento reconhecido. Mostrar “Descrições diferentes podem corresponder ao mesmo fornecedor; este agrupamento não identifica assinaturas”. Não projetar valor anual nem prometer economia.

## Critérios de aceite

- [x] Compras, estornos, líquido e participação possuem bases inequívocas e evidências acessíveis.
- [x] Descrições semelhantes e contas diferentes não são fundidas; nomes longos quebram linha.
- [x] Mês vazio, só pendências, só estornos e lista incompleta têm estados corretos.
- [x] Transferências, renda e pendentes não entram nos grupos; Go/cloud suportados.
- [x] `hidden` mascara montantes e percentuais e oculta barras proporcionais, sem vazamento por tooltip/ARIA.
- [x] Botões de expandir têm `aria-expanded`, teclado funcional e foco preservado; 320 px sem overflow horizontal da página.
- [x] Trocar mês reinicia expansão/paginação; retornar a um mês não conserva seleção inválida.

## Testes e evidências

Testes mínimos: centavos; descrição exata repetida; mesma descrição em contas com IDs distintos e mesmo nome; variação de caixa/acentos/parcela não agrupada; compra100/estorno20; estorno com descrição distinta; grupo somente estorno; base sem compras; quantidade zero; renda/pending/transfer excluídos; PAID e POSTED; limite de cinco grupos; ordenação determinística; lista parcial e IDs duplicados.

| Verificação | Comando/evidência | Resultado |
| --- | --- | --- |
| Unitários | `cd web && node --experimental-strip-types --test tests/spending-concentration.test.mjs` | 19 testes passaram em 04/11/2026; somente dados sintéticos |
| Compilação isolada | `svelte/compiler` com `generate: 'server'` no componente | Sem avisos em 04/11/2026 |
| Svelte | `cd web && npm run check` | 0 erros e 0 avisos em 04/11/2026; repetir na integração final |
| Regressão e build | `npm test`, `npm run build` (coordenador) | Aprovado na integração: 122 testes web e build Vercel |
| UI integrada | 320 px, teclado, privacidade, mais de cinco grupos e mais de 20 evidências | Aprovado em 04/11/2026; ver relatório integrado |

## Retomada e decisões

Implementação entregue em `spending-concentration.ts`, `SpendingConcentration.svelte` e `spending-concentration.test.mjs`; sem fetch ou persistência. O coordenador pode importar o componente com props `{dashboard, hidden}` em Análise. Não foram editados loader, rotas, índice ou arquivos de outras tarefas.

O helper exige lista completa e IDs únicos; valida conteúdo de toda a lista antes de selecionar mês/despesas confirmadas. Valores seguem a conversão existente por `Math.round(amount * 100)` e acumulam em centavos seguros; estouro numérico torna a base indisponível. A tupla usa `JSON.stringify([transactionAccount(t), t.description])`; não reutiliza normalização de `expenseKey` do Go. Ordenação de descrição/conta/ID usa comparação estável de strings. Um nome de conta disponível prevalece sobre o fallback por ID; divergências de nomes são resolvidas de modo determinístico sem fundir IDs diferentes.

O componente mostra cinco grupos inicialmente, permite ver todos e acessar todas as evidências em páginas de 20. Compras, estornos e líquido aparecem separadamente; zero permanece na evidência e fora das duas contagens. Participação considera apenas compras positivas e fica indisponível sem essa base. Expansão e paginação reiniciam na troca de mês. Botões nativos preservam identidade na expansão, têm `aria-expanded`/`aria-controls`, e nomes longos recebem quebra de linha. No modo privado, montantes e percentuais são substituídos por máscaras e as barras deixam de ser renderizadas; não há valores em tooltips ou rótulos ARIA. Essas garantias foram inspecionadas no código e verificadas no navegador durante a integração.

Integração concluída pelo coordenador em 04/11/2026, com check sem erros/avisos, 122 testes web, build Vercel e validação Chrome em 1440/768/390/320 px. Expansão/paginação, privacidade, teclado, troca de mês e estados Go/cloud verificados com dados sintéticos. Veja [evidências e limites](validacao-controle-gastos-2026-11.md). Sem migração ou publicação em produção nesta rodada.
