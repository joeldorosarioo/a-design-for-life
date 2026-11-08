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

Vitest separa unidade, integração e arquitetura; não descobre arquivos Playwright. Cada projeto de integração usa um contêiner PostgreSQL real temporário com tmpfs em 55433, aplica as migrações pelo CLI nativo e remove apenas esse serviço ao terminar. O subprocesso Docker recebe um placeholder sintético exclusivamente para satisfazer a interpolação do serviço local não selecionado; o segredo obrigatório desse serviço permanece obrigatório para iniciar o ambiente local.

Playwright prepara o mesmo banco isolado, constrói Next em NODE_ENV=production/APP_ENV=test, inicia o processo Next diretamente e aguarda HTTP real do painel. No encerramento, termina o processo próprio antes de remover o banco. TEST_SITE_ORIGIN pode alterar host/porta de loopback; o servidor deriva ambos e aceita somente HTTP local. TEST_DATABASE_URI exige banco local adfl_test__; TEST_MEDIA_BUCKET exige adfl-test-_. Configuração fora desses limites é recusada antes de iniciar/limpar recursos.

`test:architecture` e o agregador `verify` existem, mas a suíte/regras de arquitetura só entram em E1.2. A ausência de testes arquiteturais não equivale a aprovação. E1.1 apresenta os comandos efetivamente executados e suas saídas, incluindo falhas.

## Parada e limpeza

```powershell
# Ctrl+C encerra o servidor Next iniciado no terminal.
docker compose -f compose.local.yaml stop postgres-local
# Se for necessário remover apenas o serviço temporário de testes que sobrou de uma interrupção:
$env:LOCAL_POSTGRES_PASSWORD = 'synthetic-unused-local-service-placeholder'
docker compose -f compose.local.yaml rm --stop --force postgres-test
Remove-Item Env:\LOCAL_POSTGRES_PASSWORD
```

O último bloco afeta somente postgres-test deste compose. Não executar down --volumes, drop de banco compartilhado ou limpeza global do Docker. O volume local persistente permanece preservado. Segredos, downloads e caches em .env/.work/.toolchain não são versionados. Serviços reais de e-mail/R2, homologação e produção pertencem às etapas posteriores.
