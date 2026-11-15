# A Design for Life

O nome do repositório vem de **A Design for Life**, música da banda **Manic Street Preachers**. [Ouça no Spotify](https://open.spotify.com/track/4Hb2XO4Jt5W9RIO6Zka0kK).

Portfólio bilíngue de Product Design e UX. Next.js serve as páginas, Payload gerencia o conteúdo e PostgreSQL guarda os dados. A interface usa Tailwind CSS, CVA, shadcn e Motion, com o Figma como referência visual.

O lançamento ainda não está autorizado; veja o [estado atual e as pendências](documentation/current-status.md).

## Uso local

Use Node 24.22.2, pnpm 12.10.1 e Docker com contêineres Linux. Execute os comandos na raiz do repositório.

1. Instale as dependências com `pnpm install --frozen-lockfile`.
2. Se `.env` não existir, copie `.env.example`. Defina um `PAYLOAD_SECRET` privado com pelo menos 32 caracteres e a `DATABASE_URI` do banco local na porta 5432. Mantenha `MEDIA_STORAGE_DRIVER=local`; o e-mail local usa captura privada.
3. Somente em uma máquina nova, crie o volume externo com `docker volume create a-design-for-life-rebuild-postgres-data`. Neste checkout, reutilize o volume existente.
4. Na primeira configuração, suba o PostgreSQL com `docker compose -f compose.local.yaml up -d --build --wait postgres`. Nas seguintes, use `--no-build` no lugar de `--build`. O volume existente é reutilizado.
5. Para um banco novo, com desenvolvimento e testes parados, execute `pnpm migrate` e `pnpm provision:structural` no host. O provisionamento cria perfis e navegação como rascunhos; preencha e publique ambos nos dois idiomas para abrir as páginas públicas.

Execute `pnpm dev` no host. Abra o site em [português](http://localhost:3000/pt), em [inglês](http://localhost:3000/en) ou o [painel do Payload](http://localhost:3000/admin). O Compose mantém somente o banco; a porta 3000 fica disponível para a aplicação.

Com desenvolvimento e testes parados, use `pnpm provision:editor` para criar ou recriar a conta local. Defina `APP_ENV=local`, `LOCAL_EDITOR_EMAIL` e `LOCAL_EDITOR_PASSWORD` no ambiente privado. Uma conta com o mesmo e-mail é preservada. Após a limpeza dos testes, `pnpm provision:structural` prepara novamente os rascunhos de perfil e navegação.

O Compose expõe somente a porta 5432 em loopback. Preserve o volume externo do banco e os arquivos privados em `.work`. Para parar sem remover dados:

```sh
docker compose -f compose.local.yaml stop postgres
```

Antes de alterar dados, pare a aplicação e use `pnpm backup:local` conforme o [guia de backup e recuperação](documentation/operations.md#backup-e-recuperação). O comando compartilha o bloqueio exclusivo do banco. O guia inclui a preparação da imagem de ferramentas do backup. Instale age com `pnpm setup:backup-tools` se necessário. Mantenha `.env`, `.work`, `.toolchain` e a identidade de recuperação privados; guarde essa identidade separada dos backups.

## Verificação

Se faltar o verificador de PDF, execute `pnpm setup:media-checker`. Defina `READING_E2E_FONT_FILE` com uma fonte TrueType legível, como `C:\Windows\Fonts\arial.ttf` no Windows. Para a suíte completa, deixe `VITEST_MAX_WORKERS` sem valor.

```sh
pnpm verify
pnpm exec playwright install chromium --only-shell
pnpm test:e2e
```

O projeto usa três bancos de aplicação fixos: produção, staging e local. Desenvolvimento, integração e E2E compartilham `127.0.0.1:5432/a_design_for_life_rebuild`, configurado no `.env`. Os testes limpam os dados locais entre rodadas; faça backup antes de guardar ali qualquer conteúdo que queira preservar. Pare `pnpm dev` ou `pnpm start` antes dos testes: esses comandos compartilham um bloqueio exclusivo com o runner. O contêiner, o volume e o banco permanecem após a rodada.

Os testes usam mídia sintética local, captura de e-mail e Analytics desligado. Provas de migração e recuperação reconstroem o schema no mesmo banco. O build dos testes fica em `.work/next-tests`. O CI do GitHub executa `pnpm verify:ci`, sem banco; integração e E2E precisam da verificação local antes do aceite da candidata.

O Actions roda nos PRs, nos pushes para `develop`/`main` e por acionamento manual. Branches de trabalho passam pelo PR, evitando repetir o mesmo check no push. Um novo commit cancela a verificação anterior daquele PR; deploys mantêm a fila por branch. pnpm, Next.js e TypeScript reaproveitam cache, mas todas as verificações continuam executando. O Docker guarda suas camadas na tag `build-cache` do mesmo package privado no GHCR. A primeira rodada preenche esses caches; o ganho deve ser conferido nas seguintes.

Os casos de backup com ferramentas nativas exigem `ADFL_TEST_BACKUP_TOOLS_CONFIG` apontando para um JSON privado com `ageBinary`, `tarBinary`, `recipient` e `identityPath` de teste; sem essa configuração, são ignorados. Depois de uma execução interrompida, confira o bloqueio e a identidade dos recursos antes de liberar uma reserva. Nunca exclua o volume para resolver um bloqueio.

Os relatórios do navegador ficam em `.work/playwright/report`, os traces e resultados em `.work/playwright/results` e o cache do TypeScript em `.work/cache`. São saídas geradas, fora do Git.

| Caminho                         | Função e decisão                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.toolchain`                    | Node, qpdf e age nas versões exigidas pelos comandos locais.                                                                                     |
| `.work`                         | Área privada de trabalho: caches, builds, mídia, publicações, e-mails e backups. Apagar tudo também apagaria dados e identidades de recuperação. |
| `ops`                           | Código de deploy, migrações, backup, recuperação e medição.                                                                                      |
| `scripts`                       | Gera o CSS de estados e supervisiona `dev`/`start`, protegendo o banco compartilhado.                                                            |
| `dependency-cruiser.config.cjs` | Regras de importação e dependências entre módulos, usadas pela verificação de arquitetura. Mantido.                                              |
| `compose.local.yaml`            | Sobe o único PostgreSQL local com volume persistente. Mantido.                                                                                   |

## Documentação

| Assunto                                           | Referência                                      |
| ------------------------------------------------- | ----------------------------------------------- |
| Produto, contratos do CMS e referência visual     | [Especificação](documentation/specification.md) |
| Implementação e fluxos                            | [Arquitetura](documentation/architecture.md)    |
| Edição, deploy, backup, recuperação e performance | [Operação](documentation/operations.md)         |
| Entregas, verificações e gates pendentes          | [Estado atual](documentation/current-status.md) |
