# FA-23 — Registrar por áudio no Telegram

[Rodada](README.md)

- **Prioridade:** P2
- **Status:** Pendente
- **Responsável:** a definir
- **Última atualização:** 04/11/2026
- **Dependências:** bot textual Go existente; contrato de confirmação e idempotência; FA-22/FA-14 para correção conversacional quando disponível; FA-17 para operação remota.

## Escopo e contrato a definir

Acrescentar mensagem de voz ao bot existente: receber arquivo autorizado, transcrever, apresentar dados estruturados para conferência, confirmar e registrar pelo domínio Go. Texto já funciona por `AnalyzeExpense.ExecuteText`; esta tarefa não o reimplementa. A transcrição é entrada não confiável e pode omitir valor, conta ou data: pedir esclarecimento sem gravar dados adivinhados.

Antes de implementar, inspecionar Telegram adapter/webhook, pipeline textual e provedores já configurados. Definir formatos, duração/tamanho máximos e fornecedor de transcrição com configuração própria; não introduzir assinatura paga ou enviar áudios reais nesta preparação. Fixar retenção: arquivo temporário descartado após processamento, sem áudio/transcrição financeira em logs. Reutilizar identidade autorizada e limites do canal. Atualização Telegram repetida deve usar identidade persistente, não dedupe apenas em memória.

Confirmação no chat lista conta, dia, categoria, valor e natureza do lançamento; sucesso só após commit, com ID consultável no painel. Silêncio ou timeout não equivalem a aprovação. Reutilizar contrato de escrita onde a semântica coincidir; casos fora da primeira despesa simples precisam de escopo próprio antes de serem aceitos.

## Aceite e testes

- [ ] Documentar fluxo existente, contratos do provedor e custo/configuração sem credenciais reais.
- [ ] Áudio sintético produz prévia; confirmar grava uma vez e cancelar não grava.
- [ ] Baixa confiança, ausência de valor/data/conta e áudio inaudível pedem esclarecimento; não criam registro parcial.
- [ ] Reenvio do mesmo update, retentativa do webhook e confirmação repetida não duplicam lançamentos.
- [ ] Origem/chat não autorizado, arquivo excessivo/formato incompatível, download/transcrição indisponível e timeout têm resposta segura.
- [ ] Recibo no chat corresponde ao lançamento relido no painel; erro na mensagem de sucesso não causa segunda gravação.
- [ ] Arquivos temporários são descartados e logs não contêm dados sensíveis.
- [ ] Bot de texto e comandos existentes mantêm comportamento; testes usam áudio/serviço sintéticos e checks Go adequados.

## Evidências e retomada

Nenhuma implementação ou teste do Money Flow. A promessa comercial motiva investigar este fluxo, sem provar precisão. Próximo passo: mapear adapter Telegram e confirmação atual, depois fixar contrato de transcrição e idempotência antes de escolher implementação.
