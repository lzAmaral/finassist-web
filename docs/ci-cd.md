# CI/CD do FinAssist

O fluxo é `dev → pull request → main → produção`. CI valida cada mudança; CD publica automaticamente o código integrado em `main` na Vercel.

## Ambientes e validações

| Etapa | Comportamento |
| --- | --- |
| Push em `dev` | CI completo e preview automático na Vercel |
| PR para `main` | Exige origem `dev` do próprio repositório e checks obrigatórios |
| Merge em `main` | Vercel compila `web/` e atualiza a produção quando o deploy fica pronto |
| Falha de validação | Merge bloqueado; corrigir em `dev` |
| Falha no deploy | A Vercel mantém o último deploy de produção disponível; consultar os logs |

Checks obrigatórios da `main`: `backend`, `frontend`, `check-and-build`, `release-policy` e `Vercel` (preview pronto). Os workflows não filtram caminhos, evitando checks obrigatórios pendentes em PRs que alteram apenas documentação. A proteção exige PR, branch atualizada e resolução das conversas, inclusive para administradores. Não exige aprovação de outra pessoa, para permitir o fluxo de um mantenedor individual.

O CI do backend aplica migrations em Postgres descartável, roda testes e lint. O frontend legado passa por TypeScript, lint, testes e build. O SvelteKit executa `npm ci`, `npm run check`, `npm test` e `npm run build`, com Node 24.

O CD usa a integração nativa GitHub/Vercel, sem duplicar deploys em GitHub Actions ou adicionar tokens de deploy ao repositório. Projeto `finassist-web`, Root Directory `web`, Production Branch `main`. O backend Go e o Docker Compose não são implantados por esse fluxo.

## Trabalho diário

```sh
git fetch origin
git switch dev
git pull --ff-only origin dev
# editar e validar
git add <arquivos>
git commit -m "feat: Descrição da mudança"
git push origin dev
```

Use uma branch derivada de `origin/dev` quando outro worktree já estiver usando `dev`; o PR dessa branch tem destino `dev`.

Para publicar:

```sh
gh pr create -R lzAmaral/finassist-web --base main --head dev
gh pr checks <numero> -R lzAmaral/finassist-web --watch
gh pr merge <numero> -R lzAmaral/finassist-web --merge
git fetch origin
git switch dev
git merge --ff-only origin/main
git push origin dev
```

Preserve a branch `dev` depois do merge. Use merge commit nas promoções para manter as duas branches alinhadas. A branch padrão no GitHub é `dev`; a branch de produção da Vercel continua sendo `main`.

## Dados e segredos

As variáveis financeiras existentes ficam em Production. Preview e Development precisam de credenciais e armazenamento próprios antes de testar integrações reais. Sem essas variáveis, o preview mostra um painel vazio. Não copie tokens de Blob, chaves de sessão ou credenciais bancárias de produção para desenvolvimento. Testes automatizados usam dados sintéticos e Postgres descartável.

## Verificação e recuperação

Confira os checks do PR e o deployment no projeto Vercel. Após o merge, confirme o commit publicado e a página de login em https://finassist-web.vercel.app. Não basta o CI estar verde: o deployment também precisa estar `Ready`.

Para uma regressão funcional, reverta a mudança em `dev`, valide e publique outro PR para `main`. Em uma indisponibilidade urgente, um rollback explícito pela Vercel pode restaurar um deploy anterior; depois registre a correção em `dev` e publique pelo fluxo normal para reconciliar o código com produção.

Referências: [proteção de branches no GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) e [integração GitHub/Vercel](https://vercel.com/docs/git/vercel-for-github).
