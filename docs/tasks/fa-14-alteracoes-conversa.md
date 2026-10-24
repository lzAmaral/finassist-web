# FA-14 — Alterações financeiras por conversa

[Índice e protocolo](README.md)

**Prioridade:** P2 · **Dependências:** FA-13 e APIs de escrita correspondentes

- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 23/10/2026

## Objetivo e critérios de aceite

- [ ] Delimitar operações e entidades que podem ser alteradas; esclarecer referências ambíguas.
- [ ] Apresentar prévia exata antes da confirmação explícita de cada escrita.
- [ ] Executar pelas APIs autorizadas com proteção de origem, idempotência, versão e registro de alterações.
- [ ] Oferecer desfazer quando tecnicamente reversível; explicar consequências antes da confirmação.
- [ ] Testar cancelamento, repetição, sessão expirada, mudança concorrente e referência a lançamento errado.

## Validação e entrega

- [ ] Conferir contratos e modos afetados no código atual.
- [ ] Implementar e validar com dados sintéticos; registrar comandos e resultados abaixo.
- [ ] Verificar erros, recuperação, recarga e concorrência quando aplicável.
- [ ] Revisar diff e documentação; manter índice e checklists coerentes.

## Evidências

Nenhuma implementação concluída nesta tarefa ainda.

## Retomada e decisões

Após FA-13, escolher uma operação inicial (por exemplo, categoria) e desenhar prévia/confirmação. O modelo não escreve diretamente no banco.

Publicação segue o fluxo de desenvolvimento do repositório. Dependência não confirmada não é critério concluído.
