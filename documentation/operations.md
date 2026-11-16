# Operação

Confira as [condições de lançamento](pending.md#condições-de-lançamento) antes de operar e vincule os recibos à fonte e à imagem escolhidas.

Migrações e operações em produção/staging precisam de escopo e autorização específicos. A limpeza de dados locais entre testes está autorizada. Compras, contratação, aumento de recursos e novos serviços exigem aprovação quando forem necessários. Rollback de imagem não reverte dados.

## Edição e acesso

Entre em `/admin` com sua conta individual. O painel usa português como padrão e permite inglês em **Payload Settings → Language**. O campo de idioma do documento define a edição pública que você está editando.

| Área                      | Conteúdo                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Navegação**             | Textos, links e ações do cabeçalho e rodapé. Contatos e currículo vêm do perfil publicado no idioma.                |
| **Perfil profissional**   | Home, Sobre, imagens, e-mail, LinkedIn e currículo PDF. Defina alternativas, decoração e legendas por uso e idioma. |
| **Projetos**              | Identidade e informações compartilhadas do projeto.                                                                 |
| **Conteúdo dos projetos** | Slug, textos, imagens e metadados de cada tradução.                                                                 |
| **Mídias**                | Arquivos e nomes internos. O acesso público depende de referência publicada e confirmada.                           |

Salve o rascunho e confira a prévia autenticada. Ao publicar, verifique a confirmação e a página no idioma editado. Uma atualização pendente pode manter a edição confirmada anterior. Restaurar uma versão cria um rascunho para revisão.

Use **Minha conta** para alterar acesso e idioma do painel. O nome e o retrato públicos ficam no **Perfil profissional**. A recuperação de senha usa o fluxo nativo do Payload. Local e testes capturam mensagens privadas em `.work/editorial-mail`.

Para testar entrega real, confira domínio, remetente e os segredos `RESEND_API_KEY`, `EDITORIAL_EMAIL_FROM_ADDRESS` e `EDITORIAL_EMAIL_FROM_NAME`. Execute na janela autorizada, com destinatário anuente. Proteja mensagens, tokens e URLs de recuperação.

A importação editorial de staging valida o conteúdo e os ativos aprovados. Declare `STAGING_SEED_PLAN` e `STAGING_SEED_ASSETS_ROOT` no arquivo privado do editor. Os caminhos respeitam as verificações de propriedade e integridade.

## Outra máquina e arquivos privados

Prepare a nova cópia conforme o [uso local](../README.md#uso-local). Os usuários de execução e a proteção dos arquivos privados estão descritos na [arquitetura](architecture.md#ambientes-e-identidade).

Use credenciais locais novas e mantenha as permissões restritas ao usuário responsável. Resolva falhas de acesso conferindo dono e ACL do arquivo. Copiar chaves privadas antigas ou conceder acesso a `Everyone` para fazer um comando funcionar compromete essa proteção.

Cópias de dependências, caches e builds podem ser regeneradas. Preserve o Chromium em uso, dados de mídia/publicação, e-mails privados, backups, chaves e checkpoints de recuperação. Antes de limpar, confira os consumidores e a identidade de cada caminho.

Registre os recibos no índice privado `.work/verification/evidence/index.json`.

## CI e staging

O [Checks](../.github/workflows/checks.yml) roda `pnpm verify:ci` sem banco nos PRs e por acionamento manual. As branches protegidas exigem o check aprovado e atualizado antes do merge. Depois do merge em `develop`/`main`, o [Deploy](../.github/workflows/release.yml) executa somente a publicação configurada, sem repetir o CI. Um novo commit cancela o check anterior do mesmo PR. Deploys mantêm uma fila separada por branch até a saúde e o marcador, sem cancelamento.

Tipos, lint, formato, unidades, arquitetura, scripts e build são verificados em cada execução. Integração, E2E e recuperação usam o banco local fixo e exigem evidência vinculada à fonte da candidata.

O fluxo `develop → staging` constrói uma imagem Linux amd64, inspeciona sua identidade, executa o smoke com restrições e publica no GHCR privado. Buildx guarda camadas intermediárias em `build-cache`, no mesmo package privado, depois de conferir a visibilidade. Essa tag serve ao cache. Ausência de cache executa o build completo e falha na exportação permite continuar com a imagem verificada.

Antes de habilitar `STAGING_AUTODEPLOY_ENABLED`, confira recurso, banco, buckets R2 privados, volumes, namespaces, flags, capacidade e digest anterior compatível. Separe as credenciais de publicação/deploy das de backup/mídia. Confirme a árvore exata em `APPROVED_MIGRATION_TREE`.

A troca exige backup novo, completo, criptografado e verificado, com os volumes preservados. Depois, confira o mesmo manifesto no recibo do workflow, marcador e imagem em execução. Verifique saúde, PT/EN, painel, mídias, raiz pública, negativa anônima, `noindex` e Analytics desligado. Guarde os recibos de release, backup e rollback. O aceite visual e de performance segue as pendências da candidata.

## Promoção e lançamento

O lançamento exige autorização expressa da candidata, alvo, responsáveis e janela. Antes de habilitar `PRODUCTION_AUTODEPLOY_ENABLED`, confira branch protegida, environment, fonte, backup e janela de escrita. Conteúdo, configuração externa, e-mail, dependências e demais condições ficam nas pendências.

Produção resolve o marcador homologado pela árvore Git inteira. Para mudanças exclusivamente documentais depois da candidata aprovada, configure juntas `APPROVED_STAGING_REVISION` e `APPROVED_IMAGE_DIGEST`, com aprovação explícita do commit e manifesto.

O resolver admite arquivos regulares de `README.md`, `AGENTS.md` e `documentation/**`. Confere marcador, revisão e digest. Código, ativos, dependências, configuração, CI e operação exigem nova candidata. Aprovação incompleta, antiga ou divergente encerra a resolução. Ao homologar outra imagem, atualize as duas variáveis ou limpe ambas. CI corrente, backup e migrações continuam exigidos. [Resolver](../ops/deploy/registry.mjs).

1. Mantenha produção privada com `SITE_ORIGIN` HTTPS aprovado, `APP_ENV=production`, `PUBLIC_SITE_ENABLED=false`, autenticação de proxy e `X-Robots-Tag: noindex, nofollow`. Comprove a negativa anônima.
2. Registre digest anterior compatível, catálogo, volumes e raiz pública. Confira origem, manifesto, releitura do ciphertext, tamanhos, hashes e conclusão do backup novo.
3. Compare catálogo e `APPROVED_MIGRATION_TREE`. Suspenda escritores para uma migração autorizada. Pare em caso de divergência, falha de backup ou DDL destrutivo sem aprovação.
4. Promova o mesmo manifesto, sem rebuild. Confira digest, usuário, limites, volumes, cache, saúde e logs.
5. Ainda em privado, confira TLS, SSR PT/EN, canonical/alternates, mídias/PDFs, login e negativas de rascunhos, prévias e bytes privados. Teste e-mail na janela autorizada. Suítes e injeções de falha usam os recursos locais/de staging previstos para testes.
6. Abra na janela aprovada. Registre horário e digest, retire as restrições temporárias e confira HTTP, sitemap, robots e URLs na origem final. Use HEAD/GET pontuais e bloqueie Google nas inspeções sintéticas e manuais.

Mantenha Analytics com `loadScript=null` até concluir a condição específica nas [pendências](pending.md#decisões-e-ações-condicionais). A [política de Analytics](specification.md#seo-e-analytics) rege a ativação e a exclusão de tráfego sintético/editorial.

## Backup e recuperação

O [README](../README.md#verificação) define os três bancos fixos e seu uso. Antes de testar ou recuperar no banco local, faça backup do que quiser guardar e preserve o volume e as identidades do banco e contêiner.

### Backup local

Mantenha PostgreSQL disponível e pare desenvolvimento, testes e outros clientes. Prepare as ferramentas na primeira execução.

```sh
docker build -f ops/backup/Dockerfile -t adfl:backup-local .
pnpm setup:backup-tools
pnpm backup:local
```

Refaça o build quando a verificação de dependências solicitar. `backup:local` adquire a reserva, monta fontes e dados somente para leitura e registra sua identidade. Lê publicação e mídia local ou R2 da fonte. Os conjuntos criptografados ficam em `.work/backup-sets`. Guarde a identidade age separada dos conjuntos.

### Backup de staging

Use a tarefa Coolify autorizada `encrypted-full-backup` ou o contêiner da aplicação como `appuser`. Confira recurso, banco, volume, namespace, credenciais próprias do backup, `OPS_BACKUP_RECIPIENT` e `OPS_BACKUP_SOURCE`.

O destino remoto é um bucket R2 privado e exclusivo para backups, separado das mídias e fora da VPS.

```sh
node --conditions=react-server src/backup-runtime.mjs backup
```

Mantenha `PUBLIC_SITE_ENABLED`, `PUBLICATION_RETRIES_ENABLED`, `PUBLICATION_RETRY_WORKER_ENABLED` e `PUBLICATION_HTTP_VERIFICATION_ENABLED` em `false`, com schema drop desativado. Confira a agenda semanal e o fuso efetivos. Acrescente backup antes de atualizações e migrações. [Guardas do job](../ops/backup/job-settings.ts).

O conjunto completo inclui dump PostgreSQL custom consistente, raiz pública confirmada e mídias necessárias. Confira origem, manifesto, tamanhos, hashes, conclusão e releitura do destino. Retenha os conjuntos completos por **56 dias**. Somente conjuntos completos permitem limpeza de retenção. Guarde a identidade age fora da VPS, imagem, Git e bucket. Produção exige executor próprio validado.

### Ensaio de recuperação

1. Suspenda escritores e preserve dados, volumes, logs e backups originais. Confira o ciphertext e descriptografe o conjunto completo em quarentena privada.
2. Pare o desenvolvimento e adquira a reserva do banco local. Faça checkpoint antes de substituir o schema e restaure no schema preparado do mesmo banco.
3. Se o ensaio precisar ler a mídia R2 da fonte, habilite essa opção explicitamente na configuração. Use a conexão e o papel PostgreSQL do banco local configurado. O acesso R2 permanece somente para leitura e os arquivos recuperados ficam locais.
4. Antes da leitura pública recuperada, prepare o snapshot junto de `current.json` com `pinPublicRoot(directory, capturedRoot)`.
5. Confira schema, rotas, raiz pública, hashes de mídia, PT/EN, login e recuperação de acesso com e-mail capturado.
6. Restaure o checkpoint e confira o estado local original antes de liberar a reserva. Remova somente a quarentena adquirida pelo ensaio.

Esse ensaio valida recuperação sequencial no banco fixo. Uma restauração sobre produção ou staging exige autorização específica e recuperação preparada.

### Rollback

Restaure o acesso privado e registre alvo, horário, digest e correlação. Confira compatibilidade do catálogo, reimplante o manifesto anterior exato e preserve os volumes. Valide digest, saúde, PT/EN, painel, mídias e negativas de acesso. Produção precisa de ponto de retorno próprio. Alterações de dados exigem o procedimento de recuperação correspondente.

## Migrações controladas

Confira alvo e árvore revisada, suspenda escritores e mantenha PostgreSQL disponível. Verifique o backup antes de iniciar. O executor compartilha o advisory lock do backup. Aceita a migração aditiva revisada `20261106_035830_cms_user_profile` sobre o predecessor exato de **16 entradas**. Com as **17 entradas** revisadas, retorna `already-current`.

```sh
OPS_ALLOW_REVIEWED_MIGRATION=true node --conditions=react-server src/backup-runtime.mjs migrate
```

Execute no processo de operador autorizado. Confira conclusão do backup e catálogo final antes de retomar escritores. As migrações usam esse fluxo separado do startup e do deploy. [Guarda de migração](../ops/migrations/controlled.ts) e [executor restrito](../ops/backup/runtime-entry.ts).

## Publicação, saúde e logs

Persista o volume privado de publicação. Quando o conteúdo estiver desatualizado, compare a geração servida com a raiz confirmada. Confira intenção, catálogo, volume, origem e correlação antes de repetir pelo fluxo nativo de recibos e retries duráveis.

Confira `/health` com HTTP 200 e `{"status":"ready"}`, digest em execução e logs protegidos. O health é leve. Diagnósticos de PostgreSQL/R2 ficam separados e protegidos. Durante uma falha transitória da origem, as páginas confirmadas disponíveis continuam atendendo.

Centralize os logs no helper de logger, com data, nível, operação, resultado e `correlationId`. Consulte pelo Coolify, separando deploy e runtime, com rotação e limite de disco. Use correlações redigidas e proteja URLs de banco, caminhos privados, credenciais e mensagens. O monitoramento desta versão usa logs e health do ambiente. Serviço externo, notificações e detecção da queda da VPS inteira ficam fora do escopo aprovado.

## Performance

As [pendências](pending.md#condições-de-lançamento) definem quando medir novamente ou reaproveitar uma referência. As metas de LCP, CLS, TBT e INP ficam na [especificação](specification.md#qualidade-e-operação).

Antes da rodada, fixe candidata, origem de staging, máquina, versões, hash dos perfis, conteúdo e seis alvos. Use Home, listagem e case representativo de maior transferência em PT/EN. Escolha o case antes de analisar LCP/CLS/TBT. Com celular, desktop e três repetições por combinação, são **12 cenários e 36 medições**. [Perfis](../ops/performance/profiles.json).

| Condição           | Celular            | Desktop               |
| ------------------ | ------------------ | --------------------- |
| Viewport CSS / DPR | 390 × 844 / 3      | 1440 × 900 / 1        |
| CPU / RTT          | 4× / 150 ms        | 1× / 40 ms            |
| Download / upload  | 1.600 / 750 Kbit/s | 10.000 / 5.000 Kbit/s |

Use os mesmos perfis nas repetições. Lighthouse recebe `throttlingMethod=devtools`, `requestLatencyMs=RTT` e os valores de download/upload em Kbit/s. Registre sistema, CPU/RAM e versões efetivas de Node, Lighthouse, Playwright e Chromium. Identifique a emulação utilizada e registre a variação de carga da VPS. Mantenha outras jornadas intensivas fora da janela.

Cada navegação medida usa processo e perfil novos, sem sessão editorial, cookies ou storage persistido. Aqueça o servidor com uma visita anterior a cada alvo/perfil, preservando a autoridade publicada. Mantenha o diagnóstico de navegador aquecido separado das medianas principais.

Prepare o JSON privado com `environment: "staging"`, `origin`, `sourceSha`, `imageDigest`, `profileSha256` e os seis `targets`. O CLI confere esses vínculos e aceita a origem de staging fixada nele. Escolha um diretório de saída novo sob `.work/local-audits`. [CLI](../ops/performance/run-staging-audit.mjs).

```sh
node ops/performance/run-staging-audit.mjs .work/local-audits/current-config.json .work/local-audits/current-run --preflight
node ops/performance/run-staging-audit.mjs .work/local-audits/current-config.json .work/local-audits/current-run --run
```

Vincule recibos independentes de antes e depois, conferindo digest, raiz pública e volumes. Evite gravações editoriais na janela. Guarde configuração e dados brutos no diretório privado de saída. O relatório compartilhado contém condições, métricas, hashes e limitações. Registre todas as execuções, falhas, mediana, mínimo e máximo por cenário. Preserve outliers e rodadas incompletas, com a causa registrada.

O relay Node lê Basic Auth do `.env` privado. O navegador acessa loopback em porta efêmera e bloqueia outros destinos. O relay permite GET/HEAD HTTPS para staging, preservando bytes comprimidos e cabeçalhos de codificação. Rejeita gravações, corpo na requisição, alvos absolutos e redirecionamentos. Cookies e Authorization do navegador e Set-Cookie ficam bloqueados. Proteja segredos em URLs, configurações Lighthouse e evidências. Mantenha Analytics desligado e Google bloqueado.

A medição inclui a rede/TLS até staging e o relay local, que pode acrescentar latência e CPU. DevTools atua entre navegador e relay e soma-se à rede real existente. Registre esse limite ao interpretar resultados. TLS e desafio Basic no navegador, origem definitiva, indexação, CDN/cache de produção e SDK real de Analytics exigem verificação própria. Menu, idioma, toast, sumário e contatos recebem observações de laboratório.

TBT é métrica de laboratório. INP de campo depende de amostra real p75 suficiente, com referência ≤200 ms por celular/desktop. Use os resultados e limitações apropriados para cada métrica. A coleta adicional depende da decisão registrada nas pendências.
