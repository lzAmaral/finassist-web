# Validação FA-21 — lançamento rápido

Data: 04/11/2026. Escopo e revisão por Astra; API e UI por dois agentes GPT-6.1 Sol (high); integração e navegador pelo coordenador. [Contrato e aceite](fa-21-lancamento-rapido.md).

## Ambiente

Branch `feat/registro-gastos-moneyflow`, derivada de `origin/dev`. PostgreSQL 15 local descartável, bancos separados para integração e navegador, timezone UTC como no CI, migrations 001–024; nenhuma conta, credencial ou transação de produção. Go 1.26.1; Node 26.5 local (CI usa Node 24). Chrome headless real com Playwright. Harnesses temporários removidos antes do build/commit.

## Evidências

| Verificação | Resultado |
| --- | --- |
| `go test -p 1 ./... -count=1` com TEST_DATABASE_URL descartável | Passou; integração PostgreSQL habilitada. |
| `go vet ./...`, `golangci-lint run ./...`, `gofmt -l backend` | Passaram; 0 issues/nenhum arquivo sem formatação. |
| Migration 024 aplicada novamente | Passou, idempotente. |
| `web`: `npm test` | 135 testes passaram, incluindo 13 do lançamento manual. |
| `web`: `npm run check` | 0 erros e 0 avisos. |
| `web`: `npm run build` | Passou; aviso de chunk acima de500kB, sem erro. |
| Legado: `npx tsc -b`, `npx oxlint`, `npm test -- --run` | Passaram; 125 testes em 19 arquivos. |
| Navegador → proxy Svelte → Go → PostgreSQL | POST201, GET de transações, recibo e navegação para outubro após registrar data histórica. |
| Perda da resposta depois de persistir | Abortar resposta201, recarregar e reenviar payload/requestId iguais retornou200 replay; sem segunda gravação. |
| Falha de consulta após sucesso | POST201 seguido de summary500 no servidor preservou comprovante e aviso de lista indisponível. Privacidade continuou acessível. |
| Estados e acesso | Sem BANK impede envio e aponta criação local; accounts503 permite retry; indisponível não busca contas nem oferece escrita; proxy rejeita falta de sessão/origem inválida. |
| Acessibilidade/layout | Revisão por teclado; formulário e comprovante sem overflow a320px; recibo verificado também390/768/1440; máscara de valor, descrição e conta; nenhum pageerror. |

## Cobertura persistente no repositório

- `backend/internal/domain/manual_expense_test.go`: centavos/limites, data civil e virada de dia em São Paulo, mínimo2000, enums e descrição.
- `backend/internal/infra/http/manual_expense_api_test.go`: sessão, origem, JSON estrito, payload/conta inválidos, indisponibilidade e erro seguro.
- `backend/internal/infra/http/manual_expense_postgres_test.go`: POST → transactions/summary em31/03 e01/04 → pool/servidor reabertos, com conta, categoria, centavos e competência.
- `backend/internal/infra/db/manual_expense_test.go`: oito requisições concorrentes produzem um pagamento; chave divergente409; reconexão; rollback real após compra/pagamento; mínimo/máximo exatos; categoria explícita prevalece; saldo de conta preservado; sincronização repetida/concorrente e ordem externa primeiro.
- `web/tests/manual-entry.test.mjs`: transporte, recibo validado, centavos, rótulos de conta, sessão persistida, duplo envio, resposta perdida, armazenamento indisponível/corrompido, rejeição400 versus resultado incerto e falha de atualização após sucesso.

Scripts e capturas da inspeção manual ficam em `/tmp/finassist-validation-20261104/` nesta máquina; não são requisito do CI. Os testes persistentes acima permitem reproduzir a cobertura principal conforme CONTRIBUTING.

## Limitações e disponibilidade

O formulário grava despesas únicas já pagas em contas BANK. Não altera o saldo informado da conta, não cobre crédito/parcelas/receitas/transferências e não grava no modo cloud. Requer backend atualizado e migration024. Publicação web não ativa Go: [FA-17](../fa-17-ativacao-backend.md) continua pendente.

Retentativas da mesma operação são idempotentes; duas novas chaves representam duas intenções distintas. A conciliação segue os critérios existentes e depende da ordem: externo salvo primeiro não é absorvido automaticamente pelo novo manual. Recuperação do navegador é limitada à mesma aba/sessionStorage; falha de armazenamento é sinalizada e tentativa incerta não é descartada silenciosamente.
