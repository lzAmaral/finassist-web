# 0009 — Operações no Go/PostgreSQL e dados auxiliares privados preservados

Data: 21/10/2026. Aplicativo pessoal de um proprietário; sem migração de produção nesta entrega.

## Decisão e alternativas

A API Go/PostgreSQL é o caminho principal para transações, importação/conciliação, classificação/regras, orçamento, metas, revisão, notificações e perguntas. O Svelte encaminha `/api/*` para `FINASSIST_API_URL`, preservando sessão e guards de origem. A origem pública é validada no Svelte e o Origin encaminhado é adaptado à origem Go; não depende de sobrescrever Host (o fetch Node pode ignorar esse cabeçalho). Não se reproduzem esses cálculos em TypeScript. Cloud sem Go conserva consulta/sincronização existentes, sem prometer operações de planejamento.

Alternativa rejeitada: implementar as operações no Blob. Reduziria a necessidade de um processo Go e PostgreSQL, mas duplicaria regras de dinheiro/conciliação, exigiria concorrência por documento e operação de migração em duas direções. Go remoto exige processo persistente, PostgreSQL, conectividade HTTPS e backup; reaproveita domínio e transações ACID. Custos monetários dependem do provedor e volume, sem estimativa fictícia; custos permanentes principais são hospedagem Go/Postgres mais Blob já usado para os dados auxiliares.

## Fonte oficial e sincronização

| Dados | Fonte oficial no modo Go | Responsável |
| --- | --- | --- |
| Contas/transações/investimentos importados Go | PostgreSQL | sincronizador Go/Pluggy; upsert por identidade externa; conciliação existente |
| Metas/orçamento/regras/revisão/chat/importação | PostgreSQL | casos de uso e APIs Go; não há espelhamento Blob |
| Carteira manual/proventos | Blob privado `finance/portfolio-v1.enc` | Svelte companion, criptografia AES-GCM e ETag |
| Chave Gemini/análise/limite diário | Blob privado `finance/analysis-v1.enc` (ambiente continua com precedência existente) | Svelte companion, nunca retorna a chave |
| Snapshot bancário cloud e suas posições | Blob privado `finance/snapshot-v1.enc` | sincronizador cloud existente; congelado para consulta histórica ao ativar Go |

A carteira Svelte preserva posições importadas do snapshot cloud com `importedSource: cloud-snapshot` e `importedSyncedAt`; não soma esse snapshot aos saldos/transações Go. A data de importação aparece na carteira. A carteira Go continua disponível diretamente na API Go; não é somada automaticamente à carteira auxiliar para evitar dupla contagem. A análise Gemini recebe exclusivamente indicadores agregados atuais do Go quando este está ativo.

## Contratos que desbloqueiam FA04–10

As rotas Go existentes continuam oficiais: `GET/POST /api/goals`, `DELETE /api/goals/:id`, budget, review, categorize, transactions, payments e chat. O corpo de criação de meta usa `kind: SAVE|CUT|RESERVE`, `name` e campos próprios (`targetAmount/targetDate`, `category/cutPercent`, `reserveMonths`). Resposta 201 `{id}`; releitura GET `{wealth,goals}`; erros de validação e persistência permanecem os do Go.

Rotas auxiliares Svelte: `GET /api/portfolio?month=AAAA-MM`, `POST /api/portfolio/{position,archive,dividend,archive-dividend}`, `GET /api/analysis?month=AAAA-MM`, `POST /api/analysis/{key,generate}`. Antes de ler/gravar Blob, verificam a sessão pelo Go `GET /api/me`. Não aceitam sessão cloud para substituir a autenticação Go. Escritas exigem Origin público exato. Falha Go não cai silenciosamente para cloud. Armazenamento auxiliar exige apenas `BLOB_READ_WRITE_TOKEN` e `FINASSIST_DATA_KEY` válida; nenhuma segunda senha/Pluggy é necessária. Sem armazenamento: 503 explícito e capacidade desabilitada. Conflito ETag: 409 e recarga; falha de persistência: 502 sem sucesso falso. Primeiro sync cloud: 503 `code: snapshot_pending`.

## Operação, migração e reversão

O operador único é responsável por autenticação/setup Go, HTTPS privado entre Svelte e Go, jobs Go (bancário/digest), cron cloud apenas enquanto esse modo for usado, backup PostgreSQL consistente e cópia cifrada dos documentos Blob com a chave guardada separadamente. Não publicar Go sem seus guards de sessão; não compartilhar esta implantação pessoal entre proprietários.

Não mover carteira/proventos/configuração para PostgreSQL agora: preservar os mesmos documentos é a migração mínima sem perda. Se mudar a conta Blob/namespace, usar o ensaio em `companion-migration.ts`: exportar documentos por leitura privada, criar manifesto com hash sem imprimir conteúdo/chave, gravar apenas destino vazio ou idêntico, reler e comparar, habilitar o modo Go só após o inventário. Snapshot cloud não é importado automaticamente como lançamentos manuais: uma migração bancária requer IDs externos preservados e a conciliação Go, jamais IDs novos por execução.

Janela operacional: suspender cron/escritas antes da cópia, guardar ETags de origem e backup, aplicar em namespace novo, reexecutar (deve resultar unchanged), conferir contagens/hashes, trocar configuração e validar GET/POST. Se ETag mudar, abortar e repetir inventário. Reversão: restaurar configuração para namespace/origem anterior, preservando o destino; antes de voltar ao cloud, suspender escritas e reconciliar alterações feitas no Go. O ensaio testa conflito concorrente e recusa sobrescrever destino divergente. Nenhum comando da entrega acessa armazenamento real.

## Ensaio reproduzível e resultado

Em 21/10/2026, `cd web && node --experimental-strip-types --test tests/companion.test.mjs tests/private-persistence.test.mjs` aprovou autenticação/origem, persistência cifrada, concorrência por ETag, atualização de snapshot, preservação de configuração IA e separação do cache por fonte. Ensaio de migração: 2 posições (1 arquivada), 1 provento, 1 configuração IA; 2 documentos criados, reexecução com 2 unchanged, hashes idênticos e origem preservada para reversão. Origem alterada, destino divergente e criação concorrente foram recusados. O transporte Blob é sintético em memória; criptografia e stores são os módulos de produção. Nenhuma API externa de Blob/Pluggy/Gemini foi chamada.

`TEST_DATABASE_URL=<PostgreSQL descartável com migrations> go test ./internal/infra/http -run TestWebGoalsPostgresRoundTrip -count=1 -v` executa a prova Node/Svelte proxy → Go real → PostgreSQL. Cria meta com 1.234,56, relê pela ponte e diretamente pelo Go, reabre conexão PostgreSQL e confirma dados; limpa somente a meta criada pelo ID. O teste também exige sessão e recusa origem externa e formulário inválido. Executado com sucesso em 21/10/2026 no banco descartável. A prova usa o mesmo adaptador do endpoint Svelte; a experiência visual de criação pertence à FA07.

Migração de namespace dos dados auxiliares não move automaticamente `snapshot-v1.enc`: o snapshot legado tem caminho global e permanece no mesmo Blob/chave. Ao mudar de conta Blob, copiar seu arquivo cifrado e preservar a chave separadamente antes da troca; não carregá-lo no ledger Go. Restaurar `FINASSIST_API_URL`/namespace anterior reverte o roteamento sem apagar PostgreSQL ou Blob; decisões gravadas em Go permanecem lá e precisam ser reconciliadas antes de retomar escrituras no cloud.
