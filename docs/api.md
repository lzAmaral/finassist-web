# API do dashboard

O app expõe uma API JSON sob `/api`, com leituras do painel e escritas autenticadas de lançamentos, classificação, orçamento, importação e preferências. A senha é a definida no setup (hash argon2id no banco) ou, sem ela, a `DASHBOARD_PASSWORD` (mínimo de 12 caracteres).

- **Setup pendente:** enquanto o app não está configurado (sem senha ou sem canal, ou com `SETUP_REOPEN`), só `/api/setup/*` atende; o resto de `/api`, inclusive o login, responde `409 {"error": "configuração inicial pendente", "setup": "required"}` e o front leva para `/setup`. Rotas na seção *Setup* abaixo.

- **Autenticação:** `POST /api/login` com `{"password": "..."}` (`Content-Type: application/json`). Sem segundo fator, devolve direto o cookie de sessão `HttpOnly`, `SameSite=Strict` (e `Secure` atrás de HTTPS) válido por 7 dias. Reiniciar o app encerra as sessões. Todas as outras rotas respondem `401` sem sessão. O login é limitado a 5 tentativas por minuto por IP.
- **Segundo fator** (`DASHBOARD_2FA=auto`, o padrão, com um canal configurado, no ar ou não): a senha certa não abre a sessão. O app manda um código de 6 dígitos ao chat, responde `{"step": "code"}` e prende o desafio ao navegador com o cookie `fa_challenge` (5 min). `POST /api/login/code` com `{"code": "..."}` confere e devolve o cookie de sessão. O código vale 5 minutos e uma vez só; 3 erros matam o desafio (e avisam no chat); pedir outro (repetir o `POST /api/login`) exige 1 minuto de intervalo, com teto de 10 códigos por hora somando login e confirmações. Se o envio ao chat falhar (inclusive com o canal configurado mas fora do ar), a resposta é `503` e ninguém entra; o app tenta ligar o canal de novo em segundo plano. Cada login concluído avisa no chat. `GET /api/me` devolve `secondFactor` (ativo ou não). Detalhes e motivos na [ADR 0007](decisoes/0007-segundo-fator-no-chat.md).
- **Proteção contra CSRF:** o login e o logout exigem JSON e recusam requisições cujo `Origin` não seja o próprio host, além do `SameSite=Strict`.
- **Rotas** (`month` e `from`/`to` no formato `AAAA-MM`; a janela de `from`/`to` vai de 1 a 60 meses, padrão: últimos 12):

| Rota | Conteúdo |
| --- | --- |
| `POST /api/login`, `POST /api/login/code`, `POST /api/logout`, `GET /api/me` | sessão |
| `GET /api/summary?month=` | totais do mês e do mês anterior (receitas, despesas, aplicado, resgatado) e o saldo das contas correntes (`bankBalance`, `null` sem Open Finance) |
| `GET /api/timeseries?from=&to=` | os mesmos totais, mês a mês |
| `GET /api/breakdown?month=&by=category\|payment_method\|account` | despesas do mês agrupadas |
| `GET /api/investments?from=&to=` | aplicado, resgatado e **líquido acumulado desde o primeiro lançamento** |
| `GET /api/transactions?month=&kind=&category=&payment_method=&account=&q=&page=&limit=` | lista paginada (padrão 50, máx. 100), manual e Open Finance |
| `POST /api/transactions/manual` | despesa única paga em conta BANK, com idempotência persistente por `requestId` (migration `024`) |
| `GET /api/accounts` | contas e cartões, com saldo e limite |
| `GET /api/balances` | painel: total em conta, bancos, contas e cartões (saldo devedor, limite, vencimento) |
| `GET /api/institutions/{id}/logo` | logo do banco em cache |
| `POST /api/sync` | sincroniza o Open Finance agora (JSON, mesma origem; 409 se já houver uma em andamento) |
| `GET /api/budget?month=` | despesas do mês e dos 11 anteriores por classe (fixas, parceladas, variáveis) e as contas do mês |
| `GET /api/projection?months=` | base da projeção: premissas (renda, fixas, variáveis) e parcelas já conhecidas por mês |
| `PUT /api/expense-rules` | corrige a classe de uma conta (`FIXED`, `VARIABLE` ou `AUTO`); só JSON na mesma origem |
| `GET /api/review?month=` | revisão do mês: matriz categoria × 6 meses e sugestões de corte (aumentos, fixas, gasto formiga, duplicatas, contas novas) com a economia em R$/mês e R$/ano |
| `PUT /api/review-dismissals` | dispensa (ou restaura) uma sugestão da revisão; só JSON na mesma origem |
| `GET /api/categorize` | contas com despesa em "Outros" (da maior para a menor), as categorias atribuíveis e a prévia do que a IA receberia |
| `PUT /api/categorize/rules` | classifica uma conta (ou mantém em Outros): reclassifica as despesas antigas e vale nas próximas sincronizações; só JSON na mesma origem |
| `POST /api/categorize/suggest` | pede à IA categorias para as contas de comércio e serviços da prévia (nunca Pix); não grava nada. Mesmas travas do Coach |
| `GET /api/savings` | economia realizada: as contas que você marcou como canceladas, conferidas mês a mês (cobrança sumiu, voltou ou aguardando), com o total acumulado e o ritmo por mês e por ano |
| `PUT /api/savings/decisions` | marca (ou desfaz) "cancelei" numa sugestão fixa ou de gasto formiga; só JSON na mesma origem |
| `GET /api/goals` | metas com o andamento calculado na hora: patrimônio (contas correntes + investimentos), projeção e gastos por categoria |
| `POST /api/goals`, `DELETE /api/goals/{id}` | cria (juntar valor até uma data, reduzir uma categoria, reserva de N meses; máx. 20) ou apaga uma meta; só JSON na mesma origem |
| `GET /api/coach/preview?month=` | o que o Coach enviaria ao Gemini (mesmo JSON, com hash), sem enviar nada |
| `POST /api/coach/analyze` | envia o que a prévia mostrou (o hash precisa bater) e devolve a análise da IA validada; só JSON na mesma origem, 3/min por IP, uma por vez |
| `GET /api/coach/analyses?month=` | análises guardadas do mês, com as respostas que você deu |
| `PUT /api/coach/analyses/{id}/answers`, `DELETE /api/coach/analyses/{id}` | grava (ou apaga, se vazia) a resposta a uma pergunta da IA; apaga a análise. Só JSON na mesma origem |
| `GET /api/portfolio` | posições de investimento (saldo real do Open Finance), total e total por tipo |
| `GET /api/portfolio/history?from=&to=` | saldo total ao fim de cada mês (existe a partir da primeira sincronização) |

- **Segurança:** a porta `3000` do app é publicada só em `127.0.0.1`. Para acessar de outra máquina, ponha um proxy com **HTTPS** na frente (sem HTTPS a senha e o cookie trafegam em claro) e repasse `X-Real-IP` e `X-Forwarded-Proto`, usados pelo rate limit e pelo atributo `Secure` do cookie; esses cabeçalhos só são aceitos de IPs da rede privada.

### Lançamento manual de despesa (migration `024`)

`POST /api/transactions/manual` exige sessão, `Content-Type: application/json` e a mesma origem das demais escritas. O corpo deve conter um único objeto, sem campos desconhecidos:

```json
{
  "requestId": "c6a172aa-ed53-4c84-9068-2a2205e823fd",
  "amountCents": 12345,
  "description": "Compra sintética",
  "date": "2026-11-04",
  "accountId": "e9c256ea-7bc6-4ffb-8e99-289cfb5f81bd",
  "category": "MARKET",
  "paymentMethod": "PIX"
}
```

`requestId` e `accountId` são UUIDs não nulos. `amountCents` é inteiro entre 1 e 999999999999, sem fração de centavo. A descrição tem 1–200 caracteres depois de remover espaços nas pontas. A data civil deve ser válida, no formato AAAA-MM-DD, desde 2000-01-01 até hoje em `America/Sao_Paulo`. O limite inferior acompanha o calendário suportado pela web. A conta precisa existir e ser `BANK`, incluindo contas locais da importação de extrato; `CREDIT` é recusada. Categorias aceitas: FOOD, MARKET, TRANSPORT, HEALTH, ENTERTAINMENT, SHOPPING, HOUSING, BILLS, EDUCATION, PEOPLE e OTHER. Meios aceitos: PIX, DEBIT_CARD, CASH e OTHER.

A primeira gravação retorna **201**; uma repetição idêntica retorna **200**, com os mesmos IDs e `replayed: true`:

```json
{
  "id": "UUID do pagamento listado em GET /api/transactions",
  "purchaseId": "UUID da compra",
  "requestId": "UUID enviado",
  "date": "2026-11-04",
  "amountCents": 12345,
  "replayed": false
}
```

O servidor normaliza a descrição e a representação dos UUIDs antes de calcular o hash canônico. Chave, hash, recibo, compra e pagamento são gravados na mesma transação PostgreSQL; retentativas e concorrência sobrevivem à reabertura da conexão e ao reinício do processo. A chave vale para a instalação inteira. A mesma chave com outro conteúdo normalizado retorna **409**. A UI precisa manter chave e conteúdo quando a resposta for incerta e reenviar o mesmo objeto para recuperar a confirmação.

A compra é sempre `EXPENSE`/`SINGLE`; o pagamento é `PAID`, vinculado à conta e com `due_date` igual ao dia escolhido. `created_at` permanece a auditoria da gravação. A categoria é registrada como escolha manual por pagamento e prevalece sobre regras automáticas, inclusive após sincronização. O saldo informado da conta permanece inalterado. Não aceita receitas, transferências, parcelas, recorrências ou cartão de crédito.

Entrada ou conta inválida retorna **400**; sessão ausente, **401**; origem ou tipo de conteúdo recusado, **403**; modo sem writer Go persistente, **503**. Falhas inesperadas retornam o erro genérico da API, sem detalhes internos.

**Conciliação tem limites:** se o manual for confirmado primeiro, a sincronização pode vincular um lançamento elegível da mesma conta, tipo e valor em até três dias, preservando o dia financeiro e a categoria manual. `SaveExternal` revalida sob a mesma trava de conta, cobrindo o intervalo entre consulta e gravação. Se o externo já tiver sido gravado antes do manual, a entrada intencional cria outro pagamento: não se fundem fatos financeiros nem se reescreve um externo por coincidência de valor/data. Essa ordem pode produzir duplicata; a heurística também não prova identidade entre duas despesas reais parecidas. Não há garantia de conciliação completa.

### Setup (exige a migration `019`; concluído, todas respondem `404`)

Abertas só enquanto o app não está configurado. Os passos usam uma sessão própria, `fa_setup` (`HttpOnly`, `SameSite=Strict`, `Path=/api/setup`, 1 hora, renovada a cada passo), aberta pelo token; ela não dá acesso a nenhuma outra rota. Escritas exigem JSON e mesma origem.

| Rota | Conteúdo |
| --- | --- |
| `GET /api/setup/status` | sem sessão de setup: `open`, `reopen`, os mínimos e, se o setup não pode começar, `problem`/`problemKind` (`no-token`, `short-token`, `no-key`, `database`). Com sessão: `password` (`draft`, `fromEnv`, `current`), `channel` (`configured`, `canReplace`) e `telegram` (`bot`, `candidate` com nome e @, `accepted`) |
| `POST /api/setup/token` | `{"token"}`: confere o `SETUP_TOKEN` em tempo constante e abre a sessão de setup. 5 tentativas por minuto por IP (certas ou erradas; a 6ª é `429`) |
| `POST /api/setup/password` | `{"password"}` (mínimo de 12): guarda o hash argon2id no rascunho; só vale para entrar ao concluir |
| `POST /api/setup/telegram/bot` | `{"token"}`: confere com `getMe` e guarda o token cifrado no rascunho; a espera do `/start` começa depois da última mensagem que o bot já tinha. Trocar de bot descarta quem tinha mandado `/start`. `400` token inválido, `409` outro programa lendo o bot (webhook), `502` Telegram fora |
| `POST /api/setup/telegram/poll` | olha, sem esperar, se chegou a primeira mensagem privada (grupos são ignorados); a tela chama a cada 2 s, por até 5 min |
| `POST /api/setup/telegram/reject` | "não sou eu": descarta quem mandou (e o código, se já foi) e continua esperando |
| `POST /api/setup/telegram/accept` | "sim, sou eu": manda o código de 6 dígitos a esse chat (regras do OTP: 5 min, 3 tentativas, 1 min entre envios, teto por hora). Também reenvia |
| `POST /api/setup/telegram/confirm` | `{"code"}`: confere e conclui numa transação (canal, senha e "concluído"), liga o canal sem reiniciar e devolve o cookie de sessão do dashboard. O canal vem do rascunho confirmado, nunca da requisição; duas conclusões ao mesmo tempo ligam um bot só |
| `POST /api/setup/keep` | conclui mantendo o canal que já está configurado (no `.env`, ou o de antes ao reabrir) |

Cada passo vai para o histórico de alterações das Configurações (ação `setup`, sem valores).

### Configurações (exigem a migration `016`/`017`)

| Rota | Conteúdo |
| --- | --- |
| `GET /api/settings` | configurações do canal ativo, com a origem do valor (salvo, ambiente ou padrão); segredos nunca voltam, só "configurado". `secondFactor` diz como se confirma o que é sensível |
| `POST /api/settings/confirm` | manda ao chat o código que confirma a próxima alteração sensível desta sessão (`409` sem segundo fator) |
| `PUT /api/settings` | salva um lote (tudo ou nada); mudar o que é sensível exige `code` (o código de `/api/settings/confirm`, uso único) ou, sem segundo fator, `password` (a senha do dashboard). Ao mudar `OWN_NAMES`, a resposta traz os Pix/TED antigos parecidos |
| `POST /api/settings/reset/{key}` | volta ao valor do ambiente/padrão (sensíveis exigem `code` ou `password`, como acima) |
| `GET /api/settings/audit` | últimas alterações (sem valores) |
| `POST /api/settings/own-transfers/apply` | cancela as transferências entre contas suas encontradas |
| `POST /api/settings/test/{pluggy\|gemini\|telegram}` | testa a conexão com as credenciais salvas |
| `POST /api/restart` | pede ao processo que reinicie (o Docker o sobe de novo) |



### Limites mensais por categoria (FA-12)

Requer sessão Go e migração `023`. As escritas exigem JSON e mesma origem.

- `GET /api/budget-limits?month=YYYY-MM`: retorna `month` e `items`, com categoria/rótulo, `limitCents` (null = sem limite), `version`, `paidCents`, `pendingCents`, `spentCents`, `count`, `remainingCents`, `usagePercent` e `status`.
- `PUT /api/budget-limits/{category}?month=YYYY-MM`: corpo `{ "limitCents": 50000, "version": 0 }`. Centavos inteiros entre zero e 100000000000. A versão é aquela retornada pela leitura; zero só cria o primeiro registro.
- `DELETE /api/budget-limits/{category}?month=YYYY-MM`: corpo `{ "version": 1 }`. Remove o limite ativo, preservando a versão contra edições antigas. Releia após cada escrita.

Conflito retorna 409, entrada inválida 400, capacidade indisponível 503. Zero é limite explícito; `null` não é permitido no PUT. A exclusão não apaga despesas. Não há propagação automática entre meses. Percentual é null para limite zero ou ausente. Estados: `no-limit`, `no-records`, `within-limit`, `at-limit`, `exceeded`.

Os totais usam a categoria efetiva de cada pagamento e a mesma competência do orçamento: vencimento, referência e data de criação, nessa ordem. Incluem despesas pagas e pendentes; excluem receitas, transferências e cancelamentos. Os valores observados não comprovam cobertura completa do mês; a UI explicita essa limitação.
