# FA-13 — Perguntas livres sobre os dados

[Índice e protocolo](README.md)

**Prioridade:** P2 · **Dependências:** FA-09; calculadores existentes

- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 23/10/2026

## Objetivo e critérios de aceite

- [ ] Definir intenções suportadas, períodos e política de esclarecimento de ambiguidades.
- [ ] Traduzir linguagem livre em consulta estruturada validada, sem executar SQL gerado por modelo.
- [ ] Reutilizar cálculos Go, apresentar período, fonte e limites da resposta.
- [ ] Tratar textos externos como dados; explicitar envio de contexto quando houver provedor de IA.
- [ ] Testar perguntas ambíguas, falta de dados, tentativa de instrução no extrato e falha do provedor.

## Validação e entrega

- [ ] Conferir contratos e modos afetados no código atual.
- [ ] Implementar e validar com dados sintéticos; registrar comandos e resultados abaixo.
- [ ] Verificar erros, recuperação, recarga e concorrência quando aplicável.
- [ ] Revisar diff e documentação; manter índice e checklists coerentes.

## Evidências

Nenhuma implementação concluída nesta tarefa ainda.

## Retomada e decisões

Inspecionar perguntas guiadas da FA-09 e definir um conjunto inicial de consultas somente leitura.

Publicação segue o fluxo de desenvolvimento do repositório. Dependência não confirmada não é critério concluído.
