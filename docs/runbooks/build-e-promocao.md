# Imagem única e promoção por digest

Escopo atual: preparação e validação **locais**, E3.4. A3/A4 continuam pendentes. Registry, VPS/Coolify e homologação real não foram escolhidos/disponibilizados; este procedimento não autoriza publicação externa nem lançamento. Os testes de metadados não equivalem a construir ou consumir a imagem.

## Contrato de empacotamento

- Base: `docker.io/library/node:24.22.2-trixie-slim@sha256:54f84b4cf8432b21aaffd5d3ce8d41e12cea0d10d33c09d2f3c9879d49d6b446`, índice oficial verificado em 03/11/2026. Manifesto linux/amd64: `sha256:e053394f15519046270b637f0655c284d2fc844e013451fcb36e02dcfba29280`.
- Plataforma validável nesta implementação: **linux/amd64**. O instalador existente de QPDF12.4.2 só tem distribuição Linux x64 verificada. A arquitetura da VPS futura ainda precisa ser confirmada; não promover para ARM64 por suposição.
- pnpm12.10.1 e lockfile congelado; nenhuma atualização de dependência durante build. A instalação de `unzip`/certificados ocorre apenas no builder Debian. O instalador existente verifica SHA256 do arquivo oficial QPDF e sua versão; a distribuição inteira é copiada para `/opt/qpdf`.
- Runtime com UID/GID10001, saída padrão, sem migração na inicialização, `node server.js`. Copia somente standalone rastreado, `public`, estáticos em `.work/next-build/static`, QPDF e dois probes operacionais. Preserva `distDir`, otimizador/autorização privada e headers existentes.
- `.dockerignore` usa allowlist. `.env`, `.work`, `.next`, `.toolchain`, dumps, checkpoints, originais privados e relatórios do host ficam fora do contexto. O suporte TypeScript sintético de `testing` entra apenas no builder para o typecheck dos testes adjacentes; não há cópia de fixture privada nem de binários de fixture. Tracing exclui esse suporte e dados privados.
- Somente valores sintéticos fixos no comando de build: loopback, banco `adfl_test_image_build` na porta9, bucket de teste e segredo descartável. Não aceitar segredos reais como build args. `SOURCE_REVISION` é o único argumento de configuração da aplicação exposto ao build; não recebe origem, credencial ou identificação GA.

## Build local coordenado

Executar na raiz, após proteger os serviços e congelar a fonte. O ensaio 004 usou Buildx no builder desktop-linux com o lockfile congelado, inspeção pelo ID imutável e smoke sem rede. Os recibos preservam o snapshot de fonte e o vínculo com as provas HTTP. [Verificação da imagem 004](../verification/artifacts/E3-image/docker-draft-build-004.json)

```powershell
# Rascunho honesto para fonte ainda não commitada. Não é candidata aprovada.
docker build --platform linux/amd64 --build-arg SOURCE_REVISION=draft-e3-local --tag adfl:e3-local-draft --progress plain .
if ($LASTEXITCODE -ne 0) { throw 'Build local falhou' }
$imageId = docker image inspect --format '{{.Id}}' adfl:e3-local-draft
node ops/image/inspect-local-image.mjs adfl:e3-local-draft $imageId draft-e3-local
if ($LASTEXITCODE -ne 0) { throw 'Inspeção de imagem falhou' }
docker run --rm --network none --entrypoint node $imageId ops/image/runtime-smoke.mjs
if ($LASTEXITCODE -ne 0) { throw 'Recursos nativos da imagem falharam' }
```

O smoke usa somente PDF/imagem sintéticos gerados em `/tmp`, verifica UID, QPDF, sharp, canvas nativo e PDF.js; não lê conteúdo editorial nem precisa de banco/rede. A prova HTTP/E2E real descrita no [runbook de homologação](homologacao.md) ainda é obrigatória.

Depois dos gates e de um commit coeso, uma candidata precisa ser construída do **commit exato e limpo**:

```powershell
$pending = git status --porcelain
if ($LASTEXITCODE -ne 0 -or $pending) { throw 'Candidata exige árvore limpa' }
$revision = git rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[a-f0-9]{40}$') { throw 'Commit inválido' }
docker build --platform linux/amd64 --build-arg "SOURCE_REVISION=$revision" --tag "adfl:commit-$revision" --progress plain .
if ($LASTEXITCODE -ne 0) { throw 'Build da candidata falhou' }
```

Repetir gates do consumidor para essa imagem. Mudanças posteriores exigem nova candidata e nova validação. Um rascunho sujo nunca recebe o SHA de um commit anterior como se representasse aquele commit.

## Recibos necessários

Registrar comandos, versões Docker/buildx, plataforma, SHA do commit, status limpo, referência da base, duração, códigos de saída e ID local. `inspect-local-image.mjs` retorna apenas nomes das variáveis, UID, labels, contagem de camadas e identidades; recusa configuração de execução embutida. Não registrar valores do ambiente privado ou `docker inspect` completo dos containers.

O ID local `sha256:...` é o digest da configuração da imagem. **Ele não é o digest de manifesto do registry.** Um build sem publicação pode não ter `RepoDigests`; esse vazio é esperado na prova local e não encerra a promoção real. A inspeção de metadados também não prova que todos os arquivos/camadas estejam livres de segredos. Antes de qualquer publicação autorizada, revisar o contexto efetivo e os arquivos de cada camada em exportação local controlada, além dos bundles/HTML; nunca anexar arquivos privados ou exportação bruta ao dossiê público.

## Publicação e promoção futuras

O [workflow manual de preflight](../../.github/workflows/release.yml) confere o SHA exato de `develop`, compila para Linux amd64, inspeciona a imagem pelo ID e roda o smoke nativo sem rede. O executor usa acesso de leitura ao repositório. O resultado é evidência de empacotamento local ao executor, separada do manifesto que o registry emitirá.

Sem registry escolhido, não há workflow com push automático nem publicação externa habilitada. Após escolha/autorização, publicar a candidata validada e registrar seu digest de manifesto. Homologação e candidata de produção devem referenciar exatamente o mesmo `repository@sha256:...`; `ops/verify-image.ts` compara os digests bem formados. Tag, inclusive tag de commit, não substitui digest. Não usar `latest`; não reconstruir durante promoção.

Antes da promoção real: comprovar staging autenticada, configuração mínima em execução, isolamento banco/bucket/cache/segredos, backup e migração controlada quando necessária. A4 e autorização de lançamento continuam necessárias. Rollback troca a imagem por digest compatível com o schema; não reverte dados automaticamente.

Referências de implementação: [Next standalone e tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Next self-hosting/configuração de execução](https://nextjs.org/docs/app/guides/self-hosting). Os padrões de tracing permanecem estreitos e estáticos conforme `bundle-analyzable-paths`; não há include da raiz inteira.
