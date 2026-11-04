# Validação de controle de gastos — FA-18 a FA-20

Data: 04/11/2026. Base: `origin/dev` em `a7f9bd1`. Escopo e pesquisa por GPT-6 Astra (high); três implementações independentes por GPT-6.1 Sol (high), com revisão, integração e validação do coordenador. Os arquivos de tarefa e a [pesquisa](../pesquisa-controle-gastos-2026-11.md) registram as decisões.

## Resultado

| Verificação | Resultado |
| --- | --- |
| Web: `npm run check` | 0 erros e 0 avisos |
| Web: `npm test` | 122 testes aprovados; baseline de 67, mais 50 testes dos helpers e 5 do loader |
| Web: `npm run build` | Aprovado com adapter Vercel; aviso de bundle maior que 500 kB permanece |
| Backend: `go test -p 1 ./...` | Aprovado com PostgreSQL descartável e migrations 001–023 |
| Backend: `go vet ./...`, `gofmt -l .`, `golangci-lint run` | Aprovados; formatação sem saída, lint com 0 issues |
| Frontend legado: TypeScript, oxlint, Vitest e build | Aprovados; 125 testes |
| Chrome: execução e responsividade | Sem erros de página; sem overflow horizontal em 1440, 768, 390 e 320 px |
| `git diff --check` e links relativos dos documentos | Aprovados |

Ambiente local: Node 26.5.0, Go 1.26.1, PostgreSQL 15.15 descartável com timezone UTC. O CI usa Node 24 para web e PostgreSQL 16. A primeira execução do PostgreSQL local herdou America/Sao_Paulo e expôs duas falhas nos testes preexistentes de fronteira mensal; configurar o banco de teste em UTC, como no CI, permitiu concluir a suíte. Nenhum código Go foi alterado. Isso não constitui validação das consultas Go sob todos os fusos de sessão PostgreSQL.

## Integração verificada

- O loader busca o mês anterior somente em Análise e em meses que já começaram. Cloud consulta o dashboard anterior; Go percorre todas as páginas. O teste com 101 registros verifica que não se usa uma primeira página parcial.
- Falha do histórico conserva dashboard e análise opcional. Expiração de sessão redireciona ao login; mês com resposta vazia permanece distinto de falha de leitura. `referenceDate` é fornecida pelo servidor em America/Sao_Paulo, sem divergência de relógio entre SSR e cliente.
- A comparação usa PAID/POSTED, centavos, estornos e intervalos explícitos. Os testes cobrem meses diferentes, anos bissextos, dia UTC anterior em São Paulo, consulta antiga, base zero/negativa, listas inválidas e datas futuras. A porcentagem antiga de mês parcial contra mês completo foi removida da interface; o payload Gemini existente foi preservado.
- A concentração usa descrição exata e conta, com compras, estornos e líquido separados. Foram abertos todos os nove grupos de uma fixture, conferidas 46 evidências em três páginas e testada uma descrição longa sem espaços em 320 px.
- A conferência da base separa pendências positivas/negativas, categoria ampla e estornos confirmados. Foram conferidas 25 evidências pendentes em duas páginas, ausência do link de escrita no cloud e presença do link de classificação no Go. Sobreposições não são somadas.

## Verificação comportamental

Chrome foi automatizado com Playwright sobre o servidor Svelte local. A rota real `/analise?month=2026-10` usou uma API HTTP sintética local com paginação, sem backend ou conta real. Um harness temporário montou os três componentes reais com props cloud/Go e cenários vazio, parcial, histórico ausente, consulta anterior ao mês e mês futuro. O harness foi removido antes do check e do build finais.

Expansão pelo teclado, atributos `aria-expanded`, paginação, troca de mês e reinício das expansões foram exercitados. A opção de privacidade foi testada com detalhes abertos: montantes/percentuais mascarados, barras removidas, sem valores financeiros em ARIA/title. A rota integrada também passou pela ocultação global. Os screenshots desktop/mobile e da descrição longa foram inspecionados visualmente.

Artefatos locais temporários desta sessão: `/tmp/finassist-validation-20261104/` (scripts, screenshots e banco descartável). As fixtures e os testes de cálculo/loader que sustentam a entrega estão versionados em `web/tests/`; o harness de navegador não integra o produto.

## Como repetir as verificações versionadas

```sh
cd web
npm ci
npm run check
npm test
npm run build
```

Para Go/PostgreSQL e frontend legado, seguir [CONTRIBUTING.md](../../CONTRIBUTING.md), usando exclusivamente banco descartável. Para repetir a inspeção visual, fornecer Transaction sintéticas normalizadas com PAID/POSTED, pendências, estornos, contas distintas, mais de cinco grupos e mais de vinte evidências; verificar Análise em desktop e celular, incluindo a troca de mês e privacidade.

## Limites da evidência

Nenhuma chamada real a Pluggy, Blob, Gemini ou instituição financeira, nenhuma credencial de produção copiada e nenhuma migration de produção aplicada. Lista completa da API não comprova cobertura bancária. As três funções são leituras dos lançamentos existentes, sem novas regras de planejamento, persistência ou identificação automática de assinaturas. A disponibilidade pública depende de publicação posterior de `dev` para `main` pelo fluxo do repositório.
