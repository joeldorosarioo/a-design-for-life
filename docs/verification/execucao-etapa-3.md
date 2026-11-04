# Execução autorizada — etapa 3

**Etapa 3: 23,3% do checklist (7/30 itens); 0/6 tarefas inteiramente encerradas. Aprovação registrada: A3 pending; E3 local execution explicitly resumed on 2026-11-03; production remains unauthorized.**

Fonte: plano original aprovado em `../specs/2026-10-29-portfolio-plano-implementacao.md`, E3.1–E3.6. A métrica preserva as trinta caixas originais, cinco por tarefa e sem crédito parcial. Contagens/evidências em [progresso-etapa-3.md](progresso-etapa-3.md); autorização e histórico da pausa em [retomada-etapa-3.md](retomada-etapa-3.md).

Em 03/11/2026 o usuário retomou explicitamente E3 após a pausa para reunir informações. A2 aprovada com a pendência formal do leitor de tela preservada: 29/30 critérios e cinco tarefas inteiramente encerradas. NVDA permanece desativado. A3/A4 não aprovadas; nenhuma produção autorizada.

Estimativa inicial: **24–40 horas de trabalho**, excluindo esperas externas. Rever diante de bloqueio concreto. Desenvolvimento e testes locais primeiro; serviços e custos precisam ser apresentados antes de contratar.

## Acompanhamento

- [ ] E3.1 Ambientes R2 e e-mail reais — 0/5 critérios.
- [ ] E3.2 Cache, invalidação e recuperação de atualização pública — 2/5 critérios.
- [ ] E3.3 Google Analytics automático sem cookies — 0/5 critérios.
- [ ] E3.4 Imagem única, configuração de execução e homologação — 3/5 critérios.
- [ ] E3.5 Migrações, logs e verificações de saúde — 1/5 critérios.
- [ ] E3.6 Backup criptografado e restauração isolada — 1/5 critérios.
- [ ] Pacote A3 com evidências e limitações concretas entregue.
- [ ] A3 aprovada explicitamente pelo usuário.

## Decisões e bloqueios externos

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

### Gate completo da fonte local atual

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
