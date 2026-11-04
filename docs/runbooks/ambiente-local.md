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

Preencher .env localmente antes de iniciar: PAYLOAD_SECRET aleatório com pelo menos 32 caracteres, LOCAL_POSTGRES_PASSWORD aleatório e o mesmo valor na credencial de DATABASE_URI, além de SITE_ORIGIN e MEDIA_BUCKET locais. Não imprimir/copiar esses valores para logs ou relatórios. Nesta execução os valores foram gerados criptograficamente e salvos apenas no .env ignorado. Nenhum segredo real está no exemplo.

```powershell
docker compose -f compose.local.yaml up -d --wait postgres-local
pnpm migrate
pnpm dev
```

Abrir http://127.0.0.1:3000/admin. O PostgreSQL do projeto usa 55432 e volume próprio. Não modificar o container alheio na porta 5432. `push:false` evita alteração automática do schema; as migrações são executadas explicitamente pelo mecanismo nativo.

## Conta sintética local

O primeiro cadastro público é bloqueado também no hook, pois o endpoint nativo first-register ignora access.create. A conta sintética usada na prova foi provisionada pela Local API em processo controlado, com contexto trustedAccountProvisioning explícito. O login real usa o fluxo nativo; não existe autenticação paralela.

Para reproduzir a preparação local, definir LOCAL_EDITOR_EMAIL e LOCAL_EDITOR_PASSWORD somente no .env ignorado, usar domínio .invalid para dados sintéticos e executar a mesma Local API em contexto de operador. Não passar senhas como argumentos ou registrá-las no relatório. O provisionamento de duas contas editoriais e recuperação completa é entregue em E1.7; esta base não promete esse fluxo completo.

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

Vitest separa unidade, integração e arquitetura; não descobre arquivos Playwright. O lifecycle de integração agora usa somente `compose.test.yaml`, projeto `adfl-isolated-tests-<UUIDv4>`, serviço `postgres-isolated`, PostgreSQL real em tmpfs e bind exclusivo `127.0.0.1:55434`. O banco é exatamente `adfl_test_runner`; bucket `adfl-test-runner` e root `.work/private-media/adfl-test-runner/adfl_test_runner` devem corresponder. O compose local e o PostgreSQL visual em 55433 ficam preservados.

Antes de qualquer consulta Docker, o runner adquire um lease exclusivo da porta55434 no diretório temporário do usuário, compartilhado entre checkouts e UUIDs. Mantém esse lease durante preflight, tentativa de criação, cleanup de início falho e teardown. Recusa projeto/container/rede existentes e verifica a disponibilidade da porta. O escopo é o mesmo usuário do sistema operacional nesta máquina, com diretório temporário compartilhado; não coordena outros usuários ou hosts que compartilhem um daemon Docker. `--project-name` e arquivo compose são explícitos: `COMPOSE_PROJECT_NAME` herdado não pode selecionar o ambiente visual. Um `TEST_DATABASE_URI` ou `TEST_MEDIA_BUCKET` diferente do namespace exato é recusado. Não apontar testes para outro PostgreSQL de loopback. O ambiente substitui storage/origem interna herdados e limpa configuração/credenciais externas de mídia, e-mail e Analytics antes de iniciar subprocessos.

Sob o lease, o runner registra a ausência prévia dos recursos. Depois da tentativa de criação, inclusive se ela falhar, confere labels de projeto/serviço/execução/finalidade/checkout/compose, nome, IDs imutáveis, imagem fixada, banco/usuário sintéticos, bind, tmpfs e rede exclusiva. Captura os IDs verificados uma única vez; cleanup usa somente esses IDs, sem descobrir/adotar recursos por nome. A limpeza revalida a identidade antes de cada stop/remove e remove somente recursos novos dessa execução. Divergências são falhas seguras; não geram adoção ou remoção automática de recursos desconhecidos. A prova de indisponibilidade de PostgreSQL usa disconnect/connect da rede e container próprios derivados desse lifecycle, com verificação antes e depois.

Playwright constrói Next em `NODE_ENV=production`/`APP_ENV=test` em `.work/next-tests/<UUIDv4>` e inicia o servidor usando a mesma configuração. O default HTTP é `127.0.0.1:3101`; `TEST_SITE_ORIGIN` pode selecionar outra origem HTTP local livre. `pnpm build`/`pnpm start` comuns usam `.work/next-build`; `.next` da prévia 008 não é substituído. `NEXT_TEST_DIST_DIR` só aceita o caminho de teste validado; caminhos absolutos, traversal, `.next`, `public` e ancestrais com symlink/junction são recusados. O roundtrip de migrações usa o mesmo lifecycle por `testing/migrations/editorial-roundtrip.ps1`.

`test:architecture` e o agregador `verify` existem, mas a suíte/regras de arquitetura só entram em E1.2. A ausência de testes arquiteturais não equivale a aprovação. E1.1 apresenta os comandos efetivamente executados e suas saídas, incluindo falhas.

## Parada e limpeza

```powershell
# Ctrl+C encerra o servidor Next iniciado no terminal.
docker compose -f compose.local.yaml stop postgres-local
```

Os testes encerram o processo HTTP próprio antes do callback de limpeza do banco. Uma execução interrompida pode deixar recursos/lease compartilhado da porta55434; inspecionar o UUID, checkout, token do lease, labels e IDs e resolver a interrupção de forma explícita antes de repetir. Não executar `compose.local.yaml rm postgres-test`: esse serviço contém a base visual preservada em 55433. Não executar `down --volumes`, drop de banco compartilhado ou limpeza global do Docker. O volume local persistente permanece preservado. Segredos, downloads e caches em `.env`/`.work`/`.toolchain` não são versionados. Serviços reais de e-mail/R2, homologação e produção exigem as autorizações da etapa correspondente.

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

O risco histórico de reconstruir `.next` e remover `postgres-test`/55433 motivou o isolamento E3 descrito acima. Os runners atuais usam recursos novos próprios e output Next separado; não é necessário parar a prévia 008 para esses runners. A preservação continua obrigatória antes de qualquer comando externo que escreva em `.next` ou manipule o compose local. Manter 5432/55432/55433 intactos e não substituir originais/checkpoints/capturas históricos por evidência nova. Ver `artifacts/E3-isolation` para a evidência técnica e distinguir units de validação real PostgreSQL/Next.
