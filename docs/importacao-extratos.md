# Importação de extratos bancários

A importação web usa exclusivamente Go/PostgreSQL (ADR 0009). Cloud sem Go mostra o recurso indisponível. Migration necessária: `backend/migrations/022_statement_imports.sql` (aplicar depois de 020 e 021). Exemplo local: `docker compose exec -T postgres psql -U finassist -d finassist < backend/migrations/022_statement_imports.sql`.

Selecione uma conta bancária existente ou crie uma conta local com nome e **saldo atual informado obrigatório**, inclusive zero quando conhecido. O saldo é uma fotografia informada, não uma soma dos lançamentos; importar e reverter movimentos não o recalcula. Contas locais e futuras contas conectadas têm identidades separadas: conectar o mesmo banco depois não funde automaticamente suas contas. Para conciliação automática futura, use desde o início a mesma conta conectada.

CSV aceita UTF-8, separadores `;`, vírgula ou tabulação, cabeçalho opcional, colunas mapeadas, datas `DD/MM/AAAA` ou `AAAA-MM-DD` e decimal brasileiro ou ponto. Valores precisam de sinal inequívoco: negativo é despesa; positivo é receita. O número de coluna da moeda pode ser zero para configurar BRL para o arquivo inteiro; quando mapeada, cada linha deve conter BRL. Data impossível, valor zero, sinal inválido, descrição vazia ou moeda diferente têm motivo por linha. Arquivo vazio, CSV malformado, formato desconhecido e mais de 2 MB/2.000 movimentos são recusados.

OFX aceita transações bancárias SGML/XML com `CURDEF=BRL`, `DTPOSTED`, `TRNAMT`, `MEMO`/`NAME` e `FITID` opcional. `DEBIT` positivo ou `CREDIT` negativo é inválido; FITID repetido dentro do arquivo é inválido. Um arquivo com múltiplos extratos ou extrato de cartão é recusado. O FITID identifica a linha entre arquivos distintos quando fornecido.

Cartões não fazem parte desta primeira versão: seus créditos podem representar estorno ou pagamento, e não renda. CSV bancário não fornece os metadados do Open Finance para distinguir fatura, transferência própria e receita/despesa. A prévia exige revisão, oferece ignorar cada linha e explica a necessidade de ignorar fatura/transferências já contabilizadas. Não inferimos categoria, parcelas, investimento nem saldo a partir da descrição do arquivo.

A prévia persiste apenas um lote estruturado, sem o arquivo original, e nunca cria pagamentos. Conta + SHA-256 dos bytes identifica o arquivo; reenviar o mesmo arquivo retorna o mesmo lote. Enquanto estiver em PREVIEW, o mapeamento pode ser corrigido reenviando o arquivo. CONFIRMED e REVERTED são finais para a identidade do arquivo. Linhas CSV usam data + descrição normalizada + centavos + número da ocorrência idêntica no arquivo; isto conserva duas compras idênticas em um mesmo extrato e evita duplicidade parcial em arquivos sobrepostos. Não há identidade bancária perfeita para CSV: se a descrição mudar, revise os candidatos.

Candidatos têm a mesma conta, tipo, centavos e até três dias de diferença; a prévia distingue Open Finance de movimento existente. A seleção inicial de uma linha com candidatos é **ignorar**, exigindo escolha consciente para vincular ou criar. Confirmação revalida candidatos e identidades dentro de uma transação com trava de conta; novos candidatos exigem recarregar (409). Não se presume equivalência somente por descrição. A lista de candidatos é limitada a 20 por linha.

Confirmar exige uma decisão para cada linha: create, skip ou match. Valores existentes não são reescritos por match. Novos movimentos recebem as mesmas regras de categoria antigas e exatas da FA-05; correções por pagamento continuam oficiais. O lote inteiro confirma ou reverte se qualquer linha/decisão falhar. Registros criados mantêm `external_id=NULL` e sua conta para o sincronizador conciliá-los posteriormente. SaveExternal também revalida recibos de importação depois da trava de conta, cobrindo uma confirmação entre ReconcileExternal e a inserção bancária.

Reversão trava pagamentos e remove somente IDs criados pelo lote ainda sem identidade externa. Não remove correspondências preexistentes nem movimentos que se tornaram canônicos do Open Finance. Compras só são removidas quando não sobra pagamento. Recibos dos movimentos canônicos continuam ativos para deduplicação parcial; as demais identidades são liberadas. Repetir confirmação ou reversão não repete seus efeitos.

## Contratos HTTP

Todas as rotas exigem sessão Go. Escritas exigem JSON e origem válida; o proxy Svelte preserva os guards existentes.

- `GET /api/imports`: contas bancárias disponíveis e 30 lotes recentes.
- `POST /api/imports/accounts`: `{name,balance}` → 201 `{id}`; saldo obrigatório, finito e com até duas casas.
- `POST /api/imports/preview`: `{accountId,filename,content,format,mapping}`; mapping usa índices de coluna a partir de zero, currency `-1` configura BRL; header boolean, decimal `,|.`, dateFormat `DMY|YMD`.
- `GET /api/imports/:id`: lote e linhas; candidatos atualizados quando PREVIEW.
- `POST /api/imports/:id/confirm`: `{decisions:[{row,action,paymentId?,candidateIds?}]}`. Row é o número mostrado na prévia. Create envia os IDs de candidatos vistos para detectar mudança concorrente.
- `POST /api/imports/:id/revert`: `{}` → lote com resultado por linha.

Erro de validação é 400; lote ausente, 404; estado/candidato alterado, 409; capacidade indisponível, 503. Falhas de persistência não retornam sucesso. A UI oferece recarregar dados e prévia sem apagar o arquivo selecionado.
