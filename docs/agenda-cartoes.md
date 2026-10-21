# Cartões e agenda

A página `/cartoes` consulta `GET /api/agenda`. No modo Go, PostgreSQL é a autoridade, com sessão Go obrigatória; o endpoint não aceita escrita. No modo cloud, o mesmo contrato apresenta os saldos de cartões preservados no snapshot e declara a agenda indisponível.

## O que os valores significam

- **Saldo devedor / limite usado:** `accounts.balance`, sem somar entre cartões nem com dinheiro em conta. Pode incluir parcelas futuras em conexões Open Finance.
- **Fatura:** exige identidade, valor, vencimento e estado de quitação próprios. A fonte atualmente persistida não oferece esses dados; `invoice` permanece `null`. Não é calculada somando compras ou usando o saldo do cartão. Vencimento antigo não prova atraso nem pagamento de fatura.
- **Compromissos:** apenas pagamentos manuais pendentes e estimativas de recorrências explicitamente cadastradas. Transações importadas não viram obrigações: o Go grava a data da transação em `payments.due_date`, que não é o vencimento da fatura.
- **Parcelas importadas conhecidas:** exibidas por cartão como informação, com data de referência e estado `RECORDED`. `PAID` de uma compra importada significa postagem; não confirma quitação de fatura. Estas parcelas não entram na soma da agenda.

As datas de fechamento e vencimento são as informadas em `accounts`; ausentes continuam `null`. A interface distingue atualização da fonte (`institutions.source_updated_at`) da cópia no app (`accounts.updated_at`). No snapshot cloud atual não há `creditData`, portanto limites, fechamento e vencimento não são reconstruídos.

## Contrato e agregação

`CardAgendaData` está em `web/src/lib/card-agenda.ts`; a implementação de domínio está em `backend/internal/usecase/agenda`. `ports.AgendaReader` é opcional para manter compatibilidade com leitores anteriores, que recebem HTTP 501 explícito. Erros de armazenamento retornam 500 genérico sem revelar dados internos.

`today` segue o dia civil de `America/Sao_Paulo`; valores `DATE` do PostgreSQL são formatados diretamente, sem conversão que mude o dia. O pacote Go incorpora `time/tzdata`, porque o container final não instala o banco de fusos do sistema.

`commitments` contém identidade estável, descrição, valor, data ou `null`, estado `PENDING`/`OVERDUE`, origem, indicador de estimativa e `paymentEvidence`. Na consulta atual não há confirmação de pagamento: `paymentEvidence` é `null`, pagamentos quitados ficam fora da agenda e apenas evitam recriar previsões do mesmo mês. Confirmação e conciliação continuam no fluxo existente do backend; esta página não muda estados.

Origens possíveis:

- `manual-payment`: pendência manual com data fornecida ou não informada.
- `manual-installment-schedule`: parcela do cronograma manual; a data gerada no cadastro é uma estimativa.
- `manual-recurring-estimate`: previsão do mês corrente até os próximos 30 dias, conforme valor e dia da recorrência ativa. O dia 31 é limitado ao último dia do mês. Meses anteriores não são extrapolados como dívidas.

Um pagamento já existente, inclusive pago, cancelado ou conciliado com uma transação importada, cobre o par **compra + mês de referência** e impede uma segunda previsão recorrente nesse mês. IDs repetidos de pagamento são contados uma vez. Faturas, saldo do cartão e parcelas importadas ficam fora da soma, evitando sobreposição com compras e recorrências.

`totals` separa valores registrados de estimativas, com soma arredondada em centavos. As janelas `overdue`, `today`, `next7`, `next30` e `undated` são alternativas: `next7` está contida em `next30`, ambas excluem hoje. Portanto seus totais não devem ser somados entre si. Pendências sem data têm grupo próprio.

## Disponibilidade da fonte

Conferido em 21/10/2026 na documentação oficial [Account](https://docs.pluggy.ai/en/docs/products/accounts) e [Transaction](https://v2.docs.pluggy.ai/en/docs/products/transactions): saldo de cartão varia por tipo de conector; Open Finance expõe limite usado. Metadados de parcelas e postagem não equivalem a confirmação de pagamento da fatura. A sincronização atual persiste campos de conta e movimentos, sem recurso próprio de faturas. Incorporar faturas reais exige ampliar a ingestão com identidade/estado/evidência do recurso antes de habilitar seu valor na agenda.

Cloud continua sem domínio paralelo de obrigações. Seus totais estruturais vazios não são apresentados como ausência comprovada de contas a pagar; a interface mostra a indisponibilidade, preservando a diferença entre dado ausente e zero real.
