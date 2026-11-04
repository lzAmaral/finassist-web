# FA-25 — Planejar despesas anuais e não mensais

[Rodada](README.md)

- **Prioridade:** P2
- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 04/11/2026
- **Dependências:** FA-07 (planejamento/metas), FA-12 (limites) e domínio Go; FA-17 para disponibilização remota.

## Escopo e contrato a definir

Planejar um compromisso não mensal, como despesa anual, com nome, valor previsto, vencimento e valor já reservado informado pelo usuário. Mostrar quanto falta e uma sugestão de reserva mensal até a data. Reserva planejada não é saldo bancário, pagamento, limite mensal ou transferência executada. Não criar lançamentos PAID por passagem de data.

Inspecionar metas RESERVE/SAVE, orçamento e agenda existentes antes de escolher modelo. Reutilizar entidades quando semântica e histórico permitirem; se precisar de nova entidade, registrar por que as existentes não representam o compromisso. Toda persistência e cálculo financeiro ficam no Go; cloud exibe indisponibilidade. A origem desta recomendação é o planejamento de despesas não mensais na pesquisa anterior, não uma funcionalidade testada do Money Flow.

Fechar regras com exemplos em centavos: quando começar a reservar, inclusão/exclusão do mês atual, prazo vencido, compromisso quitado antecipadamente, reserva superior ao objetivo, arredondamento da última parcela e edição do valor/data. Renovação anual deve ser explícita e idempotente; não copiar pagamento ou reserva consumida para o novo ciclo. Integração futura com lançamento real precisa de vínculo identificado, sem deduzir quitação por texto semelhante.

## Aceite e testes

- [ ] Comparar modelo com metas/agenda existentes e registrar contrato de persistência e cálculo antes de implementar.
- [ ] Criar, editar, arquivar e recarregar compromisso com versionamento/conflito; valor reservado não altera saldo nem despesas realizadas.
- [ ] Exemplos sintéticos verificam soma em centavos, meses restantes, virada de ano, fevereiro/ano bissexto, vencimento hoje e prazo vencido.
- [ ] Valor já reservado e total restante são distintos; sem informação não é tratado como saldo real zero.
- [ ] Renovação explícita não duplica ciclos e não carrega quitação antiga; repetição da requisição é idempotente.
- [ ] UI distingue previsto, reservado informado e realizado; não duplica total de orçamento/metas.
- [ ] Verificar recarga, erro de API, concorrência, teclado, 320 px e privacidade; executar checks Go/web pertinentes.

## Evidências e retomada

Nenhuma implementação. Próximo passo: ler domínio planning/goals, BudgetPlanner e CardAgenda; escrever exemplos de cálculo e proposta de reutilização antes de acrescentar tabela ou tela.
