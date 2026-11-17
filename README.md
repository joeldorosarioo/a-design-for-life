# A Design for Life

O nome do repositório vem de **A Design for Life**, música da banda **Manic Street Preachers**. [Ouça no Spotify](https://open.spotify.com/track/4Hb2XO4Jt5W9RIO6Zka0kK).

Portfólio bilíngue de Product Design e UX. Next.js serve as páginas, Payload gerencia o conteúdo e PostgreSQL guarda os dados. A interface usa Tailwind CSS, CVA, shadcn e Motion, com o Figma como referência visual.

O lançamento ainda depende das [condições em aberto](documentation/PENDING.md).

## Uso local

Use Node 26.13.1, pnpm 12.10.1 e Docker com contêineres Linux. Se usa NVM, selecione a versão já instalada com `nvm use 26.13.1`. Execute os comandos na raiz do repositório.

O projeto usa a configuração da máquina e a identidade que executa os comandos. Em outro computador ou conta, use um clone próprio e prepare seu `.env`; `.work` será criada durante o uso. No contêiner, a aplicação roda como `appuser`, sem depender do login Windows. Credenciais de serviços entram pela configuração do ambiente.

1. Instale as dependências com `pnpm install --frozen-lockfile`.
2. Se `.env` não existir, copie `.env.example`. Defina um `PAYLOAD_SECRET` privado com pelo menos 32 caracteres e a `DATABASE_URI` do banco local na porta 5432. Mantenha `MEDIA_STORAGE_DRIVER=local`; o e-mail local usa captura privada.
3. Somente em uma máquina nova, crie o volume externo com `docker volume create a-design-for-life-rebuild-postgres-data`. Neste checkout, reutilize o volume existente.
4. Na primeira configuração, suba o PostgreSQL com `docker compose -f compose.local.yaml up -d --build --wait postgres`. Nas seguintes, use `--no-build` no lugar de `--build`. O volume existente é reutilizado.
5. Para um banco novo, com desenvolvimento e testes parados, execute `pnpm payload migrate` e `pnpm provision:structural` no host. O provisionamento cria perfis e navegação como rascunhos; preencha e publique ambos nos dois idiomas para abrir as páginas públicas.

Execute `pnpm dev` no host. Abra o site em [português](http://localhost:3000/pt), em [inglês](http://localhost:3000/en) ou o [painel do Payload](http://localhost:3000/admin). O Compose mantém somente o banco; a porta 3000 fica disponível para a aplicação.

Com desenvolvimento e testes parados, use `pnpm provision:editor` para criar ou recriar a conta local. Defina `APP_ENV=local`, `LOCAL_EDITOR_EMAIL` e `LOCAL_EDITOR_PASSWORD` no ambiente privado. Uma conta com o mesmo e-mail é preservada. Após a limpeza dos testes, `pnpm provision:structural` prepara novamente os rascunhos de perfil e navegação.

Os comandos nativos do CMS usam `pnpm payload`: `generate:types`, `generate:importmap`, `migrate:create` e `migrate`. Por exemplo, `pnpm payload generate:types` atualiza os tipos.

O Compose expõe somente a porta 5432 em loopback. Preserve o volume externo do banco. Para parar sem remover dados:

```sh
docker compose -f compose.local.yaml stop postgres
```

Os dados locais são descartáveis e podem ser recriados para desenvolvimento e testes. Não há rotina de backup local nem necessidade de manter originais editoriais no checkout. Os backups de staging e produção seguem o [guia de backup e recuperação](documentation/OPERATIONS.md#backup-e-recuperação). Guarde suas chaves e arquivos de operação fora do código.

## Verificação

Os testes de navegador usam o Google Chrome já instalado na máquina. O projeto não baixa nem mantém uma cópia de navegador. Defina `READING_E2E_FONT_FILE` com uma fonte TrueType legível, como `C:\Windows\Fonts\arial.ttf` no Windows. Para a suíte completa, deixe `VITEST_MAX_WORKERS` sem valor.

```sh
pnpm verify
pnpm test:e2e
```

`pnpm test` reúne unidades, arquitetura e integração. `pnpm test:scripts` verifica o gerador de CSS e os comandos de deploy.

Há três bancos de aplicação fixos: produção, staging e local. Desenvolvimento, integração e E2E compartilham `127.0.0.1:5432/a_design_for_life_rebuild`, configurado no `.env`. Os testes limpam os dados locais entre rodadas. Pare `pnpm dev` ou `pnpm start` antes dos testes: esses comandos compartilham um bloqueio exclusivo com o runner. O contêiner, o volume e o banco permanecem após a rodada.

Os testes usam mídia sintética local, captura de e-mail e Analytics desligado. Provas de migração e recuperação reconstroem o schema no mesmo banco. O build dos testes fica em `.work/next-tests`. O CI do GitHub executa `pnpm verify:ci`, sem banco; integração e E2E precisam da verificação local antes do aceite da candidata.

O funcionamento do Actions, dos caches e da fila de deploy está no [guia de CI e staging](documentation/OPERATIONS.md#ci-e-staging).

Os testes nativos de backup executam o age real da imagem Docker `backup-crypto`, sem instalá-lo no computador. `pnpm setup:backup-tools` prepara identidades sintéticas temporárias e informa o JSON para `ADFL_TEST_BACKUP_TOOLS_CONFIG`; sem essa configuração, os casos nativos são ignorados. O CI faz essa preparação automaticamente. Depois de uma execução interrompida, confira o bloqueio e a identidade dos recursos antes de liberar uma reserva. Nunca exclua o volume para resolver um bloqueio.

Os relatórios do navegador ficam em `.work/playwright/report` e os traces e resultados em `.work/playwright/results`. São saídas geradas, fora do Git. O TypeScript não mantém cache incremental próprio; o pnpm gerencia seu armazenamento e cache padrão.

Os comprovantes ainda usados ficam em `.work/verification/evidence/index.json`: a referência de performance, a última verificação local e o recibo da limpeza. Caches, builds e relatórios podem ser recriados; remova-os com aplicação e testes parados. Preserve checkpoints pendentes até concluir o ensaio de recuperação. Permissões privadas protegem os arquivos para a identidade que os criou. Um clone novo gera seus próprios arquivos; copiar chaves privadas de outra conta não faz parte da instalação.

| Caminho                         | Função e decisão                                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.work`                         | Publicações persistidas, mídias e e-mails locais, comprovantes e saídas de execução. Neste checkout, também contém chaves e cópias de staging que precisam ser preservadas. |
| `ops`                           | Código de deploy, migrações, backup, recuperação e medição.                                                                                                                 |
| `scripts`                       | Gera o CSS de estados e supervisiona `dev`/`start`, protegendo o banco compartilhado.                                                                                       |
| `dependency-cruiser.config.cjs` | Regras de importação e dependências entre módulos, usadas pela verificação de arquitetura. Mantido.                                                                         |
| `compose.local.yaml`            | Sobe o único PostgreSQL local com volume persistente. Mantido.                                                                                                              |

## Documentação

Este README, [AGENTS.md](AGENTS.md) e os quatro arquivos de `documentation` são as fontes de regras, contratos e condições de lançamento do projeto. `AGENTS.md` mantém o contexto de trabalho do agente, as convenções e as instruções de verificação e commit. Código, testes e configurações implementam esses contratos; registros de execução servem como evidência.

| Assunto                                           | Referência                                      |
| ------------------------------------------------- | ----------------------------------------------- |
| Produto, contratos do CMS e referência visual     | [Especificação](documentation/SPECIFICATION.md) |
| Implementação e fluxos                            | [Arquitetura](documentation/ARCHITECTURE.md)    |
| Edição, deploy, backup, recuperação e performance | [Operação](documentation/OPERATIONS.md)         |
| Condições de lançamento e decisões pendentes      | [Pendências](documentation/PENDING.md)          |
