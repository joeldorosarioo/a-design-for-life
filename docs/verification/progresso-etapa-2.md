> **Atualização de 03/11/2026:** A2 aprovada pelo usuário com a pendência do leitor de tela registrada; E3 explicitamente retomada após a pausa histórica. Estado atual em [retomada-etapa-3.md](evidence-index.md#archived-records 'bee7667:docs/verification/retomada-etapa-3.md'). Critérios e logs abaixo preservam as evidências históricas; contagens atuais não certificam novamente a suíte.

# Progresso verificável — etapa 2

**93,3%: 28/30 itens; 4/6 tarefas inteiramente encerradas. Aprovação registrada: A2 approved with screen-reader work outstanding; stage3 explicitly resumed on 2026-11-03.**

Antes de cada atualização, revisar novas evidências e itens afetados, atualizar os estados e executar `node scripts/recalculate-stage-progress.mjs`. O comando recalcula as contagens e deriva as tarefas fechadas; não decide sozinho se um critério foi atendido. `--check` confere sem escrever.

A métrica conta as 30 caixas do plano original, distribuídas em 5/5/5/5/5/5 por tarefa, com peso igual e sem crédito parcial. Mede entregas, não esforço, horas ou percentual de testes. Evidência invalidada por mudança torna o item pendente novamente. Os originais e logs históricos permanecem imutáveis. Aprovação do usuário é independente da contagem.

A caixa de preparação do primeiro RED pode estar concluída com a implementação ainda aberta nas seguintes (E2.5.1).

| Tarefa | Itens | Estado       |
| ------ | ----- | ------------ |
| E2.1   | 5/5   | Encerrada    |
| E2.2   | 5/5   | Encerrada    |
| E2.3   | 4/5   | Em andamento |
| E2.4   | 5/5   | Encerrada    |
| E2.5   | 5/5   | Encerrada    |
| E2.6   | 4/5   | Em andamento |

## Checklist e evidências

- [x] **E2.1.1** Referências, skills, originais e proveniência conferidos. Evidência/pendência: E2.1.md; artifacts/E2.1/reference-final/verified.json
- [x] **E2.1.2** Tokens e escalas da referência centralizados. Evidência/pendência: E2.1.md; ../architecture/mapeamento-figma.md
- [x] **E2.1.3** Reutilização/primitivas e teste inicial da política de movimento. Evidência/pendência: E2.1.md; artifacts/E2.1/evidence-manifest.json
- [x] **E2.1.4** RED/GREEN de movimento reduzido e conteúdo SSR legível. Evidência/pendência: E2.1.md; artifacts/E2.1/foundation-final-focused.txt
- [x] **E2.1.5** Gate da fundação, bundle e usos de contraste registrados. Evidência/pendência: E2.1.md; artifacts/E2-preparation/evidence-manifest.json
- [x] **E2.2.1** Destinos/rótulos fixos e contatos tipados com RED/GREEN. Evidência/pendência: E2.2.md; artifacts/E2.2/evidence-manifest.json
- [x] **E2.2.2** Menu, foco e contato sem encobrimento pelo header. Evidência/pendência: artifacts/E2-reading-combined-first/evidence-manifest.json; comando combinado público atual exit1:62pass/1fail (recurso isolado ainda aberto),BuildIDwHP23HxlKeU8wa4bCtwv5,Node24.22.2; Contato16/16:quatro páginas×PT/EN×desktop/mobile,mesmo pathname,gapcontato.top−Header.bottom≥0,diálogo mobile fechado e foco real em#contact; menu/teclado também cobertos pelos6E2Epúblicos e testesUI.
- [x] **E2.2.3** Home e Sobre compostas pelos grupos estruturados do Perfil. Evidência/pendência: artifacts/E2-ui-transport-preparation/home-about-green.txt; artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt
- [x] **E2.2.4** Currículos PT/EN em nova aba e destaques privados filtrados. Evidência/pendência: artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt
- [x] **E2.2.5** Gate integral e comparação visual Home/Sobre. Evidência/pendência: Candidata008/XCwWNaSVVZ2kr6jeLy4Aa/fonte500f49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784:18capturasV9 atuais/982checks/81cenários, revisões Home/Sobre completas. GatesWindows003 verify1164pass/2skips+2CSS/E2E113; CI Ubuntu24.04 no SHA c9be4dc23c12f45fadd27cafc05a599b8b3a0c44 SUCCESS,run41655739795,1166/1166sem skips+2CSS/113E2E. E2.2 integralmente encerrada.
- [x] **E2.3.1** Ordem/destaques por idioma, contagem e falha sem lista vazia. Evidência/pendência: artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt; artifacts/E2-preparation/evidence-manifest.json
- [x] **E2.3.2** Texto permitido, dupla imagem em ordem e sumário derivado. Evidência/pendência: artifacts/E2-public-pages-integration/E2-cases-unit-final-authoritative.log; artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt
- [x] **E2.3.3** Comparação tipada, dimensões/sizes e prioridade de imagens. Evidência/pendência: 2026-11-14-audit-fixes.md; artifacts/audit-fixes/2026-11-14.json: image RED/GREEN, 12 delayed-image Chromium scenarios, real native preview dimensions and final full gates (238 files; 2347 passed/3 platform skips; 125 script checks; 140 E2E; build exit0). Pinned manifests enrich legacy public snapshots; cards/covers retain existing geometry. Visual acceptance stays in E2.3.5.
- [x] **E2.3.4** Todos os estados públicos com apresentação editorial aprovada. Evidência/pendência: artifacts/E2-negative-editorial/evidence-manifest.json;5/5HTTP exit0:404 desconhecido/privado indistinguíveis em PT/EN,HEAD/condicionais/RSC,retiradaPT410 mantendoEN200,cobertura Native ausente503/Retry60,CSS200,contatos/PDF e header sticky1440/390/texto200%. Mesma raiz capturada; fallback A1 sem estrutura preservado. Gate agregado e aceite visual seguem nas caixas próprias.
- [ ] **E2.3.5** Gate e comparações de listagem/detalhes PT/EN e segundo EN. Evidência/pendência: Reopened for the new first-listing-cover performance correction: exact-source1640 frame/deployed acceptance passed, but the replacement source now requires matching full gates and visual/candidate confirmation. The20 focused real-image tests passed after observedRED; see2026-11-14-audit-validation.md. Historical accepted1640 visual evidence remains in artifacts/audit-fixes/validation-2026-11-14/.
- [x] **E2.4.1** Negociação/prioridade/pesos/variantes com RED/GREEN. Evidência/pendência: E2.4.md; artifacts/E2.4/evidence-manifest.json
- [x] **E2.4.2** Entrada307 privada e URLs explícitas sem negociação. Evidência/pendência: artifacts/E2-ui-transport-preparation/e2e-final.txt; artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt
- [x] **E2.4.3** Cookie funcional com prazo/atributos e gravação manual. Evidência/pendência: artifacts/E2-ui-transport-preparation/language-http-green.txt; artifacts/E2-ui-transport-preparation/e2e-final.txt
- [x] **E2.4.4** Jornada completa de escolha na UI, visitas, renovação e expiração. Evidência/pendência: Oito jornadas atuais de cookie/expiração e matrizUI8/8(16trocas) passaram no lote63. Prazo é controlado pelo cookiejar: expiração envelhecida e expires:1, sem alterar relógio doOS/browser; Max-Age180dias e não-renovação comprovados no transporte real. artifacts/E2-reading-private-milestone/evidence-manifest.json; pnpm verify exit0,1048pass/2skipsWindows/131arquivos,tipos/lint/formato/build passaram; lote público63/63exit0 na mesma fonte de446arquivos conferidos
- [x] **E2.4.5** Gate integral atual da resolução de idioma. Evidência/pendência: artifacts/E2-reading-private-milestone/evidence-manifest.json; pnpm verify exit0,1048pass/2skipsWindows/131arquivos,tipos/lint/formato/build passaram; lote público63/63exit0 na mesma fonte de446arquivos conferidos
- [x] **E2.5.1** Primeiro E2E escrito e RED comportamental observado. Evidência/pendência: artifacts/E2-public-pages-integration/E2-reading-position-first-red.txt; RED: páginas200, controle English ausente. Esta caixa conclui a preparação TDD, não o comportamento final.
- [x] **E2.5.2** Captura/restauração exata após imagens/fontes. Evidência/pendência: Primeiro GREEN real: pnpm test:e2e reading-position.e2e.test.ts not-found.e2e.test.ts, exit0, 3/3, BuildID2jd7ygNItui2m5VNuJ4XF. Home PT/EN manteve a mesma chave em ±2px; 14/14 testes focados de remount/layout, timeout explícito e transferência temporária por Document. Matriz de outras páginas, mídia lenta e histórico permanece em E2.5.4/E2.5.5.
- [x] **E2.5.3** Chaves estáveis de seções/blocos/Perfil e lacunas resolvidas. Evidência/pendência: artifacts/E2-public-pages-integration/E2-reading-prerequisites-implementation.md; decisão do usuário registrada na execução.
- [x] **E2.5.4** Tradução ausente, avisos, cancelamento e histórico. Evidência/pendência: artifacts/E2-reading-combined-first/evidence-manifest.json; comando combinado público atual exit1:62pass/1fail (recurso isolado ainda aberto),BuildIDwHP23HxlKeU8wa4bCtwv5,Node24.22.2; Equivalência9/9e lifecycle6/6:case sem tradução e lacunas parciais com avisos no idioma de destino,sem repetição no refresh,cliques rápidos,cancelamento,Back/Forward,entrada direta e teclado sem autofocus inventado.
- [x] **E2.5.5** Matriz das quatro páginas, viewport, mídia lenta e gate. Evidência/pendência: artifacts/E2-reading-private-milestone/evidence-manifest.json; pnpm verify exit0,1048pass/2skipsWindows/131arquivos,tipos/lint/formato/build passaram; lote público63/63exit0 na mesma fonte de446arquivos conferidos
- [x] **E2.6.1** Metadados, sitemap/alternates e exclusões verificados. Evidência/pendência: artifacts/E2-seo-private-language/evidence-manifest.json;13/13HTTP (4SEO+9privados),6/6NativeReader,46metadata+17indexunit prévios;canonical próprio e alternates somenteconfirmados noHTMLsemJS;robôs/sitemapfechados emtest;seleção produção provada noRootNative real. Robots movido àraiz exigida doNext;paths internos do plano corrigidos semmudarURLs públicas.
- [ ] **E2.6.2** Acessibilidade automatizada e inspeção manual completa. Evidência/pendência: Build008 XCwWNaSVVZ2kr6jeLy4Aa: axe18layouts/27estados0violações/36incomplete; filaV9 revista34glifos+17fundosmodais,183focos/9diálogos/251alvos0falhas,contraste mínimo7,821591:1. Percurso manual008 atual em Chrome200% real:Escape/foco,Space/Tab/Enter,Sobre/Contato/ShiftTabCTA e reset100%,launcherexit0/fonte500estável. Leitor formal não concluído por decisão do usuário; NVDA desativado,não reaberto. Sem declaraçãoWCAG.
- [x] **E2.6.3** Comparação visual completa e larguras intermediárias. Evidência/pendência: Build008/fonte500digestf49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784:982/982em18alvos,18PNGs V9 atuais conferidos com seus recibos e BYTE-IDÊNTICOS aos18 do007 revisados integralmente; reutilização da revisão explicitamente registrada,nenhuma diferença nova.81cenários responsivos320–1536px/texto200%/texto longo/coresforçadas/reduzido:0falhas. ZoomChrome200%manual008 atual e reset100%. Duas diferenças pequenas de quebra pela pilha aprovada continuam nomeadas. Manifesto visual-qa-v9/final18-visual-qa-manifest.json SHA5d0ad907a8bc806f5108f140e8bd37ac93adae307a45f5b760ec4c7626108fd3. CI/gates de aceite nas caixas próprias.
- [x] **E2.6.4** Jornadas públicas/privadas, gate e diagnóstico de desempenho. Evidência/pendência: Gates atuais completos:Windows003 verify0(1164pass/2skips/144files+2CSS),E2E113/113; CI Linux SHA c9be4dc23c12f45fadd27cafc05a599b8b3a0c44 SUCCESS(1166sem skips/144files+2CSS/113E2E). Diagnóstico008:18LH/20recursos exit0,protocolo0750991d17e2d1d8f871adade90376f65d029a4aab2bc2f26eb04a718e082b45,source500/build estáveis; nãoP12/campo/INP. Restore003SQL197522exato/28objetos/10draft7mediaRootNULLops0;smoke00800418HTML/5mídias comnegações anônimas reais. Falhas001/002 e preparação smoke preservadas.
- [x] **E2.6.5** Pacote A2 demonstrável entregue com modelos privados. Evidência/pendência: Pacote privado A2-review-c9be4dc-v2 concreto/revisado:181artefatos,18PNG,2WEBM,manifestSHA3adc29d0e5b3809da96f52f1da5ef0418865a2a5d6267cbe4168f92aaf47df15. QAreal15:26:01–15:26:10UTC exit0:181hashes/108filtros/204links/18imagensporviewport/2vídeospausados,0overflow1440e390/0redeexterna/0erros;duascapturasrevistaspelo coordenador. RED390overflow236 efixmínimo wrap preservados. artifacts/a2-current008/package-review-summary.json. Entrega final outputs/A2 e reciboexterno vinculam commitdocumental/CI exatos; A2 segue aguardando aprovação,etapa3 não iniciada.

## Gates e limites

Atualização atual03/11/2026: E3 retomada explicitamente após a pausa histórica; decisão Resend e limites em retomada-etapa-3.md. A2 aprovada com pendência formal do leitor:29/30 critérios,5/6 tarefas; evidências originais preservadas.

Histórico da pausa — Atualização03/11/2026: usuário aprovou A2 com a pendência E2.6.2 preservada, autorizou E3 e depois pausou até consolidar informações. Contagens não mudam:29/30;E2.1–E2.5 encerradas. Registros anteriores de A2 pendente são históricos. Ver retomada-etapa-3.md.

Histórico anterior à aprovação A2 — E2.1–E2.5 integralmente encerradas. Build008/fonte500f49 e CI c9be4dc atuais;18LH/20recursos,restauração/smoke004 e pacoteA2real revisados. Único critério incompleto E2.6.2:leitor formal desativado por orientação do usuário. A2 aguarda revisão/aprovação;etapa3 não autorizada.

Retomada autorizada em03/11/2026,develop preservada. Implementação c9be4dc23c12f45fadd27cafc05a599b8b3a0c44 e CI41655739795 SUCCESS. O commit documental e seu CI exato ficam no recibo externo final, após promoção normal em develop protegida. Nenhum histórico publicado reescrito.

Candidata008: BuildID XCwWNaSVVZ2kr6jeLy4Aa, fonte500/digestf49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784. verify0 e E2E113/113 atuais. A evidência007 permanece vinculada ao seu build/digest anterior; não é renomeada como captura008.

Fixture privadaV5 carregada/atualizada e revalidação dos10rascunhos/7mídias realizada; Rootnulo/0operações públicas, todasrevisões preservadas. Migração doscards e nova migração aditiva de apresentação/retorno aplicadas somente em bancos isolados. Cinco originais,18capturas históricas e28objetos privados preservados.

CheckpointV5 restaurado em banco isolado novo, SQL de dados197522caracteres idêntico após normalizar apenas chavesrestrict aleatórias. Dump original186227bytes SHA256E4BEECB735A873C831217DBFB901BD53B3DC41A2CD7BF41FD05F57AFB3CBCC91 preservado. Runnersglobais removem o container55433; restauração posterior guardada foi preparada. Portas5432/55432 preservadas.

Leitor de tela formal permanece incompleto. O NVDA foi encerrado ao receber a instrução do usuário, não será reiniciado nesta execução; auditoria automática e árvore acessível não substituem essa prova.

Preparação/leituras auxiliares anteriores que usaram node24.21do shell não são gates da aplicação. Builds e jornadas da aplicação usam o Node portátil24.22.2; checagens finais usarão executável/ambiente pinados explicitamente.

Nenhum Analytics, produção, contratação ou integração da etapa3 ativado. Pacote concreto com comandos/exits/snapshots/limites e falhas preservadas. Galeria revisada offline; originais e primeiro RED não foram substituídos.

Histórico anterior à retomada — Gate integral atual exit0:1048testes passaram,2Windows skips,131arquivos; tipos,lint(0erros/4avisos herdados),formato e build passaram. Banco isolado limpo. Falhas históricas de instalação,fixtures,formato e assertions continuam preservadas nos respectivos artefatos.

Histórico anterior à retomada — Lote público atual63/63exit0,BuildIDeW1hAx7oCWrO98E-xBAyT;446hashes conferidos antes da captura do gate. A falha real de decode prematuro foi reproduzida em2REDunits, corrigida e comprovada no navegador com imagens/fontes reais e cancelamento; diagnóstico temporário removido.

Histórico anterior à retomada — Prévia privada:8/8HTTP,20unit/50Native focados anteriores e frame17/17+46regressões. Native completo atual inclui a correção final de tipagem/isolaçãodo seletor. O layout privado não monta o provider de leitura público.

Histórico anterior à retomada — E2.4 eE2.5 encerradas no escopo funcional e gate atual. A2 ainda depende de fidelidade visual,SEO completo,a11y/manual,desempenho inicial e pacote demonstrável privado. Dois testes de plataformaWindows precisam de execuçãoLinuxCI atual; regressão antigaA1browser eCI ainda pendentes.

Histórico anterior à retomada — Todos os18frames/textos e5originais estão disponíveis, privados. Loader visual Native ainda não executado. Campos específicos do card dependem da resposta do usuário; nenhum campo novo ou texto profissional foi publicado.

Histórico anterior à retomada — Novas mudanças posteriores a esta captura exigem as regressões afetadas antes da entrega final. Etapa3 continua sem autorização.

Histórico anterior à retomada — Novo milestone SEO/idioma privado:13/13HTTPexit0,9Native privados e6NativeReader passaram. Estado atual dos arquivos posteriores ao gate1048 ainda exige verificação agregada; não é aprovação A2. Rascunhos continuam privados e Analytics não foi ativado.

Histórico anterior à retomada — Negativos editoriais integrados:5/5HTTP exit0 no BuildIDxAv0xWu583U-tm8mDJkdf. RED HTTP real observou o texto técnico A1 antes da composição. Isso fecha E2.3.4, sem antecipar comparação visual, auditoria manual ou gate final A2.

Histórico anterior à retomada — Pausa explícita solicitada pelo usuário após concluir cardTitle/cardEyebrow editáveis comfallback (c3b4860):38unit+6Native,tipos/lint/formato0; coordenador44unit+2CSS atuais. Nenhuma nova caixa completa; visual/gate/a11y/performance/A2 seguem abertos. Retomada registrada em retomada-etapa-2.md.

Estimativa: Etapa 2 aceita com pendência do leitor registrada; etapa 3 explicitamente retomada em 03/11/2026.

Aprovação registrada: A2 approved with screen-reader work outstanding; stage3 explicitly resumed on 2026-11-03.
