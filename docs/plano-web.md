# FinAssist Web

Evolução pessoal mantida por Luiz Amaral, baseada no [FinAssist de Marcos Antônio Albano Júnior](https://github.com/MarcosAAlbanoJunior/go-financial-assistant). O histórico e a licença MIT originais são preservados.

## Objetivo

Criar uma experiência web em português com SvelteKit, mantendo as regras financeiras no backend Go existente. A primeira entrega deve permitir acompanhar saldos e gastos sem duplicar a lógica de cálculo no navegador.

## Decisões iniciais — 20/10/2026

- Novo frontend em `web/`, separado do frontend React original em `frontend/`.
- SvelteKit com adaptador Vercel para a camada web.
- Acesso ao backend por rotas no servidor SvelteKit, mantendo a sessão por cookies na mesma origem.
- Endereço da API configurado exclusivamente por variável privada no servidor; nenhuma chave Pluggy ou credencial de banco chega ao navegador.
- Backend Go permanece como processo persistente: API, integrações, sincronização e tarefas agendadas.
- PostgreSQL local continua suficiente para desenvolvimento. Supabase pode fornecer PostgreSQL gerenciado quando houver uma implantação remota; não é requisito para começar.
- Credenciais, arquivos `.env`, backups e dados financeiros permanecem fora do Git.

## Próximas entregas

1. Dashboard responsivo em SvelteKit com dados de demonstração identificados.
2. Configuração inicial, autenticação e sessão integradas à API existente.
3. Saldos, transações, orçamento e metas com dados reais.
4. Implantação do frontend na Vercel e do backend em um serviço de containers.
5. Avaliar Supabase com migrações revisadas e acesso ao banco restrito ao backend.

## Primeira versão entregue — 20/10/2026

- Interface SvelteKit em `web/`, com navegação responsiva, gráficos, busca de transações, exportação CSV e telas de orçamento, metas e contas.
- Demonstração publicada em https://finassist-web.vercel.app, sem dados financeiros reais.
- Proxy privado para a API Go, páginas de login e configuração inicial. A conectividade local, o redirecionamento de instalação pendente e a rejeição de origem externa foram verificados. O fluxo completo de autenticação e sincronização bancária depende das credenciais do proprietário.
- Checagem Svelte/TypeScript, build com adaptador Vercel e workflow de CI para `web/`.
- Pendente para uso real remoto: hospedar o backend persistente, configurar `FINASSIST_API_URL` e conectar os bancos. Supabase permanece opcional.

## Critérios de arquitetura

Componentes apresentam dados; módulos de aplicação organizam fluxos; adaptadores de API concentram chamadas externas. Totais, classificação e conciliação continuam no Go. Cada nova integração deve ter contrato explícito e permitir substituição sem reescrever a interface.

O backend atual é de uso pessoal. Não disponibilizar os dados de uma instalação como um serviço público para múltiplos usuários sem projetar isolamento e autenticação adequados.

## Consulta bancária cloud — 21/10/2026

Foi acrescentado um modo de consulta independente da instalação Go: o servidor SvelteKit sincroniza contas e transações da Pluggy, salva um snapshot criptografado em Vercel Blob privado e apresenta os dados somente após login do proprietário. Um cron diário e uma atualização manual autenticada mantêm a consulta. O adaptador Go continua disponível por `FINASSIST_API_URL`.

A conversão e a agregação cloud estão em um módulo puro no servidor, coberto por testes de cartões, estornos, parcelas, transferências, pendências, precisão de centavos e moedas. Não há cálculo financeiro no navegador. O snapshot não recebe os lançamentos de Telegram, orçamentos nem metas da instalação Go; integrar essas escritas e seu banco é uma próxima etapa explícita. Supabase não é necessário para a consulta bancária atual.

## Atualização — remoção dos dados de exemplo

A publicação passou a apresentar um painel vazio enquanto a conexão estiver pendente. Os saldos, transações, contas e metas fictícios foram removidos do frontend. A ausência de conexão não é apresentada como saldo zero nem como sessão autenticada.

## Carteira, gráficos e análise — 21/10/2026

A interface passou a usar shadcn-svelte, Tailwind 4 e LayerChart, com gráficos de barras, distribuição por categoria e acumulado diário. A aba Investimentos lê posições da Pluggy e permite manter posições manuais e proventos em armazenamento privado criptografado. Não apresenta lucro sem custo conhecido, nem confunde valor bruto com capital aplicado.

A aba Análise oferece cálculos locais e integração opcional Gemini, acionada pelo proprietário. O payload externo contém apenas percentuais e categorias fixas, com limites persistentes e validação do resultado. Ativar o Gemini depende da chave da conta do proprietário; os gráficos e a análise local não dependem dela. A carteira é uma primeira versão inspirada nas funções públicas do Investidor10, sem copiar sua área privada nem prometer equivalência completa.
