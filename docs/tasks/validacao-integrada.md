# Validação integrada das dez tarefas

Data: 21/10/2026. Coordenação: agente principal; implementações delegadas a agentes GPT-6.1 Sol com raciocínio high. Os checklists individuais e a [ADR 0009](../decisoes/0009-persistencia-web-go.md) registram decisões e limites.

## Ambiente e isolamento

Validação com Node 26.5.0, Go 1.26.1, Chrome e PostgreSQL 17 descartável. Migrations 001–022 aplicadas somente aos bancos de teste. O painel Svelte foi copiado para uma pasta temporária sem arquivos `.env*`, conectado a um servidor Go com senha sintética e sem canais ou integrações externos. Nenhuma chamada real a Telegram, Pluggy, Gemini ou Blob, nenhum deploy e nenhuma migração de produção.

Fixture de navegador: uma instituição, uma conta bancária com saldo informado de R$ 9.000, um cartão com saldo devedor R$ 1.200 e limite R$ 5.000, 237 movimentos confirmados e uma pendência manual de R$ 150. As suites de domínio usam outras fixtures para histórico, parcelas, decisões, deduplicação e concorrência.

## Verificações de navegador

Automação Playwright em Chrome, com inspeção visual das capturas e captura de erros JavaScript. Viewports 1440, 768, 390 e 320 pixels, conforme cada fluxo.

| Fluxo | Procedimento e resultado |
| --- | --- |
| Configuração ausente | Página sem métricas fictícias; sem estouro horizontal nos quatro tamanhos. |
| Primeira sincronização cloud | Loader/componente reais com fonte sintética: snapshot pendente, botão principal pelo teclado, erro 502 visível, retry e primeiro resumo, expiração 401 redireciona login. Fluxo sintético levou cerca de 2,2 s; não é medição de tempo de ativação de usuários nem latência da Pluggy. |
| Busca e exportação | 237 itens carregados; tabela de 50 itens por página; busca encontra item 237; CSV contém 158 saídas mesmo fora da página; conta/direção e URL persistem na recarga. Corrigida reação à URL superficial do SvelteKit 3. |
| Metas | Pela UI e Go/PostgreSQL reais: criar SAVE, recarregar, acompanhar valor e excluir. Validações dos três tipos, progresso e histórico cobertas adicionalmente pelas suites. |
| Categorias | Corrigir um item de Outros para Saúde, encontrar na tabela e recarregar; restaurar categoria. Regras, prévia e concorrência verificadas também em testes HTTP/DB. |
| Orçamento | Alterar pendência para fixa, recarregar e confirmar correção manual; voltar à detecção automática. Sem histórico não apresenta projeção zero como estimativa. |
| Cartões e agenda | Consulta real mostra pendência de R$ 150 separada do saldo devedor de R$ 1.200; fatura/quitação indisponíveis com explicação. Layout móvel sem overflow. |
| Revisão | Dispensar sugestão, recarregar e restaurar; visão geral integrada, evidências e histórico acessíveis. |
| Perguntas | Total de Alimentação R$ 1.554,84 com mais de 100 movimentos; compromissos conhecidos; histórico insuficiente na comparação. Sem IA. |
| Notificações | Prévia sem efeitos, máscara, salvar/recarregar preferências, marcar lida e dispensar. Corrigida clonagem de Proxy Svelte. |
| Importação | CSV de duas linhas: prévia, confirmar, recarregar e reverter. Conta local com saldo explícito criada por teclado; OFX com prévia, confirmação e reversão. |
| Navegação | Novas rotas nos três tamanhos menores sem overflow ou erros JavaScript; seletor móvel permite acessar todas as páginas e sair. |

## Resultado consolidado

- `web`: 66 testes aprovados, Svelte check sem erros/avisos e build de produção com adapter Vercel concluído.
- `backend`: suíte completa com PostgreSQL e pacotes serializados aprovada; suites app/HTTP/notificações repetidas após último ajuste de agendamento/compatibilidade; `go vet` aprovado, `golangci-lint` com zero problemas e gofmt sem arquivos pendentes.
- `frontend` React: 125 testes em 19 arquivos, TypeScript e oxlint aprovados.
- `git diff --check`: aprovado. Nenhum commit ou deploy executado.

Limites: os testes não medem latência bancária real; Blob, Pluggy, Gemini e Telegram foram substituídos por fixtures/transportes controlados. Fatura/quitação ausentes não são inventadas; perguntas livres e limites por categoria seguem fora do escopo. Importação inicial é bancária BRL, com revisão explícita e limitações documentadas em [importação de extratos](../importacao-extratos.md).

## Como repetir as suites

Use um PostgreSQL descartável com todas as migrations. `TEST_DATABASE_URL` não pode apontar para dados reais. Os pacotes de integração existentes compartilham algumas fixtures; executar os pacotes serialmente evita interferência entre eles.

```sh
cd backend
TEST_DATABASE_URL='<postgres descartável>' go test -p 1 ./... -count=1
go vet ./...
golangci-lint run ./...
gofmt -l .
```

```sh
cd web
npm test
npm run check
npm run build
```

Regressão do painel React original:

```sh
cd frontend
npm ci --ignore-scripts
npm test
npx tsc -b
npm run lint
```

Para repetir a inspeção manual, iniciar o Svelte com `FINASSIST_API_URL` apontando para o servidor Go de teste, entrar com a senha sintética e reproduzir os fluxos da tabela. Conferir também erros de API, recuperação, ocultação de valores, acesso por teclado e a navegação móvel entre as novas páginas. A prévia de notificações do navegador usa um builder sintético com Store/Service/HTTP/PostgreSQL reais; a composição real de revisão, metas, agenda e resumo tem teste de integração próprio em `internal/app/notification_source_test.go`.
