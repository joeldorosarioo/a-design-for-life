# Ambiente local — E1.1

Executar na raiz E:\a-design-for-life. Node global da máquina permaneceu 24.21.0. O runtime portátil verificado está em .toolchain/node-v24.22.2-win-x64, ignorado pelo Git. Em outro checkout, obter Node 24.22.2 pela distribuição oficial e conferir SHASUMS256.txt; os requisitos e hash desta máquina estão na decisão 001.

## Início local

```powershell
$env:PATH = (Join-Path (Get-Location) '.toolchain\node-v24.22.2-win-x64') + ';' + $env:PATH
node --version
pnpm --version
pnpm install --frozen-lockfile
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
```

Preencha o `.env` ignorado pelo Git com `PAYLOAD_SECRET` de pelo menos 32 caracteres e `DATABASE_URI` do banco de desenvolvimento na porta 5432. Para usar o bucket real, configure as variáveis R2 do modelo. O volume PostgreSQL existente chama-se `a-design-for-life-rebuild-postgres-data`. Em uma máquina nova, crie esse volume com `docker volume create a-design-for-life-rebuild-postgres-data`.

A consolidação de 05/11/2026 reutilizou o volume PostgreSQL existente no serviço `portfolio`. Para iniciar o ambiente de uso diário, execute o Compose.

```powershell
docker compose -f compose.local.yaml up -d --no-build --wait
```

Em uma máquina sem a imagem `adfl:local-alpine3.24`, use `--build` no lugar de `--no-build`.

O serviço `portfolio` reúne Next/Payload e PostgreSQL em um contêiner Alpine 3.24 com UID/GID 70, sem capabilities Linux adicionais. O Node é o PID 1 e encaminha o encerramento para os dois processos. A aplicação e o banco ficam acessíveis em loopback, respectivamente nas portas 3000 e 5432. Os dados do PostgreSQL e as raízes e caches do aplicativo ficam em volumes próprios.

Em um banco recém-inicializado, execute `pnpm migrate` no host antes de provisionar conteúdo. O runtime inicia o PostgreSQL e o Next e preserva o histórico de migrações existente. Use `pnpm provision:structural` para criar os perfis e a navegação iniciais como rascunhos. A publicação exige conteúdo editorial e uma conta provisionada.

As páginas públicas ficam em `http://localhost:3000/pt` e `http://localhost:3000/en`. O painel fica em `http://localhost:3000/admin`. Um banco sem perfil e navegação publicados devolve 404 nas páginas públicas. Durante o desenvolvimento do código, `pnpm dev` pode ser usado com o Next do contêiner parado e um PostgreSQL disponível na porta do `.env`.

## Conta editorial e conteúdo local

Defina `LOCAL_EDITOR_EMAIL` e `LOCAL_EDITOR_PASSWORD` somente no `.env` ignorado pelo Git. O comando abaixo cria a conta pela Local API autorizada. Uma conta com o mesmo e-mail preserva a senha e o registro existentes.

```powershell
$env:APP_ENV = 'local'
pnpm provision:editor
```

O painel em `http://localhost:3000/admin` usa essa conta e a autenticação nativa do Payload. O primeiro cadastro público segue bloqueado pelo hook editorial.

Por autorização do usuário em 05/11/2026, o ambiente recebeu Lorem ipsum, dois cases em PT/EN, as cinco imagens originais do layout e dois PDFs demonstrativos. Contatos e currículos são exemplos temporários. O conteúdo pode ser substituído pelo painel. [Registro da preparação local](../verification/artifacts/E3-local/local-runtime-lorem-001.json)

O e-mail usa captura local. O backup criptografado do ambiente pode ser gerado com `pnpm backup:local`. Os conjuntos ficam em `.work/backup-sets`; a identidade de recuperação fica separada em `.work/backup-keys/local.agekey`. O procedimento e a prova de restauração estão no [runbook de backup](backup-e-restauracao.md).

## Verificação

```powershell
pnpm test:unit -- src/config/server-env.test.ts
pnpm test:integration -- src/helpers/payload/users.collection.integration.test.ts
pnpm test
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.work\playwright-browsers'
pnpm exec playwright install chromium --only-shell
pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Vitest separa unidade, integração e arquitetura; não descobre arquivos Playwright. Execute a suíte completa com `VITEST_MAX_WORKERS` ausente. No Vitest 5, essa variável substitui a configuração serial do projeto de integração, cujos testes compartilham banco e diretórios descartáveis. O lifecycle de integração agora usa somente `compose.test.yaml`, projeto `adfl-isolated-tests-<UUIDv4>`, serviço `postgres-isolated`, PostgreSQL real em tmpfs e bind exclusivo `127.0.0.1:55434`. O banco é exatamente `adfl_test_runner`; bucket `adfl-test-runner` e root `.work/private-media/adfl-test-runner/adfl_test_runner` devem corresponder. O compose local e o PostgreSQL visual em 55433 ficam preservados.

Antes de qualquer consulta Docker, o runner adquire um lease exclusivo da porta55434 no diretório temporário do usuário, compartilhado entre checkouts e UUIDs. Mantém esse lease durante preflight, tentativa de criação, cleanup de início falho e teardown. Recusa projeto/container/rede existentes e verifica a disponibilidade da porta. O escopo é o mesmo usuário do sistema operacional nesta máquina, com diretório temporário compartilhado; não coordena outros usuários ou hosts que compartilhem um daemon Docker. `--project-name` e arquivo compose são explícitos: `COMPOSE_PROJECT_NAME` herdado não pode selecionar o ambiente visual. Um `TEST_DATABASE_URI` ou `TEST_MEDIA_BUCKET` diferente do namespace exato é recusado. Não apontar testes para outro PostgreSQL de loopback. O ambiente substitui storage/origem interna herdados e limpa configuração/credenciais externas de mídia, e-mail e Analytics antes de iniciar subprocessos.

Sob o lease, o runner registra a ausência prévia dos recursos. Depois da tentativa de criação, inclusive se ela falhar, confere labels de projeto/serviço/execução/finalidade/checkout/compose, nome, IDs imutáveis, imagem fixada, banco/usuário sintéticos, bind, tmpfs e rede exclusiva. Captura os IDs verificados uma única vez; cleanup usa somente esses IDs, sem descobrir/adotar recursos por nome. A limpeza revalida a identidade antes de cada stop/remove e remove somente recursos novos dessa execução. Divergências são falhas seguras; não geram adoção ou remoção automática de recursos desconhecidos. A prova de indisponibilidade de PostgreSQL usa disconnect/connect da rede e container próprios derivados desse lifecycle, com verificação antes e depois.

Playwright constrói Next em `NODE_ENV=production`/`APP_ENV=test` em `.work/next-tests/<UUIDv4>` e inicia o servidor usando a mesma configuração. O default HTTP é `127.0.0.1:3101`; `TEST_SITE_ORIGIN` pode selecionar outra origem HTTP local livre. `pnpm build`/`pnpm start` comuns usam `.work/next-build`; `.next` da prévia 008 não é substituído. `NEXT_TEST_DIST_DIR` só aceita o caminho de teste validado; caminhos absolutos, traversal, `.next`, `public` e ancestrais com symlink/junction são recusados. O roundtrip de migrações usa o mesmo lifecycle por `testing/migrations/editorial-roundtrip.ps1`.

`test:architecture` e o agregador `verify` existem, mas a suíte/regras de arquitetura só entram em E1.2. A ausência de testes arquiteturais não equivale a aprovação. E1.1 apresenta os comandos efetivamente executados e suas saídas, incluindo falhas.

## Parada e limpeza

```powershell
docker compose -f compose.local.yaml stop portfolio
```

Os testes encerram o processo HTTP próprio antes do callback de limpeza do banco. Uma execução interrompida pode deixar recursos/lease compartilhado da porta55434; inspecionar o UUID, checkout, token do lease, labels e IDs e resolver a interrupção de forma explícita antes de repetir. A base visual histórica na porta 55433 permanece fora do Compose local atual. Não executar `down --volumes`, drop de banco compartilhado ou limpeza global do Docker. O volume local persistente permanece preservado. Segredos, downloads e caches em `.env`/`.work`/`.toolchain` não são versionados. Serviços reais de e-mail/R2, homologação e produção exigem as autorizações da etapa correspondente.

## Verificação E2: fonte real e preservação da prévia

As jornadas `@resource` exercitam FontFace com bytes reais de uma fonte TrueType já instalada. Definir `READING_E2E_FONT_FILE` antes de `pnpm test:e2e`; sua ausência é falha de preparação, nunca RED comportamental. Nenhuma fonte é incorporada à aplicação ou copiada para `public`.

No Windows desta máquina, com o runtime portátil 24.22.2 já selecionado:

```powershell
$env:READING_E2E_FONT_FILE = 'C:\Windows\Fonts\arial.ttf'
Test-Path -LiteralPath $env:READING_E2E_FONT_FILE -PathType Leaf
Get-FileHash -LiteralPath $env:READING_E2E_FONT_FILE -Algorithm SHA256
pnpm test:e2e
```

Em Linux, selecionar uma TrueType legível instalada e registrar seu hash. A CI faz essa seleção com Fontconfig depois de instalar as dependências oficiais do Chromium; falha explicitamente caso não encontre um arquivo .ttf legível. A origem da seleção é a [documentação de padrões do Fontconfig](https://fontconfig.pages.freedesktop.org/fontconfig/fontconfig-user.html). Não há download de fonte pelo produto.

O risco histórico de reconstruir `.next` e remover `postgres-test`/55433 motivou o isolamento E3 descrito acima. Os runners atuais usam recursos novos próprios e output Next separado; não é necessário parar a prévia 008 para esses runners. A preservação continua obrigatória antes de qualquer comando externo que escreva em `.next` ou manipule o compose local. Preservar a instância de desenvolvimento na porta 5432 e a base visual histórica na porta 55433 durante os testes. Guarde originais, checkpoints e capturas históricas com seus recibos. Ver `artifacts/E3-isolation` para a evidência técnica e distinguir units de validação real PostgreSQL/Next.
