# FinAssist Web

SvelteKit 3, Svelte 5 e TypeScript. Painel em português com saldos, gráficos interativos, busca de transações, carteira de investimentos, análise de gastos e acesso protegido. Publicado na [Vercel](https://finassist-web.vercel.app).

## Executar

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Copie `.env.example` para `.env.local` e configure um dos modos abaixo. Sem configuração completa, o painel permanece vazio. Não há dados de demonstração nem substituição de erros por valores fictícios.

## Consulta Pluggy na Vercel

Este modo consulta as contas já autorizadas, sem depender do computador local ligado. A sincronização percorre todas as páginas da API `/v2/transactions`, salva um snapshot criptografado com AES-256-GCM em **Vercel Blob privado** e só entrega os dados ao proprietário autenticado. Não há URL pública para o snapshot. CPF, números de conta e dados de identidade não são armazenados.

Configure as variáveis privadas de runtime listadas em `.env.example`: credenciais Pluggy e IDs dos itens, token do Blob privado, hash scrypt da senha, chave de sessão, chave de criptografia e segredo do cron. Guarde backup da chave de dados: sua perda impede ler os snapshots existentes. As credenciais nunca recebem prefixo `PUBLIC_` nem são commitadas.

Use `web` como Root Directory na Vercel, Node.js 24, instalação `npm ci` e build `npm run build`. O agendamento `0 9 * * *` consulta a Pluggy diariamente; a hora é UTC e a execução pode variar conforme o plano. `/api/sync` aceita GET somente com `Authorization: Bearer <CRON_SECRET>`, e POST somente com sessão e origem válidas. Após entrar, use **Buscar meus dados** para concluir a primeira sincronização; falhas permitem tentar novamente sem apresentar saldos fictícios. O botão **Atualizar dados** consulta novamente, com intervalo mínimo de cinco minutos. Isso não força uma atualização no banco: lê os dados mais recentes disponíveis na Pluggy. A última sincronização bem-sucedida é preservada em caso de erro.

O login usa senha com hash scrypt, cookie HttpOnly, Secure em produção, SameSite Strict e validade de sete dias. As chaves precisam ser estáveis entre instâncias e deploys. Há limite de tentativas por IP em cada instância; este é um aplicativo pessoal de um proprietário, sem cadastro público nem isolamento multiusuário.

O resumo considera lançamentos confirmados. Pendências ficam identificadas na lista, sem inflar os totais. Transferências próprias, aplicações e liquidações de fatura ficam fora de receitas/despesas; compras do cartão e estornos seguem o sentido do lançamento. Parcelas usam o mês previsto da fatura quando disponível. A visão geral separa as últimas entradas e saídas em dois blocos, com os totais confirmados do mês. Transferências identificadas entre contas próprias, aplicações e pagamentos de fatura ficam fora das listas e da exportação CSV; os registros originais continuam no snapshot. A página de transações permite filtrar por entrada ou saída, categoria, descrição e conta. Estornos permanecem nas saídas como crédito e reduzem as despesas. O saldo disponível soma contas bancárias em BRL e exclui faturas e investimentos. A precisão das categorias e a identificação de transferências dependem dos metadados da instituição.

Este modo fornece consulta bancária, cartões, carteira manual e análise de gastos. Operações de classificação, revisão, orçamento, metas, notificações, perguntas e importação exigem a instalação Go/PostgreSQL. A interface informa essa disponibilidade; o snapshot cloud não recebe escritas desses fluxos. A [ADR 0009](../docs/decisoes/0009-persistencia-web-go.md) registra a decisão e o procedimento de migração/reversão.

## Carteira e gráficos

A UI utiliza componentes [shadcn-svelte](https://www.shadcn-svelte.com/) com Tailwind 4 e gráficos LayerChart. Os estados dos componentes foram adaptados aos atributos `data-state` e `data-orientation` do Bits UI 2. `tsconfig.shadcn.json` permite usar o CLI com os imports nativos `#lib` do SvelteKit 3. A licença dos componentes está em `THIRD_PARTY_LICENSES`.

A aba Investimentos combina posições atuais da Pluggy com posições manuais em reais. Importa todas as páginas, exclui posições totalmente resgatadas e permite cadastrar, editar, arquivar e restaurar posições manuais. Proventos recebidos também podem ser registrados, arquivados e restaurados. O estado manual fica em um arquivo separado, privado e criptografado, com escrita condicional para evitar que alterações concorrentes se sobrescrevam.

A página organiza o patrimônio em quatro indicadores, gráficos de proventos e distribuição por classe, e grupos de ativos expansíveis com quantidade, saldo, ganho de capital, variação sobre custo e participação na carteira. Os proventos podem ser filtrados por classe e por janelas de 6, 12 ou 24 meses, terminando no mês selecionado. O indicador 12M usa uma janela móvel, inclusive entre anos. Classes sem posições oferecem cadastro direto, e os itens arquivados e formulários existentes continuam disponíveis. A composição se adapta ao celular e respeita a opção de ocultar valores. Como não há snapshots históricos do patrimônio nessa versão, o gráfico mensal mostra os proventos registrados.

O custo de uma posição importada usa `amountOriginal` quando disponível. O campo Pluggy `amount` representa valor bruto e nunca é tratado como custo. A variação exibida considera somente posições com custo conhecido; não é rentabilidade histórica TWR/IRR. O gráfico de proventos usa os registros informados, sem inventar dividendos. Preços de posições manuais são informados pelo proprietário, sem feed automático de mercado. A carteira não reproduz todas as funções do Investidor10: não há comparação com benchmarks, recomendações, imposto de renda ou cotação independente.

## Análise de gastos e Gemini

A análise local calcula saldo do período, parcela da renda que sobrou, comparação com o mês anterior, categorias e simulação de redução de despesas. Funciona sem serviço de IA.

A integração Google Gemini é opcional: configure a chave no campo privado da aba Análise de gastos ou no segredo de runtime `GEMINI_API_KEY`. `GEMINI_MODEL` permite escolher o modelo; o padrão é `gemini-3.8-flash`. A chave configurada no app fica criptografada, nunca é retornada nas respostas e não altera o faturamento do Google. Para usar somente a cota gratuita, use um projeto sem faturamento e verifique a disponibilidade e limites na sua conta.

Somente percentuais, índices normalizados e categorias de uma lista fixa são enviados ao Google. Não são enviados valores monetários, datas de referência, nomes, CPF, bancos, IDs, descrições ou categorias livres do extrato. O envio só acontece ao clicar em Analisar meus hábitos. O resultado é identificado como Gemini, validado, armazenado com o mês correspondente e reaproveitado por até 24 horas para os mesmos indicadores. Há reserva persistente de no máximo 10 solicitações por dia; falhas não são apresentadas como análises reais.

Os [termos do Google](https://ai.google.dev/gemini-api/terms) informam que entradas da cota gratuita podem ser usadas para melhoria dos serviços. A UI informa isso antes do envio. A análise ajuda a revisar hábitos; não recomenda compra ou venda de ativos.

Para testes de escrita, `FINASSIST_PRIVATE_NAMESPACE` isola a carteira manual e a configuração de IA em outro prefixo do Blob. Não configure essa variável na produção habitual. Testes de desenvolvimento usam posições sintéticas nesse prefixo, sem acrescentá-las à carteira real.

## API Go existente

Defina `FINASSIST_API_URL` com a origem do backend. Esse modo tem precedência sobre a consulta Pluggy. Para desenvolvimento use `http://127.0.0.1:3000`; em produção é necessária uma origem HTTPS acessível pela Vercel. `localhost` na Vercel não aponta para o computador do desenvolvedor.

Inicie o Docker Compose na raiz e conclua `/setup` usando o `SETUP_TOKEN` da instalação ou entre em `/login` se já estiver configurado. O proxy preserva cookies, valida a origem das escritas e não permite cache das respostas financeiras. A interface percorre todas as páginas de transações da API Go para o mês escolhido. A tabela exibe páginas de 50 itens; busca e exportação consideram todo o conjunto filtrado. Uma falha ou mudança inconsistente entre páginas interrompe a carga, sem exportar resultados parciais. No modo Pluggy, todas as transações do mês ficam disponíveis para busca e exportação.

## Operações integradas

Com o backend Go configurado, o menu oferece:

- **Classificar gastos:** corrigir um lançamento sem alterar outras parcelas, criar regras de descrição completa e revisar o alcance antes de reaplicar. Correções individuais sobrevivem à sincronização.
- **Cartões e agenda:** saldo devedor e limites separados de compromissos manuais e estimativas. Fatura e quitação ficam indisponíveis quando a fonte não fornece evidência; uma data vencida não confirma pagamento.
- **Revisão de gastos:** até três prioridades na visão geral, evidências e histórico na revisão completa, dispensar/restaurar sugestões e registrar/desfazer decisões. Economia potencial e observada são distintas; meses sem histórico não comprovam economia.
- **Orçamento e metas:** metas de juntar, reduzir e reserva, correção fixa/variável/automática e projeções com premissas. Metas podem compartilhar o mesmo patrimônio; não reservam dinheiro separadamente. Limites por categoria ficam fora desta entrega.
- **Notificações:** preferências, prévia e histórico na aplicação; agendamento executado pelo Go, sem navegador aberto. O canal externo depende da configuração da instalação.
- **Perguntas:** consultas prontas, calculadas no Go, com período, origem e links. Funcionam sem Gemini e não enviam um novo payload à IA.
- **Importar extrato:** CSV/OFX de conta bancária em BRL, prévia, revisão de correspondências, confirmação e reversão por lote. Movimentos já conciliados com Open Finance são preservados na reversão.

Aplique as migrations até `022` conforme o [README da instalação](../README.md#atualizando-uma-instalação-existente). O Go deve permanecer em execução para API e agendamentos. Os componentes de carteira/proventos/IA continuam nos documentos privados do Blob, protegidos pela sessão Go; token do Blob e chave de criptografia são necessários para essa capacidade. Posições de um snapshot cloud anterior aparecem com origem e data próprias, sem somá-las novamente às posições importadas no Go.

O [índice das dez tarefas](../docs/tasks/README.md) registra critérios, testes e limitações por entrega.

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
