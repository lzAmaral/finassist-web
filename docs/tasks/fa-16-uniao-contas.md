# FA-16 — União de contas locais e conectadas

[Índice e protocolo](README.md)

**Prioridade:** P2 · **Dependências:** FA-02, FA-05 e FA-10

- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 23/10/2026

## Objetivo e critérios de aceite

- [ ] Definir critérios de mesma conta, escopo e identidade da conta sobrevivente.
- [ ] Apresentar prévia de lançamentos duplicados, saldo, regras e recibos de importação afetados.
- [ ] Implementar união transacional com confirmação e controle de concorrência.
- [ ] Preservar IDs externos, classificações e histórico; não somar saldos duplicados.
- [ ] Testar sobreposição parcial, reimportação, sincronização posterior, falha transacional e reversão.

## Validação e entrega

- [ ] Conferir contratos e modos afetados no código atual.
- [ ] Implementar e validar com dados sintéticos; registrar comandos e resultados abaixo.
- [ ] Verificar erros, recuperação, recarga e concorrência quando aplicável.
- [ ] Revisar diff e documentação; manter índice e checklists coerentes.

## Evidências

Nenhuma implementação concluída nesta tarefa ainda.

## Retomada e decisões

Mapear vínculos de accounts, payments e recibos de importação. Definir estratégia de reversão e resolução de conflitos antes de mutações.

Publicação segue o fluxo de desenvolvimento do repositório. Dependência não confirmada não é critério concluído.
