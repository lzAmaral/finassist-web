# FA-21 — Lançar despesa rapidamente pela web

[Rodada e dependências](README.md)

- **Prioridade:** P1
- **Status:** Concluída
- **Responsável:** Sol API/persistência + Sol UI; integração pelo coordenador
- **Última atualização:** 04/11/2026
- **Dependências:** FA-02 implementada; FA-17 somente para uso remoto real, não para desenvolvimento local.

## Entrega

Formulário curto em Transações para despesa única já paga, com valor, descrição, dia, conta BANK, categoria e meio de pagamento. Salvar no ledger Go, confirmar os dados efetivamente persistidos, recarregar consultas e permitir localizar o lançamento no mês correto. Conta local criada pelo fluxo de importação existente também é BANK. Sem conta elegível, explicar a necessidade e apontar o fluxo existente; não inventar conta nem obrigar conexão bancária.

Não entram receitas, transferências, recorrência, parcelas, cartão de crédito, áudio, edição/desfazer ou escrita Blob. A despesa registrada altera a apuração do ledger, **não atualiza o saldo informado da conta**. Sincronização bancária não equivale a cobertura completa; não anunciar conciliação infalível.

## Contrato API fechado para implementação paralela

`POST /api/transactions/manual`, protegido pela sessão e origem existentes, encaminhado pelo proxy Svelte atual. Corpo JSON:

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

Validação no servidor: UUID não nulo; centavos inteiros entre 1 e 999999999999 (limite DECIMAL(12,2)); descrição após trim com 1–200 caracteres; data civil válida AAAA-MM-DD desde 2000-01-01 (faixa navegável do painel), não futura em America/Sao_Paulo; conta existente e BANK; categoria dentre `ExpenseCategories()` (FOOD, MARKET, TRANSPORT, HEALTH, ENTERTAINMENT, SHOPPING, HOUSING, BILLS, EDUCATION, PEOPLE, OTHER); método PIX, DEBIT_CARD, CASH ou OTHER. Não aceitar campos extras que alterem kind, status ou parcelas. UI aplica validação equivalente para feedback, sem substituir o servidor.

Primeira gravação: HTTP 201; replay idêntico: HTTP 200. Resposta em ambos:

```json
{
  "id": "UUID do pagamento, igual ao id em GET transactions",
  "purchaseId": "UUID da compra",
  "requestId": "UUID enviado",
  "date": "2026-11-04",
  "amountCents": 12345,
  "replayed": false
}
```

Replay usa `replayed: true` e os mesmos IDs. Mesmo requestId com conteúdo normalizado divergente: HTTP 409 `{ "error": "mensagem em português" }`. Entrada inválida: 400; sem sessão: 401; origem inválida: 403; writer indisponível: 503. Demais erros seguem o padrão seguro da API. `GET /api/accounts` existente entrega `{id,type,name,last4,...}[]`; a UI filtra BANK e não infere a conta a partir do texto da descrição.

Persistir chave única, payload normalizado (ou hash canônico) e resultado junto com purchase/payment na **mesma transação**. Corridas com a mesma chave produzem um único lançamento; falha parcial não deixa compra órfã ou chave consumida. Não usar memória do processo como autoridade de idempotência. Registrar categoria escolhida de forma que regras automáticas não substituam silenciosamente a escolha explícita. Persistir `account_id`, `due_date`/competência do dia escolhido e `PAID`; `created_at` continua auditoria da gravação. Nunca usar a data de criação como substituta da data financeira.

A chave permanece a mesma em retentativas do mesmo envio, inclusive após resposta perdida e recarga da página. A UI mantém requestId e payload submetido em sessionStorage até confirmação; ao recuperar envio incerto, permite reenviar o mesmo conteúdo. Após erro de rede com resultado incerto, congelar chave e payload: não permitir editar nem descartar silenciosamente a tentativa ao fechar/reabrir o formulário. Resolver por retry idêntico antes de iniciar outro envio. Não gerar uma chave nova automaticamente após timeout. Se armazenamento do navegador falhar, sinalizar a limitação sem afirmar proteção de retomada. Após sucesso, limpar rascunho pendente, exibir comprovante e invalidar consultas; falha na recarga não transforma gravação confirmada em falha nem provoca reenvio automático.

## Ownership

| Pacote | Arquivos exclusivos | Resultado |
| --- | --- | --- |
| Subtarefa A — Sol API/persistência | `backend/**`, `docs/api.md`, README raiz e CHANGELOG (migrations) | Endpoint, caso de uso/porta mínima necessária, persistência, migration 024 ou próximo número livre, testes Go. |
| Subtarefa B — Sol UI | `web/src/lib/manual-entry.ts`, `web/src/lib/components/ManualEntry.svelte`, `web/tests/manual-entry.test.mjs` | Formulário e helper isolados, com transporte testável e nenhum import de server. |
| Coordenador | `web/src/routes/**`, `web/src/lib/server/dashboard-page.ts`, `web/src/lib/dashboard-state.ts`, testes integrados, índices e este documento | Integração, capacidades, invalidate/releitura, validação final. |

Componente `ManualEntry` recebe `{ enabled: boolean; hidden?: boolean; referenceDate: string; onSaved?: (date: string) => void | Promise<void> }`. Busca contas somente quando disponível; `referenceDate` vem do loader já existente. Expõe indisponibilidade no cloud/sem configuração e não tenta gravar nessas modalidades. No Go autenticado, uma falha na leitura agregada não desmonta o componente nem seu comprovante; contas e escrita conservam validação própria. Respeita privacidade nos comprovantes. O coordenador insere na página inicial e em Transações; o callback navega para `/transacoes?month=AAAA-MM` da data confirmada e recarrega os loaders (`goto` com `refreshAll`). Sem conta BANK, apontar `/importar`. Mostrar os campos a confirmar antes do envio e um comprovante após a persistência. A escolha de conta deve ser explícita (não escolher automaticamente a primeira conta).

## Aceite e testes

- [x] Salvar 0,01 e 1.234,56 sem perda de centavos; rejeitar fração de centavo, zero, negativos, overflow, data impossível/futura, enum inválido, conta desconhecida/CREDIT e campos não permitidos.
- [x] Data histórica permanece no dia/mês escolhido na lista, resumo e recarga; cobrir virada de mês e fuso brasileiro.
- [x] Categoria manual explícita prevalece sobre regra de classificação existente.
- [x] Duplo clique, duas requisições concorrentes e retry após reinício/conexão reaberta mantêm um único pagamento; payload divergente retorna 409.
- [x] Falha de persistência reverte todas as escritas. Sessão/origem mantêm as proteções existentes, inclusive pelo proxy Svelte.
- [x] Teste PostgreSQL descartável prova POST → GET transactions/summary → conexão reaberta. Verificar conta/data/categoria/centavos, não apenas status HTTP.
- [x] Cobrir sincronização externa posterior e repetida: conciliação elegível não duplica o registro e não move para outra conta. Inspecionar também concorrência entre entrada manual e SaveExternal, pois `claimStatementExternal` atualmente protege somente importações; corrigir a proteção necessária ou registrar limitação concreta antes de considerar aceite.
- [x] Timeout/resposta perdida + recarga recupera envio pendente com a mesma chave; sucesso seguido de erro ao recarregar mantém comprovante sem duplicação.
- [x] UI distingue carregamento de contas, vazio, indisponível, validação, erro de rede e sucesso; funciona por teclado e a 320 px; privacidade mascara valores confirmados.
- [x] No cloud, nenhuma escrita ou sucesso fictício; demais telas e bot textual continuam funcionando.
- [x] Executar checks Go e web aplicáveis de CONTRIBUTING/CI; registrar resultados e limitações reais abaixo.

## Evidências

Escopo, implementação e testes em 04/11/2026. Implementação e validação local registradas em [Validação da FA-21](validacao-fa-21.md).

## Retomada e decisões

API, UI e integração implementadas. Build e validação local concluídos; integração em dev acompanhada no PR; FA-22–25 continuam pendentes. API deve conferir `purchase_repository.go`, `transactions_queries.go`, `open_finance_repository.go` e `statement_import.go` antes de escolher persistência. UI reutiliza estilos e padrões existentes. Alteração do contrato deve ser combinada com coordenador antes de propagar. Entrega completa exige integração e evidência; disponibilidade pública continua na FA-17.


### Limite de conciliação e revisão do escopo

A ordem de chegada é significativa: se a despesa manual confirmar antes de `SaveExternal`, a sincronização revalida sob a trava da conta e pode conciliá-la. Se o externo já estiver salvo, o lançamento manual cria uma despesa intencional separada. Não adotar automaticamente o externo por valor/dia evita fundir despesas legítimas iguais. Essa limitação foi testada e documentada na API; a correspondência heurística existente não representa identificação infalível.

A revisão Astra também limitou datas a 2000-01-01 (faixa navegável do painel), desambiguou contas homônimas e preservou recibo/privacidade após falha na releitura. Rejeição 400 no primeiro envio permite corrigir; após resultado incerto, conserva a tentativa e orienta conferência sem gerar nova chave. Retomada depende do sessionStorage da mesma aba; não há recuperação entre dispositivos.
