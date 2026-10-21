# Notificações no Go

O modo Go mantém preferências e histórico no PostgreSQL (migration `021_notifications.sql`). O modo cloud conserva consulta/sincronização e não executa este planejamento. O processo Go inicia o agendador antes de conectar o canal; não depende de navegador, cron Svelte ou chamadas da tela. Sem banco/migration, o bootstrap falha explicitamente. A API informa `schedulerRunning` e `telegramReady`; a interface mostra a ausência de canal sem prometer entrega.

A cada minuto o serviço consulta preferências atuais. Depois do horário civil escolhido, gera os alertas aplicáveis daquele dia. O resumo é gerado somente no dia da semana escolhido. Reiniciar depois do horário recupera a execução do mesmo dia, sem descarregar semanas anteriores. Mudanças de horário/fuso valem na próxima passagem, em até um minuto. O banco de fusos IANA está embutido no binário Go.

## Regras entregues

- `weekly_digest`: resumo semanal existente, calculado em Go, com despesas/receitas, revisão, economia e metas. A chave é ano/semana ISO. Desativar um alerta individual não remove sua informação do resumo integrado.
- `review`: possíveis duplicatas, aumentos, contas novas e cobranças que retornaram após uma decisão de cancelamento. Respeita dispensas da revisão e usa identidade por regra/chave/mês. Não afirma que uma cobrança seja indevida.
- `goals`: meta de redução com teto superado ou projeção acima do teto; meta de economia cujo aporte não cabe na sobra projetada. Não alerta quando a projeção é desconhecida. Uma identidade por meta/mês.
- `reminders`: compromissos manuais pendentes de hoje/amanhã, com identidade do compromisso e data de vencimento. Recorrências/parcelas estimadas são identificadas. Compras importadas, saldo devedor e datas sem fatura confirmada não viram uma cobrança de fatura presumida.

Os registros gravados preservam a explicação daquele momento. Novos dados podem resolver a condição sem apagar o histórico. Desativar tipos interrompe novos avisos e cancela envios pendentes desses tipos; os avisos já gravados continuam disponíveis para leitura/dispensa. Dispensar um aviso também cancela seu envio ainda pendente. A mesma identidade não reaparece depois da dispensa. A lista devolve os últimos 100 avisos não dispensados; leitura, dispensa, tentativas e falhas permanecem no banco.

## Canal e privacidade

Telegram usa exclusivamente o canal já conectado pelo aplicativo, inclusive quando o setup acaba de ligá-lo. O serviço novo não configura credenciais nem envia pelo WhatsApp. O resumo anterior do WhatsApp continua em seu job exclusivo, desativado se o canal mudar para Telegram. Nunca há dois jobs de resumo enviando pelo Telegram.

Ao iniciar pela primeira vez, dia/hora/fuso e a ativação do Telegram são herdados das configurações legadas; preferências existentes não são sobrescritas no próximo boot. A tela React antiga continua compatível: `GET /api/settings` reflete as preferências oficiais de notificação e `PUT`/reset de `DIGEST_*` grava o mesmo registro para Telegram. Alterar a hora pela tela antiga zera os minutos; a ajuda mostra o horário completo atual. Ativar resumo por essa tela habilita o tipo semanal e o canal Telegram; desativar desliga somente o tipo semanal. Outros tipos e privacidade continuam na central. Lotes que misturam `DIGEST_*` com outras áreas são recusados com 400 antes de gravar; salvar cada grupo separadamente evita escrita parcial entre dois stores. WhatsApp conserva as configurações antigas.

A preferência de ocultar valores mascara os valores monetários na prévia, na leitura de avisos antigos e na entrega. Novos avisos gerados com essa preferência são gravados já mascarados; voltar a mostrar valores não recupera os números removidos daquele registro. A prévia calcula as regras com dados atuais e preferências do formulário, sem gravar aviso, alterar preferências nem enviar mensagens. A preferência visual global também mascara a apresentação da central.

Identidade única impede duplicações no banco. Claims atômicos com `FOR UPDATE SKIP LOCKED` impedem duas instâncias de enviar simultaneamente o mesmo aviso. Uma recusa confirmada da API Telegram permite até três tentativas totais, com esperas de 5 e 10 minutos. Sem canal conectado não há tentativa de rede; os avisos continuam no aplicativo. Desativar Telegram cancela as entregas pendentes, sem reenviá-las ao reativar.

O Telegram não oferece chave de idempotência para `sendMessage`. Timeout, resposta perdida ou processo encerrado durante o envio são ambíguos: ficam `failed` com código `delivery_uncertain`, sem repetição automática. A prioridade é evitar duplicação externa; nesses casos a central permanece disponível. Um claim interrompido é marcado incerto ao passar um minuto quando a entrega volta a ser processada. Erros/logs do job não incluem nomes, valores, texto da notificação nem erro bruto de transporte.

## Contrato HTTP

Todas as rotas exigem sessão Go; escritas exigem JSON e a mesma origem, incluindo pelo proxy Svelte.

| Rota | Contrato |
| --- | --- |
| `GET /api/notifications` | `{preferences, notifications, schedulerRunning, telegramReady}`; conteúdo já mascarado conforme preferência |
| `PUT /api/notifications/preferences` | Objeto completo; valida todos os quatro tipos, hora 0–23, minuto 0–59, dia 0–6 e fuso IANA |
| `POST /api/notifications/preview` | Mesma preferência; responde `{notifications}` sem efeitos |
| `POST /api/notifications/:id/read` | JSON `{}`; leitura persistente/idempotente |
| `POST /api/notifications/:id/dismiss` | JSON `{}`; dispensa persistente/idempotente |

Preferências: `types: {weekly_digest, review, goals, reminders}`, `hour`, `minute`, `weekday` (domingo = 0), `timeZone`, `hideAmounts`, `telegram`. Avisos incluem `id`, `kind`, `title`, `body`, `createdAt`, `readAt`, `dismissedAt`, `deliveryStatus`, `attempts` e `lastError` genérico. Identidades internas não são expostas. Estados de entrega: `in_app`, `pending`, `sending`, `sent`, `retry`, `failed`, `cancelled`. Indisponibilidade é 503, validação 400, ausência 404 e falha de persistência 500; não há sucesso simulado ou fallback cloud.

## Validação sintética

Os testes de `usecase/notifications` usam transporte falso para repetição, horário/fuso, canal desconectado, desativação, limite de tentativas, entrega incerta, privacidade, prévia e execução sem navegador. Testes de API verificam sessão/origem, erros, persistência e compatibilidade das configurações antigas. Testes PostgreSQL criam schemas isolados, aplicam migrations e verificam concorrência de insert/claim, nova conexão, leitura/dispensa, cancelamento e gerador real com Insights, metas, revisão e agenda. Nenhuma mensagem real é enviada.
