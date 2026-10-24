# FA-17 — Ativação operacional do backend

[Índice e protocolo](README.md)

**Prioridade:** P0 · **Dependências:** FA-02; ambiente de destino identificado; migrações das entregas ativadas

- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 23/10/2026

## Objetivo e critérios de aceite

- [ ] Identificar hospedagem Go/PostgreSQL e configuração do web; documentar responsabilidade operacional.
- [ ] Conferir backup e ensaiar recuperação em ambiente isolado.
- [ ] Ensaiar migrações 020–023 e conferir versão efetivamente instalada antes de aplicar as pendentes.
- [ ] Configurar acesso HTTPS autenticado, sessão e conexão do web ao backend no ambiente autorizado.
- [ ] Verificar saúde, leitura/escrita, agendadores, notificações e rollback; registrar evidências sem segredos.

## Validação e entrega

- [ ] Conferir contratos e modos afetados no código atual.
- [ ] Implementar e validar com dados sintéticos; registrar comandos e resultados abaixo.
- [ ] Verificar erros, recuperação, recarga e concorrência quando aplicável.
- [ ] Revisar diff e documentação; manter índice e checklists coerentes.

## Evidências

Nenhuma implementação concluída nesta tarefa ainda.

## Retomada e decisões

Inspecionar documentação de implantação e identificar o destino real. A Vercel publica somente web; testes locais não comprovam ativação do backend. Não usar banco real nos testes de desenvolvimento.

Publicação segue o fluxo de desenvolvimento do repositório. Dependência não confirmada não é critério concluído.
