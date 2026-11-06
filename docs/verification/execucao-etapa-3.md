# Execução autorizada — etapa 3

**Etapa 3: 100,0% do checklist (30/30 itens); 6/6 tarefas inteiramente encerradas. Aprovação registrada: A3 pending; E3 local execution explicitly resumed on 2026-11-03; production remains unauthorized.**

Fonte: plano original aprovado em `../specs/2026-10-29-portfolio-plano-implementacao.md`, E3.1–E3.6. A métrica preserva as trinta caixas originais, cinco por tarefa e sem crédito parcial. Contagens/evidências em [progresso-etapa-3.md](progresso-etapa-3.md); autorização e histórico da pausa em [retomada-etapa-3.md](retomada-etapa-3.md).

Em 03/11/2026 o usuário retomou explicitamente E3 após a pausa para reunir informações. A2 aprovada com a pendência formal do leitor de tela preservada: 29/30 critérios e cinco tarefas inteiramente encerradas. NVDA permanece desativado. A3/A4 não aprovadas; nenhuma produção autorizada.

Estimativa inicial: **24–40 horas de trabalho**, excluindo esperas externas. Rever diante de bloqueio concreto. Desenvolvimento e testes locais primeiro; serviços e custos precisam ser apresentados antes de contratar.

## Acompanhamento

- [x] E3.1 Ambientes R2 e e-mail reais — 5/5 critérios.
- [x] E3.2 Cache, invalidação e recuperação de atualização pública — 5/5 critérios.
- [x] E3.3 Google Analytics automático sem cookies — 5/5 critérios.
- [x] E3.4 Imagem única, configuração de execução e homologação — 5/5 critérios.
- [x] E3.5 Migrações, logs e verificações de saúde — 5/5 critérios.
- [x] E3.6 Backup criptografado e restauração isolada — 5/5 critérios.
- [ ] Pacote A3 integral entregue; checkpoints técnicos permanecem disponíveis.
- [ ] A3 aprovada explicitamente pelo usuário.

## Estado atual e leitura da contagem — 06/11/2026

A aplicação e o CMS estão no staging, com a revisão cd74963 e o pipeline 42265240175 aprovados. Deploy automático, imagem privada, backup extra anterior às atualizações, retenção de oito semanas e recuperação no escopo autorizado foram comprovados. O responsável forneceu o fluxo GA4 G-DXFQKDH52Z, salvo apenas no .env local. Analytics permanece desativado no staging. A conta Hostinger foi autenticada via MCP, mas suas ferramentas continuam indisponíveis neste runtime. O acesso operacional foi resolvido por SSH com a nova chave v2 criada pelo responsável.

A contagem atual é 30/30 (100%), com 6/6 frentes inteiramente encerradas: E3.1, E3.2, E3.3, E3.4, E3.5, E3.6. A métrica corresponde aos critérios integrais do checklist, sem crédito parcial. Nesta revisão, evidências já existentes resolveram marcações antigas de R2/e-mail; cache e saúde receberam provas operacionais adicionais sem provocar panes no staging.

O custo JavaScript e o gate completo atual também foram comprovados; a correção do page_view automático e os testes estão preparados localmente, sem novo deploy. O responsável confirmou os controles da propriedade GA4 desativados, encerrando E3.3.2. O responsável também confirmou a configuração privada dos dois buckets R2, encerrando E3.1.4. A capacidade e o valor contratados da Atlas foram relatados, com o valor mantido no inventário privado. A rotação e a consulta dos logs foram comprovadas sem alterar ou reiniciar o app real. O dimensionamento do staging também foi medido e registrado, sem inferir capacidade de produção futura. O contrato isolado do SDK real também foi concluído: header nativo, gate de suporte, resolução real suprimida e ausência de persistência foram comprovados com o adaptador real. Os gates atuais passaram 2.320 testes e duas jornadas Chromium, com fontes idênticas. A consolidação da candidata no fluxo develop→staging está em preparação; o loader continua null e nenhum lançamento foi autorizado. Produção e a troca dos links continuam adiadas. A3/A4 permanecem pendentes. Os registros abaixo são históricos e não revogam as configurações atuais.

## Decisões e bloqueios externos — histórico inicial

Uma conta Resend; `mail.joeldorosarioo.dev` como subdomínio de envio; uma chave de envio por projeto. Ambos os portfólios usam e-mail apenas na recuperação nativa de senha e não precisam de caixa de entrada. Nenhum envio real autorizado. Não registrar tokens/senhas em chat, logs ou repositório.

- **BLOCK-R2-ACTUAL-INTEGRATION:** acessos mínimos, buckets/credenciais separados por ambiente, backup e prova real de privacidade/entrega pendentes.
- **BLOCK-RESEND-ACTUAL-DELIVERY-AUTH:** configuração real e autorização específica de envio para conta editorial ainda pendentes; captura local até essa autorização.
- **BLOCK-VPS-STAGING-REGISTRY:** VPS/Coolify, registry autorizado e homologação protegida reais ainda indisponíveis/não verificados. Não contratar antes de apresentar serviços/custos.
- **BLOCK-GA4-REPORT-LIMITATION:** transporte/ping isolados não provam relatório; Analytics excluído de homologação/testes. Apresentar limitação de demonstração dependente de tráfego público em A3/A4 antes da ativação; sem cookies/banner.

## Pré-requisito de progresso

O script passou a selecionar explicitamente E3 sem alterar o padrão E2, preservar aprovação independente e validar antes de escrever. Testes reais de CLI em repositórios temporários usam Node24.22.2 e não iniciam banco, build, Vitest global ou serviço. RED: [progress-red.txt](artifacts/E3-progress/progress-red.txt), 1 passou/35 falharam; GREEN inicial: [progress-green.txt](artifacts/E3-progress/progress-green.txt), 36/36 passaram. Este trabalho não atende integralmente nenhuma caixa E3 e não recebe crédito parcial.

Specs e A2 selado preservados. Não executar gates globais locais enquanto houver risco para `.next`/compilação008, portas5432/55432 e a fixture visual55433. Evidência anterior permanece vinculada ao seu build/commit original. Verificar o estado real antes dos próximos trabalhos.

Auditoria adicional — E3.2.1: cache001 real passou1/1 (201,63s total; teste1,2min),95observacoes/cleanupFailures0. Home/lista/detalhe PT/EN confirmados sobreviveram a interrupcao do banco e reinicio do mesmo build; recurso sem cobertura503 voltou404 apos recuperacao. Compartilhamento e revogacao de midias tambem observados, sem conceder encerramento parcial aos criterios mais amplos. Prova em artifacts/E3-cache/proof-001*. A preview008 e banco visual permanecem fora do runner. Gate verify003 exit0:161arquivos/1465testes passaram,3ignorados; CSS2/2 e progresso36/36; build passou com2avisos de tracing amplo, em diagnostico;4avisos ESLint historicos de migracao. A imagem draft001 compilou, mas native-smoke001 falhou por aresta pnpm opcional canvas ausente; nao e prova de imagem concluida.

## Verificação de 04/11/2026

- E3.6.2 passou com as provas de recusa de alvo, retenção por data, conclusão após readback e preservação do último conjunto válido em falha de upload. O [runbook de backup](../runbooks/backup-e-restauracao.md) mantém o ensaio criptografado nativo vinculado à fonte da execução.
- O worker passou 52 testes Native e o ensaio de reinício do Next com recuperação após queda do PostgreSQL. A [prova do observador no Next](artifacts/E3-cache/publication-http-observer-report.md) passou em outra execução com falha controlada, recibo pendente, reprocessamento da mesma geração, redirect 308 e retirada 410. A ativação ainda é restrita ao runner isolado.
- O instalador `age` passou no Windows e no Linux isolados. O teste sintético de contexto Docker conferiu 21 entradas permitidas e 28 excluídas. A imagem anterior continua vinculada à própria fonte. A candidata atual ainda precisa dos gates de imagem e runtime.

- A imagem local 004 compilou com o lockfile congelado e manteve o mesmo fingerprint de fonte. O runtime passou com UID/GID 10001, QPDF, sharp, Canvas e PDF.js. A auditoria examinou 14 camadas e 11.046 entradas, além de 88 estáticos e manifestos. E3.4.2 encerrado. A execução em duas configurações, o teste do probe e a promoção dependem dos seus recibos próprios.

### Gate completo da fonte da imagem 004

- `verify-004`, saída 1. Tipagem, lint e formato passaram. Em 200 arquivos do Vitest houve 1.864 testes aprovados, duas falhas e três ignorados. O primeiro filho Node do teste Canvas herdou `NODE_PATH` do pnpm e resolveu o pacote real antes do vínculo sintético. O novo marcador também alterou o contrato `404` para case privado e caminho desconhecido. O teste Canvas agora desativa a busca global no processo sintético e exige `MODULE_NOT_FOUND` antes do vínculo. A resposta direta `404` mantém o formato anterior. Os testes focados das correções passaram 89/89 pelo pnpm.
- `verify-005`, saída 1. Os 200 arquivos e 1.866 testes passaram, com três ignorados. CSS e recálculo passaram. O PowerShell deixou `NEXT_TEST_DIST_DIR` vazio, e a guarda de build recusou a entrada. O script de execução agora seleciona explicitamente `.work/next-build` e limpa os demais overrides com o provedor Env.
- `verify-006`, saída 0, Node 24.22.2 e pnpm 12.10.1. Tipagem, lint, formato, 200 arquivos do Vitest, 1.866 testes aprovados e três ignorados, CSS 2/2, recálculo 36/36 e build do Next 16.4.3 passaram. Mantidos quatro avisos históricos de lint em uma migração. O banco descartável usou a porta 55434 e a fixture sintética de age foi habilitada. A fonte de 615 arquivos preservou `9390cc9ee4914f9a23c04948d7b1124ec83349f3cf607c30c98b6158c1893628` antes e depois, o mesmo da imagem 004. Os gates do navegador e da imagem têm recibos independentes.

Comandos, saída e snapshots em [recibos de verificação](artifacts/E3-gates/).

### Execução da imagem em duas configurações

O [ensaio HTTP da imagem 004](artifacts/E3-image/http-973f5053-f16b-4c9a-b183-8470d9719ebf/run.json) passou 82 verificações usando a mesma imagem em dois bancos, origens, raízes de publicação e caches distintos. A execução conferiu os dois idiomas, painel, autenticação/API, estáticos, imagens e links canônicos, antes e depois dos reinícios. Quatro inícios ficaram saudáveis, com o probe embutido e GET/HEAD 200. E3.4.3 encerrado. O navegador contra a imagem, a homologação e a promoção por manifesto do registry têm provas próprias.

### Navegador completo em Next local

O ensaio `e2e-002` terminou com saída 0 e 116/116 testes no Chromium. O Next 16.4.3 foi compilado para produção e iniciado no runner com PostgreSQL 17.11 descartável. O ensaio incluiu a origem indisponível, cache confirmado após reinício, autorização de imagens, remoção da última referência e observação da revisão antes do recibo editorial. A função de saída de cada teste manteve as novas capturas em pasta privada própria. As 41 capturas históricas conservaram os hashes. Os 615 arquivos da fonte conservaram o fingerprint de `verify-006` e da imagem 004.

A primeira chamada `e2e-001` parou antes dos serviços porque o wrapper PowerShell entregou `list json` como nome de reporter ao Playwright. A execução corrigida usou diretamente o mesmo comando Node do script do projeto e preservou a vírgula. [Recibos do navegador](artifacts/E3-gates/). Este ensaio usou o build local. A prova completa em navegador contra a imagem continua pendente.

O cache de bytes e a autorização de mídia foram exercitados em conjunto e separadamente na execução atual. E3.2.5 encerrado com o teste 102 do Chromium, `verify-006` e o commit local `1e93925`. A retirada da última referência recusou os bytes que o otimizador ainda mantinha em disco. O observador antes do recibo editorial ainda tem uma prova de mídia própria.

### Identidade da imagem e probe de loopback

O guard de inspeção agora verifica valores dos defaults esperados, além dos nomes. A suíte detectou que a versão anterior aceitava valores indevidos em HOSTNAME, PORT, MEDIA_CHECKER_BINARY e PATH, além de entrada duplicada. O RED falhou em 5 casos, o GREEN combinado passou 36/36 e a reinspeção da imagem 004 passou. A comparação de digests e o ensaio HTTP de duas configurações isoladas completam E3.4.1.

O probe de saúde usa HTTP direto para 127.0.0.1, limita a resposta a 512 bytes e exige JSON completo. O RED mostrou o encaminhamento por um proxy herdado e aceitação de dois corpos fora do contrato. GREEN 5/5. A validação Linux montou somente o probe atualizado, em leitura, sobre a imagem imutável 004 e ativou um proxy inacessível. O Docker ficou saudável, com GET/HEAD 200 e probe embutido saída 0. Essa prova valida o novo arquivo no runtime Linux. A imagem 004 permanece vinculada aos próprios bytes, e o Coolify ainda precisa de ensaio real.

### Operações locais e imagem 005

- O transporte de backup foi exercitado com o SDK S3, requisições assinadas para dois buckets sintéticos em loopback e age/tar reais. O repositório relê o ciphertext e o marcador, valida o vínculo com a origem e conserva o conjunto existente em colisão. Os 145 testes focados passaram, sem pulos. O banco da prova composta de transporte foi simulado. Retenção R2 desabilitada e sem agenda ou bucket real. [Relatório](artifacts/E3-backup/r2-backup-wiring-report.md).
- O PostgreSQL descartável iniciou com o catálogo anterior de 15 migrações. A execução criou e releu o backup criptografado antes de aplicar a migração aditiva, recusou um concorrente e recuperou catálogo, usuário e raiz em outro banco descartável. A falha de dump conservou os 15 registros e repetir o job após migrar devolveu `already-current`. A exclusão Linux por inode passou em ensaio separado. Faltam o job operacional e o rollback da imagem sobre o schema migrado. [Prova Native](artifacts/E3-operations/migration-local-report.md).
- O planejador de observação de mídia e o transporte binário conferem a geração, os bytes e a negação de acesso. A proveniência no arquivo da raiz distingue alvos removidos. O planejador e os marcadores passaram 101 testes unitários. A fatia de proveniência passou 81 com um pulo existente no Windows. A arquitetura passou 34. Faltam a ligação ao recibo editorial, a guarda de predecessores históricos pendentes, o filtro Native no banco e o ensaio Next de mídia antes do ACK. [Proveniência](artifacts/E3-cache/media-provenance-report.md) e [verificação](artifacts/E3-cache/media-verification-report.md).
- A imagem Linux 005 usou Node 24.22.2, pnpm 12.10.1, lockfile congelado e UID 10001. O build e os smokes nativos passaram com a fonte de 626 arquivos em `065c471bd08cad8a81720b057d6545349f637bb2ae093450173b23bf6fc85b92`. A imagem local imutável é `sha256:882ef66ce39aa9903873cc8d4af2305e102ae833e0c9f895cdd236d1f932fe8d`. A auditoria examinou 14 camadas e 11042 entradas, sem caminhos vedados. 88 estáticos e manifestos passaram pela inspeção de marcadores sintéticos. O probe veio na própria imagem e marcou saudável em 6453 ms, sem acesso ao banco, com GET/HEAD 200. Registry e Coolify ficam para as provas próprias. [Imagem](artifacts/E3-image/docker-draft-build-005.json), [camadas](artifacts/E3-image/layers-draft-005.json), [estáticos](artifacts/E3-image/static-manifest-marker-scan-005.json) e [probe](artifacts/E3-image/offline-health-draft-005.json).

### Gate completo da fonte da imagem 005

`pnpm verify` terminou com saída 0 usando Node 24.22.2, pnpm 12.10.1 e PostgreSQL 17.11 descartável na porta 55434. Passaram tipagem, lint, formatação, 208 arquivos do Vitest com 1.929 testes aprovados e três pulados, os testes de CSS e de progresso e o build do Next 16.4.3. Houve quatro avisos históricos de lint em uma migração. O manifesto de 626 arquivos preservou o mesmo fingerprint da imagem 005 antes e depois da execução. [Saída](artifacts/E3-gates/verify-007-full.txt) e [recibo](artifacts/E3-gates/verify-007-result.json).

### Chromium completo no checkpoint da imagem 005

O ensaio local `e2e-003` passou 116/116 em 4,7 minutos. A fonte conservou o fingerprint de `verify-007` e as 41 capturas históricas mantiveram seus hashes. O ensaio rodou em Next compilado no Windows com PostgreSQL descartável. A execução em Chromium contra o contêiner Linux é independente. [Saída](artifacts/E3-gates/e2e-003-full.txt) e [recibo](artifacts/E3-gates/e2e-003-result.json).

### Avatar do painel e isolamento do Chromium

As duas primeiras execuções Chromium da imagem 005 falharam depois do login. Na repetição diagnóstica, o bloqueio interceptou dois GET de imagem a `www.gravatar.com`. A versão instalada do Payload usa Gravatar por padrão e compõe o caminho a partir de um hash do e-mail. O verificador não permitiu a saída e preservou apenas host, método, tipo e etapa. Os contêineres e bancos dos dois ensaios foram removidos. [Primeira execução](artifacts/E3-image/http-7d45b5c9-d33d-489e-b11e-72821f1ce64d/run.json) e [diagnóstico sanitizado](artifacts/E3-image/http-1c875040-cdc8-4a38-925c-77914427a741/a-initial-browser-network-failure.json).

A configuração do painel seleciona o avatar padrão local do próprio Payload. O teste adjacente da configuração sanitizada falhou porque o valor efetivo era `gravatar` e passou depois de passar a `default`. A confirmação em Chromium requer imagem reconstruída. [RED](artifacts/E3-operations/payload-admin-avatar-red-001.txt) e [GREEN](artifacts/E3-operations/payload-admin-avatar-green-001.txt).

### Observação de mídia e recuperação após exclusão

O observador foi ligado à confirmação da revisão no runner. Os 107 testes focados passaram após três falhas comportamentais. O PostgreSQL comprovou a identificação do predecessor já reconhecido e a preservação da proveniência de outro predecessor ainda selecionado e superado. O Next compilado exercitou mídia compartilhada, original e derivado, cache do otimizador, a retirada pendente diante dos bytes antigos e a confirmação posterior da mesma geração com nove negações vazias. O Playwright passou. O wrapper registrou saída 2 por entradas transitórias PID 0, e a inspeção independente confirmou a liberação dos recursos e portas. A prova de interrupção e retomada pelo worker ainda está aberta. [Recibos](artifacts/E3-cache/media-ack-wiring-report.md).

A prova com age e tar reais recuperou a chave, o tamanho, o SHA-256 e os bytes de uma mídia sintética após remover o objeto na origem. O marcador permaneceu igual. O ensaio de oito testes passou sem pulos. A coordenação do limpador operacional e a retenção no R2 continuam abertas. [Recibo](artifacts/E3-backup/post-deletion-recovery-001.txt).

### Gate da fonte da imagem 007

O gate 008 parou porque o teste do avatar excedeu o limite de cinco segundos ao importar a configuração completa do Payload. Os demais 1.934 testes passaram e três foram pulados. Um diagnóstico separado com o projeto unitário mediu 4,23 s para esse teste e 1.587 aprovações. O limite foi ajustado somente nesse teste, que preservou a asserção de avatar local. A imagem 006 compilou e passou as inspeções, porém o gate correspondente saiu 1. [Falha preservada](artifacts/E3-gates/verify-008-result.json).

O gate 009 saiu 0, com Node 24.22.2 e pnpm 12.10.1. Passaram tipagem, lint, formato, 209 arquivos do Vitest, 1935 testes com 3 pulados, CSS, recálculo e build do Next. O lint registrou quatro avisos históricos de migração. A mesma fonte de 627 arquivos foi usada pelo build da imagem imutável `sha256:623e6eac85a24212695da3522467cc4fb94c6466b517d561019994d6f8220983`, com auditoria de camadas, estáticos e probe offline. [Gate 009](artifacts/E3-gates/verify-009-result.json) e [imagem 007](artifacts/E3-image/docker-draft-build-007.json).

### Rollback local entre imagens imutáveis

O ensaio 004 → 007 → 004 usou o mesmo banco descartável e preservou seu OID. Aplicou o backup e a migração nativa antes de iniciar a candidata. A volta preservou as 16 entradas e o hash do catálogo migrado. As três fases passaram 60 verificações HTTP somadas e os recursos descartáveis foram removidos. A 004 é a imagem anterior local e já contém o arquivo aditivo. O job no Coolify e a imagem do código exato do predecessor continuam em aberto. [Recibo](artifacts/E3-operations/migration-image-rollback-6f5d6bd2-0067-4c90-8c2c-71a7f5bbcecb/run.json).

### Restauração de aplicação e recuperação nativa

O ensaio recuperou o PostgreSQL e os objetos para um destino local descartável, com descriptografia real por age. A imagem 007 atendeu a raiz restaurada e passou oito verificações HTTP. Conferiu detalhes PT/EN, bytes da imagem, PDF na lixeira privado, login e painel. A redefinição capturou uma mensagem no contêiner, revogou a sessão e a senha anteriores, aceitou a nova senha e recusou o reuso do token com 403. O contêiner foi removido antes da liberação do alvo restaurado. Backup de 848 ms, restauração de 25832 ms, incluindo 11758 ms da prova HTTP da imagem 007. Tempos observados neste ensaio sintético. R2 real e o pacote A3 permanecem abertos. [Eventos do ensaio](artifacts/E3-backup/encrypted-native-events-1a557ee1-e967-410a-930d-66f8be47abab.jsonl) e [saída do teste](artifacts/E3-backup/restore-http-docker-007-001.txt).

### Chromium contra a imagem Docker 007

O mesmo ID de imagem iniciou em dois ambientes descartáveis e passou 82 verificações HTTP e quatro jornadas Chromium antes e depois dos reinícios. A navegação cobriu Home, lista e detalhe PT/EN, alternância de idioma, imagem otimizada e PDF, negação anônima de rascunho e mídia privada, login e sessão do Payload. O interceptador bloqueava destinos externos e registrou zero tentativas nas quatro fases. O processo Node/Next executou como PID 1, UID/GID 10001, sem capabilities efetivas. Foram removidos os contêineres, o banco e os relays do ensaio. A prova cobre essas jornadas contra a imagem. O registro de homologação/registry e a suíte Chromium completa em Next local são separados. [Recibo](artifacts/E3-image/http-aa2bf392-4bb1-4170-a443-15cbc42f2a2c/run.json).

### Interrupção da publicação e corpo da retirada

O Next foi encerrado por SIGKILL com a raiz promovida e a confirmação SQL ainda pendente. Após iniciar outro processo com o mesmo build, o worker confirmou a operação automaticamente. Operação, revisão, geração e SHA-256 de `current.json` permaneceram idênticos. A primeira tentativa do fixture parou com 401 na leitura de status. O recibo seguinte comprovou o encerramento e a retomada. O wrapper registrou saída 2 por uma mudança no inventário de listeners de 55433, enquanto o Playwright saiu 0 e a limpeza dos recursos descartáveis passou. A inspeção posterior identificou o contêiner visual original e o mesmo build. [Relatório](artifacts/E3-cache/publication-worker-crash-report.md).

Dois testes reproduziram a aceitação de HTML antigo com status 410, nos estados editorial e técnico. O observador passou a conferir o documento que o proxy produziria para a raiz selecionada, com o mesmo renderizador. Os 73 testes focados passaram. A nova execução em Next real aprovou as três jornadas de publicação e manteve os hashes das 41 capturas históricas. A mídia revogada permaneceu pendente diante de bytes antigos e a resposta 410 legítima permitiu a confirmação. [RED](artifacts/E3-cache/withdrawal-exact-body-red-001.txt), [GREEN](artifacts/E3-cache/withdrawal-exact-body-green-001.txt) e [Chromium](artifacts/E3-gates/e2e-004-result.json).

### Gate e imagem da revisão atual

O gate 010 terminou com saída 0 no Node 24.22.2 e pnpm 12.10.1. Passaram tipagem, lint, formato, 209 arquivos do Vitest com 1938 testes aprovados e 3 pulados, CSS, progresso e build Next. Houve quatro avisos históricos de lint. A fonte preservada coincide com o Chromium focado e com a imagem 008. [Gate](artifacts/E3-gates/verify-010-result.json).

A imagem 008 é `sha256:f554359cc82ceef66a11e00178eb122042c5556634055c8b86c6b64ec3b0502c`. Passou os smokes nativos, 14 camadas sem caminhos vedados, 88 estáticos/manifestos sem marcadores e o probe offline em 5642 ms. Os dois ambientes locais passaram 82 verificações HTTP e quatro jornadas Chromium antes e depois dos reinícios. O login usou o avatar local, com zero tentativas externas e zero WebSockets. Os processos eram PID 1 com UID/GID 10001. Os recursos descartáveis foram removidos. [Recibo da imagem](artifacts/E3-image/docker-draft-build-008.json) e [ensaio HTTP/Chromium](artifacts/E3-image/http-f8abf50f-89b5-4a73-8738-f47832feac38/run.json).

### Sitemap indexável e limite de novas tentativas

O sitemap indexável do Next serviu as URLs atuais e alternates PT/EN da mesma geração, excluindo rascunho, slug histórico e tradução retirada. XML antigo com marcador atual manteve a atualização pendente. A repetição confirmou a mesma operação, revisão e geração com o XML correto. O worker comprovou 1/5/15 s como horários de elegibilidade, limite de três tentativas automáticas, persistência ao recriar o dreno e rearme manual autorizado. 23 testes Native e quatro jornadas Chromium passaram. O alvo de 60 s fica para medição e aprovação A3. [Prova local da E3.2.3](artifacts/E3-cache/e3-2-3-sitemap-retry-report.md).

### Cache confirmado em volume Docker

Prova Docker local de 04/11/2026 com a imagem 008 e PostgreSQL descartável. Depois de remover o banco e recriar o contêiner com o mesmo volume nomeado, Home e listagem PT/EN mantiveram 200, a mesma geração e o mesmo SHA-256 de current.json. Caminho sem cobertura passou de 404 com banco disponível para 503 com no-store e Retry-After. Uma origem distinta montando o mesmo volume recebeu 503 sem geração. Montagem e isolamento comprovados localmente, com ativação em VPS ainda pendente. [Recibo do volume nomeado](artifacts/E3-cache/named-volume-001.json).

## Conteúdo implantado e primeira frente concluída — 06/11/2026

A publicação do conteúdo da Eliana e a validação de noindex/Analytics desativado encerraram E3.4.4. E3.4 está em5/5; o total passa a16/30 critérios e1/6 frentes integralmente encerradas, sem aprovação A3/A4. Ver [recibo](artifacts/E3-operations/eliana-content-staging-001.json).
