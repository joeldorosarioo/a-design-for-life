# Homologação isolada e prova local da mesma imagem

E3 local foi retomada em 03/11/2026. Em 05/11/2026, a VPS Hostinger e o Coolify Atlas foram configurados pelo usuário; `https://panel.joeldorosarioo.dev` respondeu com TLS válido. O projeto `a-design-for-life` possui o environment `staging`. O GHCR privado contém a nova candidata `4eab005ab099d253d83a068c66a6d7948dfefb98`, construída e validada localmente com o fluxo de primeira inicialização. Este runbook ainda não registra deploy da aplicação na VPS nem prova integral de homologação. A3/A4 e produção seguem pendentes.

## Primeiro acesso editorial pelo navegador

Fluxo solicitado pelo usuário em 06/11/2026. O primeiro cadastro usa a tela Native do Payload; e-mail e senha são escolhidos no navegador. As credenciais LOCAL_EDITOR/STAGING_EDITOR do .env não participam deste modo.

1. Preparar somente o schema com `pnpm run initialize:staging --database CONFIRMED_DATABASE_NAME --mode prepare-first-access`. O modo exige staging privada em PG-only, catálogo vazio ou completo conhecido e túnel 55435; não lê o arquivo editorial .env nem cria conta/drafts. Em staging, as 16 migrações já foram aplicadas e a leitura independente confirmou 0 usuários/0 perfis/0 navegações. O recibo é `pending-first-access`, com editorId null.
2. Usar a candidata que inclui a flag `EDITORIAL_FIRST_ACCESS_ENABLED`, mantendo a proteção HTTP Basic e HTTPS da homologação. Em **General → Build & deploy → Image**, o campo **Image** contém somente `ghcr.io/joeldorosarioo/a-design-for-life`; **Tag** recebe `sha256-<digest atual>`. A referência publicada desse fluxo é registrada na seção da candidata após validação.
3. Em **Environment Variables**, atualizar `STAGING_DATABASE_ONLY=false` e acrescentar `EDITORIAL_FIRST_ACCESS_ENABLED=true`, ambos somente Runtime. Manter `PUBLIC_SITE_ENABLED=false`, workers desativados e o CMD health existente. Salvar e fazer redeploy com os mesmos volumes e **Consistent name (no rolling updates)**, para haver apenas um processo PostgreSQL por volume.
4. Abrir `/admin/create-first-user` no domínio privado, passar pela autenticação de homologação (`staging-review`) e preencher e-mail, nova senha e confirmação no formulário Native. O servidor aceita somente esse primeiro cadastro, com Origin válida e lock transacional; a conta e os 4 rascunhos PT/EN são gravados juntos. Após a primeira conta, o cadastro inicial fecha automaticamente; criação anônima genérica permanece recusada.
5. Após criar a conta, entrar normalmente em `/admin/login` com as credenciais escolhidas. O fluxo mantém a política sem JWT no JSON e a sessão em cookie HttpOnly. Na versão fixada, o primeiro cadastro não garante auto-login; o login Native comum completa a sessão. Conteúdo demonstrativo e publicação dos rascunhos são passos posteriores.

[Provas do fluxo e do schema real](../verification/artifacts/E3-operations/browser-first-access-001.json). O modo antigo `initialize` continua disponível para provisionamento por operador, mas não é o caminho escolhido para esta primeira conta.

## Prova local antes de contratar

O responsável coordena a execução para preservar compilação008, prévia atual, fixture V5 e PostgreSQL visual55433, além de5432/55432. Não iniciar serviços/gates globais em paralelo ou reutilizar bancos/containers existentes por conveniência. Reservar portas e nomes próprios após inspeção atual; não copiar `.env` do host para a imagem.

Usar o **mesmo ID da imagem local** em dois containers com nomes/portas, bancos, origens e volumes separados. Ambos usam `APP_ENV=local`, captura de e-mail local e armazenamento local; isso exercita configuração em execução sem chamar R2, Resend ou Google. Essas configurações locais não simulam aprovação de `staging`/`production`, que exigem integrações reais. Deixar `PUBLIC_SITE_ENABLED` ausente ou `false`, sem Analytics real.

Fornecer via `--env-file` privado somente a configuração de execução necessária: segredo Payload próprio, URI de banco isolado, `APP_ENV=local`, `SITE_ORIGIN` de loopback correspondente à porta publicada, `INTERNAL_HTTP_ORIGIN=http://127.0.0.1:3000`, bucket/local storage próprios. Não passar esse arquivo ao build ou incluí-lo no Git/dossiê. Não reutilizar credenciais/volume/namespace entre as duas configurações.

Montagens por container, com permissões UID/GID 70:

| Destino                       | Finalidade                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `/app/.work/publication`      | Publicação confirmada persistente, internamente separada por ambiente/origem/banco |
| `/app/.work/next-build/cache` | Cache do otimizador, exclusivo desse ambiente                                      |
| `/app/.work/private-media`    | Apenas prova local com armazenamento em disco                                      |
| `/app/.work/editorial-mail`   | Apenas captura de recuperação local, se usada                                      |

**Nunca montar `/app/.work` inteiro:** isso esconderia a aplicação compilada em `.work/next-build`. Não compartilhar caches/volumes entre ambientes. Na implantação real, mídias são privadas no R2; banco e bucket têm credenciais distintas por ambiente. As necessidades finais de persistência/recuperação seguem a prova E3.2, sem considerar o cache como autorização de acesso.

Executar primeiro o smoke sem rede descrito em [build e promoção](build-e-promocao.md). Depois, para cada container da mesma imagem:

1. Comprovar `/health`: HTTP200 com somente `{"status":"ready"}`. O probe Node usa timeout4s; proposta Docker30s/timeout5s/três falhas/start30s precisa ser medida. Não executar consultas de banco/R2 nesse endpoint.
2. Conferir usuário/processo real e registrar somente campos seguros. Sem migração automática na inicialização. Migração/provisionamento de fixture sintética ocorrem em etapa separada controlada, no banco próprio.
3. Exercitar `/admin`, API, CSS/JS estáticos, rotas públicas confirmadas, origens dos metadados/URLs e políticas `robots`/headers. Primeiro ambiente não pode aparecer nos HTML/manifestos/bundles/respostas do segundo, nem o inverso. Procurar também o valor sintético do build e marcadores de segredos de teste, sem anexar valores privados.
4. Testar mídia válida, acesso privado, derivados/otimizador autorizado e PDF pelo consumidor real. QPDF/sharp/canvas/PDF.js apenas importáveis não substituem a jornada completa. Confirmar negativa após revogação, inclusive com cache aquecido.
5. Inspecionar rede/cookies/storage: nenhum pedido real ao Google/Resend/R2 e nenhuma medição no ambiente local. Comparar o campo ID local dos dois containers; ambos devem apontar ao mesmo ID, sem rebuild.
6. Reiniciar cada container e repetir conteúdo confirmado/persistência e isolamento. Guardar recibos por configuração, imagem e dataset. Não declarar prova real de homologação ou encerrar E3.4 por esses resultados locais.

## Ensaio local observado

A imagem 004 passou 82 verificações HTTP em dois bancos descartáveis com `APP_ENV=test` e origens canônicas distintas. Os processos usaram redes e montagens do runner isolado. As origens 3103 e 3104 eram metadados e os contêineres de aplicação ficaram sem portas publicadas no host. As verificações foram repetidas depois de reiniciar cada instância com o mesmo ID de imagem. Painel, API, imagens, PDF e rotas confirmadas PT/EN passaram. Os quatro inícios tiveram estado saudável e probe embutido com saída 0. [Recibo do ensaio](../verification/artifacts/E3-image/http-973f5053-f16b-4c9a-b183-8470d9719ebf/run.json)

O Playwright local teve 116 testes aprovados com o Next compilado para produção. A prova do navegador usando a imagem Linux é uma execução própria. Os snapshots e resultados de cada consumidor seguem em seus recibos.

## Candidata pronta para a primeira inicialização

Revisão `4eab005ab099d253d83a068c66a6d7948dfefb98`. A mesma imagem passou no modo PostgreSQL-only e no modo HTTP como `appuser`, UID/GID 70, e está disponível no GHCR privado. O import `.work/coolify-staging/staging-variables.txt` contém 25 variáveis, incluindo Resend e `STAGING_DATABASE_ONLY=true`, com os valores anteriores preservados. [Recibo da candidata](../verification/artifacts/E3-image/staging-bootstrap-candidate-4eab005-001.json).

No recurso existente **a-design-for-life → staging → portfolio-staging**:

1. Em **General → Docker Registry**, manter **Docker Image** como `ghcr.io/joeldorosarioo/a-design-for-life` e preencher **Docker Image Tag or Hash** com `sha256-4929f8965a0e6d3ce71c6b33681e3620c1c1be0333b2299531b3efe4b529ea40`. Salvar. Esse é o digest de manifesto do registry; o ID local 82e551 não deve ser usado nesse campo. [Formato do Coolify](https://coolify.io/docs/applications/deployments/docker-image#change-the-deployed-image).
2. Em **Environment Variables**, acrescentar `STAGING_DATABASE_ONLY=true`, com **Build time: Not available during build** e **Runtime: Available in the container**. Manter as 24 variáveis já configuradas. O arquivo privado completo é a referência para os comandos do host; não publicar seu conteúdo.
3. Em **Health Checks**, usar o comando **CMD** `node /app/ops/image/health-probe.mjs`, salvar e habilitar. Durante esta fase, a prontidão confirma somente o PostgreSQL; Next/HTTP 3000 ainda não iniciam.
4. Conferir as configurações já preparadas: supervisor `--entrypoint "node /app/ops/image/start-local-stack.mjs"`, capabilities removidas, `no-new-privileges`, **1 CPU/2 GiB**, volumes próprios de PGDATA/publicação/cache e **Consistent name (no rolling updates)**. A porta exposta da aplicação permanece 3000; 5432 fica sem mapeamento no host. Manter a autenticação privada no proxy.
5. Clicar em **Deploy** para iniciar o recurso em modo PostgreSQL-only e conferir os logs. Em seguida, executar o bootstrap por SSH conforme os cinco passos abaixo. A execução na VPS exige verificar o IP privado real do novo contêiner e o acesso SSH; este recibo local não a presume.

## Preparar a primeira inicialização na VPS

Este procedimento prepara somente homologação privada. Não registra execução na VPS nem encerra A3/A4.

**Atenção à imagem:** a revisão `196bfad427880ad91b0605d9f55f6b8dd711278a`, cujo digest publicado começa por `sha256:697`, não contém este fluxo. Não ativar a flag nessa candidata antiga. É necessária uma **nova candidata validada**, contendo `start-local-stack.mjs`, `health-probe.mjs` e `staging-mode.mjs`. Uma prova com fontes montadas sobre a imagem antiga não comprova o empacotamento da nova candidata.

1. **Preparar a candidata e os arquivos privados.** Registrar o novo `repository@sha256:...` completo, plataforma e revisão. Manter no checkout do computador operador o arquivo `.work/coolify-staging/staging-variables.txt`, com a mesma origem, banco e integrações reais de R2/Resend que serão usados no Coolify. O `.env` desse checkout fornece somente as credenciais editoriais ao CLI: `STAGING_EDITOR_EMAIL`/`STAGING_EDITOR_PASSWORD`, quando definidos, ou o par `LOCAL_EDITOR_EMAIL`/`LOCAL_EDITOR_PASSWORD`. Não importar esse `.env` inteiro na VPS.

2. **Iniciar somente o PostgreSQL do recurso de staging.** Na nova candidata, usar `STAGING_DATABASE_ONLY=true`, `APP_ENV=staging` e todas estas flags explicitamente `false`: `PUBLIC_SITE_ENABLED`, `PUBLICATION_RETRIES_ENABLED`, `PUBLICATION_RETRY_WORKER_ENABLED` e `PUBLICATION_HTTP_VERIFICATION_ENABLED`. Aplicar os mesmos valores ao arquivo privado e ao Coolify. O supervisor deve ser `node /app/ops/image/start-local-stack.mjs`; para Docker Image, a opção de entrypoint é `--entrypoint "node /app/ops/image/start-local-stack.mjs"`. Manter volumes exclusivos em `/var/lib/postgresql/data`, `/app/.work/publication` e `/app/.work/next-build/cache`, com acesso UID/GID 70. Não publicar a porta 5432 no host. Configurar healthcheck **CMD** como `node ops/image/health-probe.mjs`, ou comprovar que esse check é herdado da imagem. [Entrypoint no Coolify](https://coolify.io/docs/applications/builds/custom-docker-options), [healthchecks](https://coolify.io/docs/applications/configuration/health-checks). Nesta fase, não há Next nem HTTP na porta 3000; health positivo significa apenas PostgreSQL pronto.

3. **Encaminhar o banco pelo SSH.** Confirmar no server do Coolify a identidade do contêiner deste recurso e seu IP privado atual. Abrir no computador operador um túnel SSH de **`127.0.0.1:55435` para esse IP privado, porta 5432**, mantendo a sessão aberta. Usar o acesso SSH confirmado da VPS; o endereço público do painel não é o destino PostgreSQL. A porta 55435 deve estar livre no computador operador. Nenhum banco ou porta pública é presumido por este roteiro.

4. **Executar e verificar o bootstrap pelo checkout do host.** Na raiz do projeto, substituir `CONFIRMED_DATABASE_NAME` abaixo pelo nome exato do banco identificado no arquivo privado. O CLI mantém esse nome e encaminha a conexão internamente para `127.0.0.1:55435`:

   ```bash
   pnpm run initialize:staging --database CONFIRMED_DATABASE_NAME --mode initialize
   pnpm run initialize:staging --database CONFIRMED_DATABASE_NAME --mode verify
   ```

   Conferir `.work/coolify-staging/initialization-receipt.json`: alvo/origem esperados, **16 migrações**, conta editorial identificada e **4 documentos estruturais** PT/EN. A verificação deve preservar a mesma conta e os mesmos documentos. Se o CLI recusar o alvo, manter PG-only ativo e investigar; não limpar tabelas nem contornar as guardas.

5. **Ativar a aplicação na mesma nova candidata.** Após recibo válido, R2/Resend configurados e acesso privado protegido no proxy, alterar `STAGING_DATABASE_ONLY=false` **tanto no arquivo privado quanto nas variáveis do Coolify**. Salvar e fazer redeploy do **mesmo novo digest**, sem rebuild. O supervisor passa a iniciar Next depois do PostgreSQL e o CMD de saúde volta a exigir `/health` HTTP200 com somente `{"status":"ready"}`. Verificar login editorial e prosseguir com a população controlada de conteúdo; os quatro rascunhos estruturais ainda não constituem portfólio publicado.

## Conteúdo demonstrativo após o bootstrap

Depois de confirmar o recibo de inicialização e ativar `STAGING_DATABASE_ONLY=false` no arquivo privado e no Coolify, usando o mesmo digest:

1. Confirmar o IP privado atual do contêiner após o redeploy. Abrir um túnel SSH de `127.0.0.1:55436` para esse IP, porta 3000; manter a sessão aberta. O seed usa essa conexão privada e a sessão editorial Native, com a origem de staging configurada.
2. No checkout do operador, executar `pnpm run seed:staging --database CONFIRMED_DATABASE_NAME`, substituindo o marcador pelo banco exato do import privado. O comando lê somente a conta editorial do .env e os originais aprovados do plano local; gera os PDFs Lorem ipsum e publica pelo mesmo fluxo Native do CMS.
3. Conferir `.work/coolify-staging/lorem-seed-receipt.json`: 7 mídias, 2 identidades de case, 8 documentos localizados e 10 rotas verificadas. O checkpoint privado permite repetir o comando; dados editoriais modificados são recusados, em vez de substituídos.
4. Abrir o domínio temporário autenticado e revisar PT/EN. O conteúdo continua demonstrativo, com `PUBLIC_SITE_ENABLED=false`, sem Analytics ou indexação. A entrega real por R2/staging recebe evidência própria; a prova HTTP local usou arquivos sintéticos.
5. Guardar os recibos sem anexar credenciais, cookies ou arquivos privados ao Git. O envio real de recuperação por Resend tem autorização específica e não faz parte desses comandos.

## Homologação real pendente

Depois de serviços/custos apresentados e recursos autorizados: TLS, acesso autenticado antes da aplicação, sem indexação nem Analytics, origem real própria e URL privada do painel. Health de loopback deve continuar acessível ao probe interno sem expor diagnósticos detalhados. Confirmar regra de autenticação para HTTP/E2E e ausência de vazamento de conteúdo antes de liberar qualquer acesso externo.

Staging e produção exigem R2 privado e Resend completos no ambiente privado; não preencher valores fictícios para passar validação. Nenhum envio real de recuperação está autorizado neste preparo. Não ativar `PUBLIC_SITE_ENABLED=true` em candidata privada. A configuração pública sai do servidor como DTO mínimo; origem/GA não usam `NEXT_PUBLIC_*` nem rebuild por ambiente.

Os logs vão para stdout/stderr com redaction da aplicação. Aplicar/medir a proposta de rotação Docker `json-file`, `max-size=10m`, `max-file=3` no ambiente real antes de aceitá-la; registrar logs de implantação e execução separadamente. Banco/R2 têm diagnóstico protegido separado da prontidão. Migrações, backup e rollback seguem os runbooks operacionais correspondentes e suas autorizações; sem migração destrutiva ou reversão de dados implícita.

Aceite futuro exige E2E contra a imagem Linux candidata, `pnpm verify` protegido, inspeção de processos/arquivos/camadas, digest imutável do registry autorizado e mesma imagem na futura produção. A pendência NVDA E2.6.2 permanece registrada e não implica conformidade WCAG.
