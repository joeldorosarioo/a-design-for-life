# Progresso verificável — etapa 2

**83,3%: 25/30 itens; 3/6 tarefas inteiramente encerradas. A2 pendente.**

Antes de cada atualização, revisar novas evidências e itens afetados, atualizar os estados e executar `node scripts/recalculate-stage-progress.mjs`. O comando recalcula as contagens e deriva as tarefas fechadas; não decide sozinho se um critério foi atendido. `--check` confere sem escrever.

A métrica conta as trinta caixas do plano original, cinco por tarefa, com peso igual e sem crédito parcial. Mede entregas, não esforço, horas ou percentual de testes. A caixa de preparação do primeiro RED pode estar concluída com a implementação ainda aberta nas seguintes (E2.5.1). Evidência invalidada por mudança torna o item pendente novamente. Os originais e logs históricos permanecem imutáveis.

| Tarefa | Itens | Estado       |
| ------ | ----- | ------------ |
| E2.1   | 5/5   | Encerrada    |
| E2.2   | 4/5   | Em andamento |
| E2.3   | 4/5   | Em andamento |
| E2.4   | 5/5   | Encerrada    |
| E2.5   | 5/5   | Encerrada    |
| E2.6   | 2/5   | Em andamento |

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
- [ ] **E2.2.5** Gate integral e comparação visual Home/Sobre. Evidência/pendência: Gates Windows final-003 concluídos: verify exit0,1164pass/2skips/144arquivos+2CSS; fullE2E113/113exit0. Build008 XCwWNaSVVZ2kr6jeLy4Aa/fonte500digestf49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784. Atualização das capturas/auditorias V9 e CI Linux no SHA exato ainda necessárias; caixa permanece aberta.
- [x] **E2.3.1** Ordem/destaques por idioma, contagem e falha sem lista vazia. Evidência/pendência: artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt; artifacts/E2-preparation/evidence-manifest.json
- [x] **E2.3.2** Texto permitido, dupla imagem em ordem e sumário derivado. Evidência/pendência: artifacts/E2-public-pages-integration/E2-cases-unit-final-authoritative.log; artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt
- [x] **E2.3.3** Comparação tipada, dimensões/sizes e prioridade de imagens. Evidência/pendência: artifacts/E2-public-pages-integration/E2-cases-ui-report.md; artifacts/E2-public-pages-integration/E2-public-image-http-green.txt
- [x] **E2.3.4** Todos os estados públicos com apresentação editorial aprovada. Evidência/pendência: artifacts/E2-negative-editorial/evidence-manifest.json;5/5HTTP exit0:404 desconhecido/privado indistinguíveis em PT/EN,HEAD/condicionais/RSC,retiradaPT410 mantendoEN200,cobertura Native ausente503/Retry60,CSS200,contatos/PDF e header sticky1440/390/texto200%. Mesma raiz capturada; fallback A1 sem estrutura preservado. Gate agregado e aceite visual seguem nas caixas próprias.
- [ ] **E2.3.5** Gate e comparações de listagem/detalhes PT/EN e segundo EN. Evidência/pendência: Gates Windows final-003 concluídos: verify exit0,1164pass/2skips/144arquivos+2CSS; fullE2E113/113exit0. Build008 XCwWNaSVVZ2kr6jeLy4Aa/fonte500digestf49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784. Atualização das capturas/auditorias V9 e CI Linux no SHA exato ainda necessárias; caixa permanece aberta.
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
- [ ] **E2.6.4** Jornadas públicas/privadas, gate e diagnóstico de desempenho. Evidência/pendência: final-003: verify0(1164pass/2skips/144files+2CSS), fullE2E0(113/113), todos500hashes estáveis e12PNGs A1 originais restaurados. Inclui HTTP308/FontFace reais GREEN após falhas001/002 preservadas. Diagnóstico00718LH/20recursos é snapshot anterior; novo diagnóstico008, CI e restauração pós-teardown ainda necessários.
- [ ] **E2.6.5** Pacote A2 demonstrável entregue com modelos privados. Evidência/pendência: 18capturasV9 e duas demonstrações008 atuais com hashes/recibos e fonte500 conferidos. Exportgates19/19 revisado; pacote final ainda não montado/entregue. A2 pendente; etapa3 não autorizada.

## Gates e limites

Gates Windows completos008, visual/responsividade e fila axe atuais concluídos; percurso manual008 com teclado/zoom200% realizado. Restauração pós-teardown003 exit0/SQL197522exato/10drafts7mediaRootNULLops0/28objetos.20observações de recursos008 prontas,18LH em andamento. CI/commits/pacote ainda pendentes; leitor formal continua desativado por orientação do usuário.

Retomada autorizada explicitamente em03/11/2026; avisos antigos de pausa são históricos. Raiz E:\a-design-for-life, develop, runtimeNode24.22.2/pnpm12.10.1/lockfile preservados. Nenhum commit novo ou promoção remota foi feito ainda nesta retomada.

Candidata008: BuildID XCwWNaSVVZ2kr6jeLy4Aa, fonte500/digestf49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784. verify0 e E2E113/113 atuais. A evidência007 permanece vinculada ao seu build/digest anterior; não é renomeada como captura008.

Fixture privadaV5 carregada/atualizada e revalidação dos10rascunhos/7mídias realizada; Rootnulo/0operações públicas, todasrevisões preservadas. Migração doscards e nova migração aditiva de apresentação/retorno aplicadas somente em bancos isolados. Cinco originais,18capturas históricas e28objetos privados preservados.

CheckpointV5 restaurado em banco isolado novo, SQL de dados197522caracteres idêntico após normalizar apenas chavesrestrict aleatórias. Dump original186227bytes SHA256E4BEECB735A873C831217DBFB901BD53B3DC41A2CD7BF41FD05F57AFB3CBCC91 preservado. Runnersglobais removem o container55433; restauração posterior guardada foi preparada. Portas5432/55432 preservadas.

Leitor de tela formal permanece incompleto. O NVDA foi encerrado ao receber a instrução do usuário, não será reiniciado nesta execução; auditoria automática e árvore acessível não substituem essa prova.

Preparação/leituras auxiliares anteriores que usaram node24.21do shell não são gates da aplicação. Builds e jornadas da aplicação usam o Node portátil24.22.2; checagens finais usarão executável/ambiente pinados explicitamente.

Nenhum Analytics, produção, contratação ou integração da etapa3 foi ativado. O pacoteA2 registrará comandos/exits/snapshots/limites atuais e pendências nomeadas.

Histórico anterior à retomada — Gate integral atual exit0:1048testes passaram,2Windows skips,131arquivos; tipos,lint(0erros/4avisos herdados),formato e build passaram. Banco isolado limpo. Falhas históricas de instalação,fixtures,formato e assertions continuam preservadas nos respectivos artefatos.

Histórico anterior à retomada — Lote público atual63/63exit0,BuildIDeW1hAx7oCWrO98E-xBAyT;446hashes conferidos antes da captura do gate. A falha real de decode prematuro foi reproduzida em2REDunits, corrigida e comprovada no navegador com imagens/fontes reais e cancelamento; diagnóstico temporário removido.

Histórico anterior à retomada — Prévia privada:8/8HTTP,20unit/50Native focados anteriores e frame17/17+46regressões. Native completo atual inclui a correção final de tipagem/isolaçãodo seletor. O layout privado não monta o provider de leitura público.

Histórico anterior à retomada — E2.4 eE2.5 encerradas no escopo funcional e gate atual. A2 ainda depende de fidelidade visual,SEO completo,a11y/manual,desempenho inicial e pacote demonstrável privado. Dois testes de plataformaWindows precisam de execuçãoLinuxCI atual; regressão antigaA1browser eCI ainda pendentes.

Histórico anterior à retomada — Todos os18frames/textos e5originais estão disponíveis, privados. Loader visual Native ainda não executado. Campos específicos do card dependem da resposta do usuário; nenhum campo novo ou texto profissional foi publicado.

Histórico anterior à retomada — Novas mudanças posteriores a esta captura exigem as regressões afetadas antes da entrega final. Etapa3 continua sem autorização.

Histórico anterior à retomada — Novo milestone SEO/idioma privado:13/13HTTPexit0,9Native privados e6NativeReader passaram. Estado atual dos arquivos posteriores ao gate1048 ainda exige verificação agregada; não é aprovação A2. Rascunhos continuam privados e Analytics não foi ativado.

Histórico anterior à retomada — Negativos editoriais integrados:5/5HTTP exit0 no BuildIDxAv0xWu583U-tm8mDJkdf. RED HTTP real observou o texto técnico A1 antes da composição. Isso fecha E2.3.4, sem antecipar comparação visual, auditoria manual ou gate final A2.

Histórico anterior à retomada — Pausa explícita solicitada pelo usuário após concluir cardTitle/cardEyebrow editáveis comfallback (c3b4860):38unit+6Native,tipos/lint/formato0; coordenador44unit+2CSS atuais. Nenhuma nova caixa completa; visual/gate/a11y/performance/A2 seguem abertos. Retomada registrada em retomada-etapa-2.md.

Estimativa: 2–4 horas para restauração, evidências atuais, CI e pacote; sujeitas a falhas, sem garantia de horário. Não inclui leitor de tela, interrompido por orientação do usuário.

A2 pendente; etapa3 depende da aprovação explícita do usuário.
