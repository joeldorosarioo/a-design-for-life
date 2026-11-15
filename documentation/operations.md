# Operação

Este guia reúne edição, deploy, recuperação e medição. O [estado atual](current-status.md) registra candidatas, provas e pendências; a [especificação](specification.md) define os contratos e a [arquitetura](architecture.md), sua implementação. Procedimentos e registros históricos não autorizam operar um alvo.

## Edição no CMS

Entre em `/admin` com sua conta individual. O painel oferece português e inglês; sem preferência compatível, usa português. Altere a interface em **Payload Settings → Language**. O campo de idioma do documento escolhe a edição pública que será editada.

| Área                      | O que editar                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navegação**             | Textos, links e ações do cabeçalho e rodapé. Contatos e currículo vêm do perfil publicado no idioma.                                         |
| **Perfil profissional**   | Conteúdo da Home/Sobre, imagens, e-mail, LinkedIn e currículo PDF. Defina alternativas, decoração e legendas em cada uso da imagem e idioma. |
| **Projetos**              | Identidade e informações compartilhadas do projeto.                                                                                          |
| **Conteúdo dos projetos** | Slug, textos, imagens e metadados de busca/compartilhamento de cada tradução.                                                                |
| **Mídias**                | Arquivos e nomes internos. O acesso público depende de uma referência publicada e confirmada.                                                |

Salve o rascunho e revise na prévia autenticada. Depois de publicar, confira a confirmação e a página pública no idioma editado. Uma atualização pendente pode conservar a versão confirmada anterior; restaurar uma versão cria um rascunho para revisão. Use **Minha conta** para acesso e idioma do painel; o nome e o retrato públicos pertencem ao **Perfil profissional**.

## Acesso editorial e e-mail

Use a recuperação nativa do Payload. Local e testes capturam mensagens em `.work/editorial-mail`; mantenha mensagens, tokens e URLs de recuperação privados. Captura local não comprova entrega em staging ou produção.

Para e-mail real, confira domínio/remetente e os segredos `RESEND_API_KEY`, `EDITORIAL_EMAIL_FROM_ADDRESS` e `EDITORIAL_EMAIL_FROM_NAME`. Faça a prova somente em janela autorizada, com destinatário anuente.

## CI e staging

O [workflow protegido](../.github/workflows/checks.yml) executa `pnpm verify:ci` sem banco nos PRs, nos pushes para `develop`/`main` e por acionamento manual. Outros branches passam pelo PR ou pelo acionamento manual. Um novo commit cancela o check anterior do mesmo PR. O fluxo de deploy mantém a fila por branch até a saúde e o marcador.

O CI verifica tipos, lint, formato, unidades, arquitetura, scripts e build. Integração, E2E e recuperação rodam no banco local fixo e precisam de evidência vinculada à fonte da candidata. Cache de dependências/compilação não dispensa nenhum check.

O fluxo `develop → staging` constrói uma imagem Linux amd64, confere identidade e smoke com restrições de execução e publica no GHCR privado. O Buildx reutiliza camadas intermediárias na tag `build-cache` do mesmo package privado, com visibilidade conferida antes do acesso. Essa tag não é candidata nem marcador de homologação. Sem cache, o build é normal; falha na exportação do cache não bloqueia a imagem verificada.

Antes de habilitar `STAGING_AUTODEPLOY_ENABLED`:

1. Confira o recurso autorizado, banco, buckets R2 privados, volumes e namespaces de publicação/mídia, flags, cotas e digest anterior compatível. Preserve a rotação dos logs. A referência operacional registrada fica no estado atual; releia as identidades efetivas antes de operar.
2. Separe credenciais de publicação/deploy das de backup/mídia. Confira a árvore exata `APPROVED_MIGRATION_TREE`; o deploy não executa migrações.
3. Exija backup novo, completo, criptografado e verificado antes da troca. Preserve os volumes.
4. Vincule recibo do workflow, marcador do registry e imagem em execução ao mesmo manifesto. Confira saúde, PT/EN, painel, mídias, raiz pública confirmada, negativas de acesso anônimo, `noindex` e Analytics desligado.

Conserve os recibos de release, backup e rollback. Uma aplicação saudável não substitui o aceite visual ou de performance.

## Promoção e lançamento

O lançamento exige autorização expressa da candidata, alvo, responsáveis e janela. Os gates de conteúdo, configuração externa, backup, e-mail e dependências ficam no estado atual. Antes de habilitar `PRODUCTION_AUTODEPLOY_ENABLED`, confira branch protegida, environment de produção, prova de fonte, backup e janela de escrita.

Por padrão, produção resolve o marcador homologado para a árvore Git inteira. Para mudanças exclusivamente documentais posteriores à candidata aprovada, configure **juntas** `APPROVED_STAGING_REVISION` e `APPROVED_IMAGE_DIGEST`, com aprovação explícita do commit e manifesto.

O [resolver](../ops/deploy/registry.mjs) admite somente arquivos regulares de `README.md`, `AGENTS.md` e `documentation/**` no diff; confere marcador existente, revisão e digest da imagem. Código, ativos, dependências, configuração, CI e operação exigem uma nova candidata. CI corrente, backup e migrações continuam exigidos. Aprovação incompleta, antiga ou divergente é recusada sem fallback. Após homologar outra candidata, atualize as duas variáveis ou limpe ambas. Configurá-las não autoriza lançamento.

A renomeação de `docs` e a atualização de seus consumidores alteram código/configuração e precisam estabelecer uma nova base validada. Uma candidata anterior a essa mudança não recebe a exceção documental apenas pela troca do nome da pasta.

Na janela autorizada:

1. Comece com produção privada: `SITE_ORIGIN` HTTPS aprovado, `APP_ENV=production`, `PUBLIC_SITE_ENABLED=false`, autenticação de proxy e `X-Robots-Tag: noindex, nofollow`. Comprove a negativa anônima.
2. Registre digest anterior compatível, catálogo, volumes e raiz publicada. Confira origem, manifesto, releitura do ciphertext, tamanhos, hashes e marcador completo do backup novo.
3. Compare catálogo e `APPROVED_MIGRATION_TREE`. Suspenda escritores para uma migração controlada autorizada. Pare diante de divergência, falha de backup ou DDL destrutivo não aprovado.
4. Promova o **mesmo manifesto**, sem rebuild. Confira digest, usuário, limites, volumes, cache, saúde e logs; pare diante de identidade divergente.
5. Ainda em privado, confira TLS, SSR PT/EN, canonical/alternates, mídias/PDFs, login e negativas de rascunhos/prévias/bytes privados. E-mail exige sua janela autorizada. Suítes e injeções de falha usam recursos locais/de staging isolados.
6. Abra somente na janela aprovada: registre horário/digest, retire as restrições temporárias e confira HTTP, sitemap, robots e URLs na origem final. Use HEAD/GET pontuais; bloqueie Google nas inspeções sintéticas e manuais.

Mantenha Analytics com `loadScript=null`. Ativação exige decisão própria, revisão do SDK/ambiente efetivos e relatórios possíveis sob `analytics_storage: denied` permanente, sem cookies analíticos nem identificadores persistentes alternativos. Tráfego sintético/editorial nunca envia medições ao Google.

## Backup e recuperação

Há três bancos de aplicação fixos: produção, staging e local. Desenvolvimento, integração, E2E e ensaios de recuperação compartilham o banco local sob reserva exclusiva. Os testes podem limpar seus dados entre rodadas; preserve um backup do que quiser guardar. Não crie bancos descartáveis nem exclua o volume para resolver uma reserva.

### Backup local

Mantenha PostgreSQL disponível e pare desenvolvimento, testes e outros clientes. Na primeira preparação:

```sh
docker build -f ops/backup/Dockerfile -t adfl:backup-local .
pnpm setup:backup-tools
pnpm backup:local
```

Refaça o build da imagem de ferramentas quando a verificação de dependências solicitar. `backup:local` adquire a reserva do banco, monta fontes/dados do host somente para leitura e registra sua identidade. Lê publicações e mídia local configurada, ou mídia R2 da fonte, e grava conjuntos criptografados em `.work/backup-sets`. Preserve o volume original; guarde a identidade age separada dos conjuntos.

### Backup de staging

Use a tarefa Coolify autorizada `encrypted-full-backup` ou o contêiner da aplicação como `appuser`. Confira recurso, banco, volume, namespace, credenciais exclusivas do bucket de backup, `OPS_BACKUP_RECIPIENT` e `OPS_BACKUP_SOURCE`.

O destino remoto é um bucket R2 privado e exclusivo para backups, separado das mídias e fora da VPS, com credenciais próprias. O backup local não substitui essa cópia externa.

```sh
node --conditions=react-server src/backup-runtime.mjs backup
```

Mantenha `PUBLIC_SITE_ENABLED`, `PUBLICATION_RETRIES_ENABLED`, `PUBLICATION_RETRY_WORKER_ENABLED` e `PUBLICATION_HTTP_VERIFICATION_ENABLED` em `false`, com schema drop desativado. As [guardas do job](../ops/backup/job-settings.ts) impõem esse limite. A agenda semanal registrada era domingo às 03:00 no fuso do servidor; confira tarefa e fuso efetivos. Acrescente backup antes de atualizações/migrações.

O conjunto completo inclui dump PostgreSQL custom consistente, raiz pública confirmada e mídias necessárias. Confira origem, manifesto, cada tamanho/hash, marcador de conclusão e releitura do destino antes de atualizar. Retenha conjuntos completos por **56 dias**; conjuntos incompletos não autorizam limpeza de retenção. Guarde a identidade privada age fora da VPS, imagem, repositório e bucket. O executor embutido não aceita produção; esse alvo exige executor próprio validado.

### Ensaio e recuperação de dados

1. Suspenda escritores. Preserve dados, volumes, logs e backups originais. Confira ciphertext e descriptografe um conjunto completo em quarentena privada.
2. Pare o desenvolvimento e adquira a reserva exclusiva do banco local. Faça checkpoint de seu estado antes de substituir o schema. Restaure somente no schema preparado desse mesmo banco.
3. Leia as mídias R2 da fonte sem gravar; os arquivos recuperados ficam locais. Antes da leitura pública recuperada, prepare o snapshot ao lado de `current.json` com `pinPublicRoot(directory, capturedRoot)`.
4. Confira schema, rotas, raiz pública, hashes das mídias, PT/EN, login e recuperação de acesso com e-mail capturado.
5. Restaure o checkpoint e confira o estado local original antes de liberar a reserva. Preserve as identidades de banco/contêiner/volume e remova apenas os arquivos de quarentena adquiridos pelo ensaio.

Esse procedimento comprova recuperação **sequencial no mesmo banco**; não comprova uma cópia simultânea com a fonte disponível. Restaurar sobre produção ou staging exige autorização específica e recuperação preparada.

### Rollback da imagem

Restaure o acesso privado e registre alvo, horário, digest e correlação segura. Confira a compatibilidade do catálogo, reimplante o manifesto anterior exato preservando volumes e valide digest, saúde, PT/EN, painel, mídias e negativas de acesso. Produção precisa de seu próprio ponto de retorno. Rollback da imagem não desfaz alterações nos dados.

## Migrações controladas

Confira alvo e árvore revisada, suspenda escritores, mantenha PostgreSQL disponível e verifique o backup antes de iniciar. O executor compartilha o advisory lock do backup. Aceita somente a migração aditiva revisada `20261106_035830_cms_user_profile` sobre o predecessor exato de **16 entradas**; as **17 entradas** revisadas retornam `already-current`.

```sh
OPS_ALLOW_REVIEWED_MIGRATION=true node --conditions=react-server src/backup-runtime.mjs migrate
```

Execute no processo de operador autorizado. Reconfira marcador completo do backup e catálogo final antes de retomar escritores. Startup e promoção não migram. Consulte a [guarda de migração](../ops/migrations/controlled.ts) e o [executor restrito](../ops/backup/runtime-entry.ts).

## Publicação, saúde e logs

Persista o volume privado de publicação. Para conteúdo desatualizado, compare a geração servida com a raiz confirmada: uma atualização pendente pode manter a última edição confirmada. Use recibos/retries duráveis nativos; confira intenção, catálogo, volume, origem e correlação antes de repetir.

Confira `/health` com HTTP 200 e `{"status":"ready"}`, digest em execução e logs protegidos em conjunto. Preserve rotação e avalie prontidão junto da disponibilidade de páginas em cache. Relatórios usam correlações redigidas e excluem URLs de banco, caminhos privados, credenciais e corpos de mensagens.

Centralize logs no helper de logger, com data, nível, operação, resultado e `correlationId`. A consulta usa o Coolify, separando deploy e runtime, com rotação e limite de disco. O health é leve; diagnósticos de PostgreSQL/R2 ficam separados e protegidos. Falha transitória da origem não deve derrubar páginas confirmadas disponíveis. Não há serviço externo de monitoramento/notificação nem promessa de detectar a queda da VPS inteira.

## Performance

O gate **E4.2.4** define quando repetir: mudanças em renderização, imagens, fontes, conteúdo pesado, dependências, cache ou infraestrutura exigem revalidação. Para reaproveitar uma referência, identifique fonte/imagem e condições comparáveis e justifique a ausência de impacto; sem evidência suficiente, meça.

Antes da rodada, fixe candidata, origem de staging, máquina, versões das ferramentas, hash dos [perfis](../ops/performance/profiles.json), conteúdo e seis alvos: Home, listagem e case representativo de maior transferência em PT/EN. Escolha o case antes de analisar LCP/CLS/TBT. Com celular e desktop e três repetições por combinação, são **12 cenários e 36 medições**.

| Condição           | Celular                              | Desktop                              |
| ------------------ | ------------------------------------ | ------------------------------------ |
| Viewport CSS / DPR | 390 × 844 / 3                        | 1440 × 900 / 1                       |
| CPU / RTT          | 4× / 150 ms                          | 1× / 40 ms                           |
| Download / upload  | 1.600 / 750 Kbit/s                   | 10.000 / 5.000 Kbit/s                |
| Limites            | LCP ≤2.500 ms; CLS ≤0,1; TBT ≤200 ms | LCP ≤2.500 ms; CLS ≤0,1; TBT ≤150 ms |

Use os mesmos perfis nas repetições. Lighthouse recebe `throttlingMethod=devtools`, `requestLatencyMs=RTT` e os valores de download/upload diretamente em Kbit/s. Registre CPU/RAM, sistema e versões efetivas de Node, Lighthouse, Playwright e Chromium; emulação não equivale a aparelho físico. Mantenha outras jornadas intensivas fora da janela e registre a variação de carga da VPS compartilhada.

Cada medição usa processo/perfil novo do navegador, sem sessão editorial, cookie ou storage persistido. O servidor fica aquecido por uma visita anterior a cada alvo/perfil, com a mesma autoridade publicada. Diagnóstico com navegador aquecido fica separado das medianas principais.

Prepare um JSON privado com `environment: "staging"`, `origin`, `sourceSha`, `imageDigest`, `profileSha256` e os seis `targets`. O [CLI](../ops/performance/run-staging-audit.mjs) confere esses vínculos e aceita somente a origem de staging fixada nele. Use diretório de saída novo sob `.work/local-audits`:

```sh
node ops/performance/run-staging-audit.mjs .work/local-audits/current-config.json .work/local-audits/current-run --preflight
node ops/performance/run-staging-audit.mjs .work/local-audits/current-config.json .work/local-audits/current-run --run
```

Vincule a rodada a recibos independentes antes/depois, conferindo digest, hashes da raiz pública e identidades dos volumes. Evite gravações editoriais na janela. Configuração e relatórios brutos ficam privados no diretório de saída; o relatório compartilhado contém condições, métricas, hashes e limitações. Preserve todas as execuções, falhas, mediana, mínimo e máximo por cenário. Não retire outliers para obter aprovação. Registre a causa de uma rodada incompleta e preserve-a ao repetir.

O relay Node lê Basic Auth do `.env` ignorado; o navegador acessa somente loopback, em porta efêmera. O relay faz GET/HEAD HTTPS exclusivamente para staging, preservando corpo comprimido e cabeçalhos de codificação. Rejeita gravações, requisições com corpo, alvos absolutos e redirecionamentos; não encaminha cookies/Authorization do navegador nem devolve Set-Cookie. O navegador bloqueia DNS/destinos fora de loopback. Segredos ficam fora de URLs, configurações Lighthouse e evidências públicas; Analytics permanece desligado e Google bloqueado.

A medição inclui rede/TLS até staging e o relay local, que pode acrescentar latência/CPU. DevTools atua entre navegador e relay e soma-se à rede real existente. O teste não mede TLS/desafio Basic no navegador nem homologa origem definitiva, indexação, CDN/cache de produção ou SDK real de Analytics. Menu, idioma, toast, sumário e contatos recebem observações de laboratório próprias.

TBT é métrica de laboratório. INP de campo depende de amostra real p75 suficiente e não é substituído por TBT ou interações pontuais. A referência é ≤200 ms, separada por celular/desktop quando houver dados; sua indisponibilidade e qualquer coleta adicional seguem as decisões do estado atual.
