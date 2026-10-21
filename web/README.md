# FinAssist Web

SvelteKit 3, Svelte 5 e TypeScript. Painel em português com saldos, gráficos mensais, busca de transações, exportação CSV e acesso protegido. Publicado na [Vercel](https://finassist-web.vercel.app).

## Executar

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Copie `.env.example` para `.env.local` e configure um dos modos abaixo. Sem configuração completa, o painel permanece vazio. Não há dados de demonstração nem substituição de erros por valores fictícios.

## Consulta Pluggy na Vercel

Este modo consulta as contas já autorizadas, sem depender do computador local ligado. A sincronização percorre todas as páginas da API `/v2/transactions`, salva um snapshot criptografado com AES-256-GCM em **Vercel Blob privado** e só entrega os dados ao proprietário autenticado. Não há URL pública para o snapshot. CPF, números de conta e dados de identidade não são armazenados.

Configure as variáveis privadas de runtime listadas em `.env.example`: credenciais Pluggy e IDs dos itens, token do Blob privado, hash scrypt da senha, chave de sessão, chave de criptografia e segredo do cron. Guarde backup da chave de dados: sua perda impede ler os snapshots existentes. As credenciais nunca recebem prefixo `PUBLIC_` nem são commitadas.

Use `web` como Root Directory na Vercel, Node.js 24, instalação `npm ci` e build `npm run build`. O agendamento `0 9 * * *` consulta a Pluggy diariamente; a hora é UTC e a execução pode variar conforme o plano. `/api/sync` aceita GET somente com `Authorization: Bearer <CRON_SECRET>`, e POST somente com sessão e origem válidas. Execute a primeira sincronização por esse endpoint antes do primeiro uso. O botão **Atualizar dados** consulta novamente, com intervalo mínimo de cinco minutos. Isso não força uma atualização no banco: lê os dados mais recentes disponíveis na Pluggy. A última sincronização bem-sucedida é preservada em caso de erro.

O login usa senha com hash scrypt, cookie HttpOnly, Secure em produção, SameSite Strict e validade de sete dias. As chaves precisam ser estáveis entre instâncias e deploys. Há limite de tentativas por IP em cada instância; este é um aplicativo pessoal de um proprietário, sem cadastro público nem isolamento multiusuário.

O resumo considera lançamentos confirmados. Pendências ficam identificadas na lista, sem inflar os totais. Transferências próprias, aplicações e liquidações de fatura ficam fora de receitas/despesas; compras do cartão e estornos seguem o sentido do lançamento. Parcelas usam o mês previsto da fatura quando disponível. O saldo disponível soma contas bancárias em BRL e exclui faturas e investimentos. A precisão das categorias e a identificação de transferências dependem dos metadados da instituição.

Este modo fornece consulta das finanças bancárias. Orçamentos, metas e lançamentos manuais via Telegram ainda pertencem à instalação Go; não são sincronizados com este snapshot. Um banco relacional gerenciado, como Supabase, pode ser adicionado quando essas operações forem integradas à versão cloud.

## API Go existente

Defina `FINASSIST_API_URL` com a origem do backend. Esse modo tem precedência sobre a consulta Pluggy. Para desenvolvimento use `http://127.0.0.1:3000`; em produção é necessária uma origem HTTPS acessível pela Vercel. `localhost` na Vercel não aponta para o computador do desenvolvedor.

Inicie o Docker Compose na raiz e conclua `/setup` usando o `SETUP_TOKEN` da instalação ou entre em `/login` se já estiver configurado. O proxy preserva cookies, valida a origem das escritas e não permite cache das respostas financeiras. A API Go retorna até 100 transações por mês neste frontend, com aviso quando houver mais. No modo Pluggy, todas as transações do mês ficam disponíveis para busca e exportação.

## Organização

- `src/lib/server/finance-data.ts`: conversão e agregação puras, testadas com dados sintéticos.
- `pluggy-sync.ts`: autenticação e paginação da fonte bancária, sem acesso pelo navegador.
- `cloud-store.ts`: persistência privada, criptografia e escrita condicional por ETag.
- `cloud-auth.ts` e `cloud-api.ts`: sessão do proprietário e rotas protegidas.
- `backend.ts`: configuração do proxy para Go.
- `src/lib/finance.ts`: contrato de apresentação compartilhado pelos dois modos.

## Verificar

```sh
npm run check
npm test
npm run build
```

Base original: [MarcosAAlbanoJunior/go-financial-assistant](https://github.com/MarcosAAlbanoJunior/go-financial-assistant). Licença MIT preservada na raiz. Evolução web por Luiz Amaral.
