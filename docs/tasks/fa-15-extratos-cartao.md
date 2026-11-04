# FA-15 — Importação de extratos de cartão

[Índice e protocolo](README.md)

**Prioridade:** P2 · **Dependências:** FA-10 e FA-11; semântica de estornos resolvida

- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 23/10/2026

## Objetivo e critérios de aceite

- [ ] Definir formatos e detectar compras, parcelas, estornos, encargos e quitação.
- [ ] Resolver representação de valores negativos e competência; não converter estorno em renda.
- [ ] Vincular lançamentos à conta e fatura corretas com prévia editável e validação.
- [ ] Reutilizar importação transacional e deduplicação, incluindo arquivos repetidos e sobreposição com Open Finance.
- [ ] Testar faturas parciais, compras parceladas, estorno parcial, pagamento e reimportação.

## Validação e entrega

- [ ] Conferir contratos e modos afetados no código atual.
- [ ] Implementar e validar com dados sintéticos; registrar comandos e resultados abaixo.
- [ ] Verificar erros, recuperação, recarga e concorrência quando aplicável.
- [ ] Revisar diff e documentação; manter índice e checklists coerentes.

## Evidências

Nenhuma implementação concluída nesta tarefa ainda.

## Retomada e decisões

Inspecionar importador FA-10 e restrições de valor em Purchase/Payment antes de aceitar arquivos de cartão.

Publicação segue o fluxo de desenvolvimento do repositório. Dependência não confirmada não é critério concluído.
