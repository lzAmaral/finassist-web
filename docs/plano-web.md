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

## Critérios de arquitetura

Componentes apresentam dados; módulos de aplicação organizam fluxos; adaptadores de API concentram chamadas externas. Totais, classificação e conciliação continuam no Go. Cada nova integração deve ter contrato explícito e permitir substituição sem reescrever a interface.

O backend atual é de uso pessoal. Não disponibilizar os dados de uma instalação como um serviço público para múltiplos usuários sem projetar isolamento e autenticação adequados.
