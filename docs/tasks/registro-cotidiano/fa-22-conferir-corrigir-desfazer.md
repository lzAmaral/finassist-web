# FA-22 — Conferir, corrigir e desfazer registros

[Rodada](README.md) · [FA-14 — alterações por conversa](../fa-14-alteracoes-conversa.md)

- **Prioridade:** P1
- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 04/11/2026
- **Dependências:** FA-21; APIs e regras de categoria da FA-05; FA-14 somente para exposição conversacional.

## Escopo e contrato a definir

Dar acesso ao registro efetivamente salvo e permitir correções explícitas no lançamento manual. Primeira operação: editar descrição, data, conta BANK, valor ou categoria de uma despesa SINGLE criada pela FA-21 e ainda não conciliada. Reutilizar correção de categoria existente; não criar outro motor de regras. Escolher a representação de versão e histórico antes da implementação, com testes de duas abas. Identificação sempre pelo paymentId/ID persistido, nunca somente descrição ou posição na lista.

Antes de confirmar, exibir antes/depois, conta, data e efeito nos totais; correção de data pode mover o lançamento entre meses. Desfazer criação significa cancelamento rastreável, não apagar compra/pagamento. Não cancelar automaticamente registro externo ou já conciliado: retornar conflito claro e preservar o vínculo externo. Reversão de correção exige versão atual compatível; nenhuma reversão deve sobrescrever modificação posterior.

O contrato compartilhado com FA-14 contém identificação, versão esperada, prévia, confirmação explícita, idempotência e resultado auditável. Esta tarefa entrega interação direta pela web; FA-14 acrescenta interpretação conversacional quando FA-13 existir. O modelo de linguagem não ganha escrita direta no banco. Cloud conserva consulta.

## Aceite e testes

- [ ] Inspecionar FA-05, FA-14, cancelamento e conciliação atuais; registrar operações permitidas e contrato versionado antes de implementar.
- [ ] Abrir o lançamento salvo pelo ID, conferir dados reais e distinguir manual de conciliado/externo.
- [ ] Editar dados elegíveis somente após confirmação; validar centavos, conta, categoria e data no servidor.
- [ ] Repetição da mesma ação não duplica efeitos; duas abas não sobrescrevem alterações sem conflito.
- [ ] Desfazer criação/correção conserva histórico e recalcula relatórios; não remove referências de sincronização/importação.
- [ ] Cancelar a interação não escreve; sessão expirada, item removido, versão divergente e referência errada têm recuperação segura.
- [ ] Testar PostgreSQL descartável com criação → edição → releitura → reversão, incluindo mudança de mês e conciliação interveniente.
- [ ] Verificar teclado, 320 px, privacidade, erro/recarga e regressão de categorias existentes; executar checks Go/web pertinentes.

## Evidências e retomada

Nenhuma implementação nesta rodada. Próximo passo: ler `category_review_api.go`, persistência de pagamentos e FA-14; propor contrato de versão e reversão. O contrato final deve servir também à conversa futura. Não concluir FA-14 por entregar esta interface direta.
