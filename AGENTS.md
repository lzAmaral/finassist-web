# Fluxo de desenvolvimento

- O repositório de trabalho é `lzAmaral/finassist-web` (`origin`). O remote `upstream` é somente referência; use `-R lzAmaral/finassist-web` nos comandos `gh`.
- Trabalhe na branch `dev`. Se precisar de isolamento em outro worktree, crie uma branch a partir de `origin/dev` e integre primeiro em `dev`.
- `main` representa produção. Não faça push direto, force push, bypass de proteção ou deploy manual de produção no fluxo habitual.
- A publicação acontece por PR de `dev` para `main`, após os checks obrigatórios. Use merge commit para preservar a história da branch `dev` e sincronize `dev` com `origin/main` depois da publicação.
- A Vercel publica `web/`: previews para desenvolvimento e produção para `main`. O backend Go e o frontend legado são validados no CI, mas não são implantados pela Vercel.
- Não copie credenciais ou bancos de produção para previews. Sem configuração própria de Preview, o painel fica vazio.
- Siga [CONTRIBUTING.md](CONTRIBUTING.md) e [docs/ci-cd.md](docs/ci-cd.md) para validação e publicação.
