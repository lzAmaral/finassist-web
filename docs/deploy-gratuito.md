# Vercel + Render Free + Neon Free

O SvelteKit continua na Vercel; a API Go roda no Render e persiste no PostgreSQL do Neon. A carteira manual, proventos e configuração de IA do web continuam no Blob privado. Este procedimento não importa automaticamente dados do snapshot cloud nem do PostgreSQL local.

## Infraestrutura provisionada

Em 04/11/2026 foi criado o projeto Neon `finassist` (`cold-sunset-28452598`), na organização AmaralTech, plano Free, região `aws-us-east-1`, PostgreSQL 16 e compute fixo de 0,25 CU. As branches `main` e `dev` receberam as migrations 001–024, partindo de bancos vazios. O workspace local aponta para `dev` em `.neon` (ignorado pelo Git), sem alterar arquivos `.env`.

O serviço Render `finassist-api` (`srv-dblr1it9el5s73ehaecg`) usa o plano Free em Virginia, acompanha `main` após o CI, com root `backend`, Dockerfile `./Dockerfile`, contexto `.` e health check `/health`. Sua origem é `https://finassist-api-iwfi.onrender.com`. O primeiro deploy ficou Live e `/health` respondeu HTTP 200; `/api/setup/status` confirmou o setup aberto sem problemas de configuração. A conexão de produção está no segredo `DATABASE_URL`; `APP_SECRET_KEY` e `SETUP_TOKEN` foram gerados no Render. O canal selecionado é Telegram, com token e ID do proprietário armazenados somente no Render. Ainda falta concluir a senha/setup. A Vercel ainda precisa ser conectada e validada conforme o roteiro abaixo.

## Limites e pré-requisitos

- Render Free suspende o serviço após 15 minutos sem tráfego. O proxy web tem timeout de 20 segundos: o primeiro acesso pode falhar enquanto o Go inicia; aguarde e tente novamente. Não reenvie automaticamente escritas financeiras.
- Jobs de notificações e sincronização só funcionam com o Go em execução. Não há garantia de horário no plano gratuito. O cron Vercel existente não substitui os jobs Go.
- O setup atual exige um canal. Use um bot Telegram e o ID do proprietário; WhatsApp exige Evolution/Redis, fora desta configuração. Mantenha o segundo fator ativo. O Telegram também pode demorar a responder enquanto o serviço estiver suspenso.
- O banco e o Blob têm franquias próprias. Pluggy e Gemini têm contratos/limites independentes. Não habilite planos pagos para concluir este roteiro.
- Produção e preview precisam de bancos, serviços e segredos distintos. Nunca conecte um preview ao Neon/Render de produção.

## 1. Banco Neon

Crie um projeto Free, preferencialmente em região próxima ao Render (o Blueprint usa Virginia). Para uma instalação nova, crie um banco vazio. Guarde a conexão direta com TLS (`sslmode=require` ou configuração mais estrita fornecida pelo Neon) no gerenciador de segredos.

Com `psql` instalado, carregue essa conexão em `PGDATABASE` por entrada oculta, evitando colocá-la no histórico. No bash/zsh:

```sh
read -r -s PGDATABASE
export PGDATABASE
sh scripts/migrate-cloud.sh
unset PGDATABASE
```

O script aplica todos os SQLs em ordem (incluindo 024), interrompendo na primeira falha. Antes de atualizar um banco existente, faça backup e confira o destino. As migrations não rodam no build nem automaticamente no startup. O plano Free do Render não oferece o comando de pre-deploy dos planos pagos.

## 2. API Render

Publique a configuração pelo fluxo `dev → PR → main`, após os checks de CONTRIBUTING.md. Crie um Blueprint pelo repositório `lzAmaral/finassist-web`, usando `render.yaml` de `main`. Confira o plano **Free** antes de criar. O serviço acompanha `main` e usa `checksPass`.

Informe `DATABASE_URL` com a conexão Neon com TLS. Uma conexão direta serve para esta instância única (pool Go limitado a 10 conexões); monitore o consumo de compute. O Blueprint gera `APP_SECRET_KEY` e `SETUP_TOKEN`. Guarde cópia segura da chave mestra e mantenha-a estável entre deploys: sua troca torna os segredos salvos ilegíveis. Não reutilize chaves do preview.

Confira o deploy e `https://<servico>.onrender.com/health`. O health check confirma o HTTP, mas não substitui a validação de banco, setup e login.

## 3. Validar e conectar a Vercel

Primeiro valide a integração usando uma instalação de desenvolvimento própria (Render/Neon/Blob/Telegram separados e dados sintéticos). Em produção, prepare o banco e o serviço antes de mudar a Vercel.

Na Vercel, mantenha Root Directory `web` e Production Branch `main`. Configure `FINASSIST_API_URL` **somente em Production** com a origem HTTPS do Render, sem `/api`. Preserve `BLOB_READ_WRITE_TOKEN` e a chave de criptografia já usadas em Production pela carteira. Não copie esses valores para Preview.

A alteração de variáveis só entra em vigor em um novo deployment. Publique pelo próximo PR `dev → main`, com merge commit, conforme [CI/CD](ci-cd.md). O Go tem precedência sobre o modo Pluggy cloud; o painel pode ficar vazio até configurar e sincronizar a nova instalação.

Abra `/setup` na interface Vercel, informe o token de setup do Render, configure a senha e conclua o canal Telegram. Configure Pluggy no backend para carregar contas e transações; habilite Gemini apenas se desejar. O setup cria credenciais próprias do Go, diferentes do login cloud anterior.

Valide login/segundo fator, leitura de contas, importação com dados sintéticos no preview, criação e edição de orçamento e persistência após reinício. Confirme que cookies de sessão têm Secure/HttpOnly e que os endpoints privados rejeitam acesso sem sessão. Teste também o primeiro acesso depois da suspensão. Só considere concluído após conferir o deployment Ready na Vercel e Live no Render.

## Atualizações e recuperação

Para alterações de esquema, aplique migrations compatíveis antes da versão Go que depende delas, com backup prévio. Render e Vercel publicam independentemente: mudanças de API precisam manter compatibilidade durante a transição. Sincronize `dev` com `origin/main` após cada publicação.

Para retornar ao modo cloud, remova `FINASSIST_API_URL` de Production e publique novamente pelo fluxo normal. Preserve as variáveis cloud, o Blob e o banco Go. Dados novos gravados no Go não migram para o snapshot cloud; o retorno pode mostrar dados anteriores.

Referências: [Render Free](https://render.com/docs/free), [Blueprint](https://render.com/docs/blueprint-spec), [Neon](https://neon.com/docs/connect/connect-from-any-app), [Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing).
