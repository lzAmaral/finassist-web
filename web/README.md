# FinAssist Web

Frontend SvelteKit 3 + Svelte 5 + TypeScript para o FinAssist, com adaptador oficial da Vercel. Interface responsiva em português com visão geral, transações com busca e exportação CSV, orçamento, metas, contas, login e configuração inicial por Telegram.

## Executar

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Sem `FINASSIST_API_URL`, o app exibe um **painel vazio com conexão pendente**. Nenhum saldo, lançamento, conta ou meta é gerado. Valores desconhecidos aparecem como travessão, e a exportação fica desabilitada enquanto a lista estiver vazia.

## Conectar o backend real

1. Inicie o backend original com Docker Compose na raiz do repositório.
2. Copie `.env.example` para `.env` **nesta pasta**.
3. Defina `FINASSIST_API_URL=http://127.0.0.1:3000` e reinicie o servidor SvelteKit.
4. Acesse `/setup` e use o `SETUP_TOKEN` do `.env` **da raiz** para concluir a configuração. Se a instalação já estiver configurada, use `/login`.

O modo real nunca substitui falhas de conexão por dados fictícios. Ele usa as rotas `/api/me`, `/api/summary`, `/api/transactions`, `/api/breakdown`, `/api/timeseries`, `/api/balances`, `/api/budget` e `/api/goals`. A lista inicial traz até 100 transações por mês, com aviso quando há mais registros; a exportação inclui apenas os registros exibidos e filtrados.

## Arquitetura

- `src/lib/finance.ts`: contratos e formatação para apresentação.
- `src/lib/server/empty.ts`: estado vazio quando a conexão ainda não foi configurada.
- `src/lib/server/backend.ts`: configuração privada da origem da API.
- `src/routes/api/[...path]/+server.ts`: proxy com validação de origem para escritas, cookies HttpOnly e respostas sem cache.
- `src/routes/[[section]]/+page.server.ts`: carregamento autenticado dos dados reais ou estado de conexão pendente.
- As regras financeiras reais continuam no backend Go. O navegador não recebe chaves Pluggy nem conexão PostgreSQL.

## Publicar na Vercel

Use `web` como **Root Directory**, framework SvelteKit, Node.js 24, instalação `npm ci` e build `npm run build`. Sem `FINASSIST_API_URL`, a publicação permanece vazia, aguardando conexão. Para modo real, configure uma origem HTTPS de backend persistente acessível pela Vercel; `localhost` na Vercel não aponta para o computador do desenvolvedor.

O backend atual mantém jobs e canais de conversa, por isso exige um serviço de containers/VM separado. O PostgreSQL local atende ao desenvolvimento. Supabase é opcional como PostgreSQL gerenciado: as tabelas financeiras devem ficar em esquema privado, fora do Data API, ou ter RLS revisado antes de qualquer exposição. Não habilite acesso direto do navegador às tabelas herdadas.

## Verificar

```sh
npm run check
npm run build
```

Base original: [MarcosAAlbanoJunior/go-financial-assistant](https://github.com/MarcosAAlbanoJunior/go-financial-assistant). Licença MIT preservada na raiz. Evolução web por Luiz Amaral.
