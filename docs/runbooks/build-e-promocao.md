# Imagem única e promoção por digest

Escopo atual: validação local E3.4 e preparação da homologação privada. Em 05/11/2026, o usuário contratou uma VPS Hostinger, configurou o Coolify Atlas em `https://panel.joeldorosarioo.dev`, criou o projeto `a-design-for-life` com environment `staging` e escolheu GHCR privado em `ghcr.io/joeldorosarioo/a-design-for-life`. Forneceu credenciais separadas para baixar e publicar a imagem privada. A aplicação ainda precisa do digest de manifesto e da configuração real completa de staging. A3/A4 e lançamento em produção continuam pendentes. Os testes de metadados não equivalem a consumir a imagem na VPS.

## Contrato de empacotamento

- O build usa as imagens oficiais Node 24.22.2 e PostgreSQL 17.11 em Alpine 3.24. O Dockerfile fixa o digest de cada base.
- Plataforma validável nesta implementação: **linux/amd64**. A arquitetura da VPS futura ainda precisa ser confirmada; não promover para ARM64 por suposição.
- pnpm 12.10.1 usa o lockfile congelado. Um estágio separado compila QPDF 12.4.2 para musl a partir do arquivo oficial, com checksum SHA-256 fixado. O runtime recebe o executável e a licença.
- O runtime usa `USER appuser`, resolvido para UID/GID70 para preservar a propriedade dos volumes, saída padrão e `node server.js` para usar PostgreSQL externo. O Compose local seleciona o supervisor para iniciar PostgreSQL e Next juntos. As migrações seguem um comando separado. A aplicação mantém os estáticos em `.work/next-build/static`, o otimizador privado e os headers existentes.
- `.dockerignore` usa allowlist. `.env`, `.work`, `.next`, `.toolchain`, dumps, checkpoints, originais privados e relatórios do host ficam fora do contexto. O suporte TypeScript sintético de `testing` entra apenas no builder para o typecheck dos testes adjacentes; não há cópia de fixture privada nem de binários de fixture. Tracing exclui esse suporte e dados privados.
- Somente valores sintéticos fixos no comando de build: loopback, banco `adfl_test_image_build` na porta9, bucket de teste e segredo descartável. Não aceitar segredos reais como build args. `SOURCE_REVISION` é o único argumento de configuração da aplicação exposto ao build; não recebe origem, credencial ou identificação GA.

## Cotas e manutenção do host

A definição de `USER appuser` vale para o processo da aplicação e para o supervisor PostgreSQL/Next. O build instala as dependências como administrador somente nos estágios de montagem; ferramentas temporárias de criação de conta são removidas no mesmo `RUN`. A execução final conserva UID/GID70, com login de shell desativado. A inspeção de metadados e o smoke precisam comprovar nome e identidade efetiva antes de promover uma nova imagem.

O Compose local possui cotas ajustáveis de CPU/RAM, capabilities removidas e `no-new-privileges`. Ao criar o recurso em Coolify, configurar e inspecionar as cotas reais desse projeto; começar a avaliação com1CPU/2GiB e ajustar com medição da stack completa. Preservar capacidade para o sistema, Coolify e demais projetos. Builds continuam fora da VPS.

Antes de aplicar atualizações do host e Docker Engine, obter o inventário real de versões, recursos, atualizações de segurança disponíveis e workloads ativos. Preparar backup/restauração e uma janela de manutenção quando a atualização exigir reinício. Esse documento não comprova patch instalado nem autoriza reiniciar serviços de outros projetos. Atualizar bases fixadas por digest requer revisão, rebuild e nova validação; `--pull` não altera sozinho um digest fixo. [Boas práticas de build](https://docs.docker.com/build/building/best-practices/) e [limites de recursos](https://docs.docker.com/engine/containers/resource_constraints/).

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
Uma exportação `git archive` do commit exato também permite isolar a candidata de alterações locais preservadas. Nesse caso, registre o commit, o hash do arquivo exportado e os argumentos do build; nenhum arquivo não versionado, `.env` ou alteração da árvore de trabalho pode ser acrescentado à exportação.

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

O workflow continua somente de preflight, sem push automático. A publicação privada manual no GHCR selecionado usa o token de publicação por stdin; o token de leitura permanece separado para o Coolify. Antes do envio, verificar a visibilidade privada do package existente ou o padrão privado de criação; depois, reler a visibilidade e o digest do manifesto. Não enviar credenciais como argumentos de build nem injetar os tokens na aplicação. Publicar somente a candidata validada e registrar seu digest de manifesto. Homologação e candidata de produção devem referenciar exatamente o mesmo `repository@sha256:...`; `ops/verify-image.ts` compara os digests bem formados. Tag, inclusive tag de commit, não substitui digest. Não usar `latest`; não reconstruir durante promoção.

Antes da promoção real: comprovar staging autenticada, configuração mínima em execução, isolamento banco/bucket/cache/segredos, backup e migração controlada quando necessária. A4 e autorização de lançamento continuam necessárias. Rollback troca a imagem por digest compatível com o schema; não reverte dados automaticamente.

Referências de implementação: [Next standalone e tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Next self-hosting/configuração de execução](https://nextjs.org/docs/app/guides/self-hosting). Os padrões de tracing permanecem estreitos e estáticos conforme `bundle-analyzable-paths`; não há include da raiz inteira.
