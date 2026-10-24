# FA-11 — Faturas identificadas e confirmação de quitação

[Índice e protocolo](README.md)

**Prioridade:** P1 · **Dependências:** FA-04; contrato do provedor validado

- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 23/10/2026

## Objetivo e critérios de aceite

- [ ] Verificar documentação e respostas sintéticas do provedor: ID da fatura, fechamento, vencimento, total e estado de pagamento.
- [ ] Modelar faturas, compras e pagamentos sem contar quitação como nova despesa; registrar origem e data de atualização.
- [ ] Implementar consulta e detalhe de faturas na API e na página de cartões.
- [ ] Exibir quitação somente quando comprovada pela fonte; dados ausentes permanecem desconhecidos.
- [ ] Testar pagamento parcial, estorno, atraso, múltiplos cartões e sincronização repetida.

## Validação e entrega

- [ ] Conferir contratos e modos afetados no código atual.
- [ ] Implementar e validar com dados sintéticos; registrar comandos e resultados abaixo.
- [ ] Verificar erros, recuperação, recarga e concorrência quando aplicável.
- [ ] Revisar diff e documentação; manter índice e checklists coerentes.

## Evidências

Nenhuma implementação concluída nesta tarefa ainda.

## Retomada e decisões

Inspecionar os contratos de Open Finance e a tela de cartões; registrar quais campos a fonte realmente oferece. Não deduzir quitação a partir de saldo ou vencimento.

Publicação segue o fluxo de desenvolvimento do repositório. Dependência não confirmada não é critério concluído.
