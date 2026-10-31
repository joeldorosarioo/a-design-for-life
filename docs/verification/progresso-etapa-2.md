# Progresso verificável — etapa 2

**76,7%: 23/30 itens; 3/6 tarefas inteiramente encerradas. A2 pendente.**

Antes de cada atualização, revisar novas evidências e itens afetados, atualizar os estados e executar `node scripts/recalculate-stage-progress.mjs`. O comando recalcula as contagens e deriva as tarefas fechadas; não decide sozinho se um critério foi atendido. `--check` confere sem escrever.

A métrica conta as trinta caixas do plano original, cinco por tarefa, com peso igual e sem crédito parcial. Mede entregas, não esforço, horas ou percentual de testes. A caixa de preparação do primeiro RED pode estar concluída com a implementação ainda aberta nas seguintes (E2.5.1). Evidência invalidada por mudança torna o item pendente novamente. Os originais e logs históricos permanecem imutáveis.

| Tarefa | Itens | Estado       |
| ------ | ----- | ------------ |
| E2.1   | 5/5   | Encerrada    |
| E2.2   | 4/5   | Em andamento |
| E2.3   | 3/5   | Em andamento |
| E2.4   | 5/5   | Encerrada    |
| E2.5   | 5/5   | Encerrada    |
| E2.6   | 1/5   | Em andamento |

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
- [ ] **E2.2.5** Gate integral e comparação visual Home/Sobre. Evidência/pendência: Comparação renderizada Figma e gate após as últimas mudanças ainda abertos.
- [x] **E2.3.1** Ordem/destaques por idioma, contagem e falha sem lista vazia. Evidência/pendência: artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt; artifacts/E2-preparation/evidence-manifest.json
- [x] **E2.3.2** Texto permitido, dupla imagem em ordem e sumário derivado. Evidência/pendência: artifacts/E2-public-pages-integration/E2-cases-unit-final-authoritative.log; artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt
- [x] **E2.3.3** Comparação tipada, dimensões/sizes e prioridade de imagens. Evidência/pendência: artifacts/E2-public-pages-integration/E2-cases-ui-report.md; artifacts/E2-public-pages-integration/E2-public-image-http-green.txt
- [ ] **E2.3.4** Todos os estados públicos com apresentação editorial aprovada. Evidência/pendência: Negativos de detalhe preservam renderer A1; apresentação editorial/contato na página ainda precisa do acabamento A2.
- [ ] **E2.3.5** Gate e comparações de listagem/detalhes PT/EN e segundo EN. Evidência/pendência: Todos os18frames e textos de referência estão disponíveis, com origem e hashes. Faltam comparação renderizada e gate atual.
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
- [ ] **E2.6.2** Acessibilidade automatizada e inspeção manual completa. Evidência/pendência: Menu/links têm provas; faltam leitor de tela, zoom e auditoria integrada.
- [ ] **E2.6.3** Comparação visual completa e larguras intermediárias. Evidência/pendência: Todos os18baselines disponíveis. Prévia visual privada e comparação renderizada completa ainda pendentes.
- [ ] **E2.6.4** Jornadas públicas/privadas, gate e diagnóstico de desempenho. Evidência/pendência: Prévia visual autenticada no build de produção local:8/8HTTP (HTML semJSPT/EN nasquatro páginas,HEAD,Flight/prefetch,mídia/PDF privados,negações e revogação). Fonte474arquivos+78exports em artifacts/E2-private-preview. Faltam gate integral atual,jornadas públicas ampliadas e diagnóstico de desempenho.
- [ ] **E2.6.5** Pacote A2 demonstrável entregue com modelos privados. Evidência/pendência: Entrega A2 ainda não produzida; etapa3 depende da aprovação posterior.

## Gates e limites

Gate integral atual exit0:1048testes passaram,2Windows skips,131arquivos; tipos,lint(0erros/4avisos herdados),formato e build passaram. Banco isolado limpo. Falhas históricas de instalação,fixtures,formato e assertions continuam preservadas nos respectivos artefatos.

Lote público atual63/63exit0,BuildIDeW1hAx7oCWrO98E-xBAyT;446hashes conferidos antes da captura do gate. A falha real de decode prematuro foi reproduzida em2REDunits, corrigida e comprovada no navegador com imagens/fontes reais e cancelamento; diagnóstico temporário removido.

Prévia privada:8/8HTTP,20unit/50Native focados anteriores e frame17/17+46regressões. Native completo atual inclui a correção final de tipagem/isolaçãodo seletor. O layout privado não monta o provider de leitura público.

E2.4 eE2.5 encerradas no escopo funcional e gate atual. A2 ainda depende de fidelidade visual,SEO completo,a11y/manual,desempenho inicial e pacote demonstrável privado. Dois testes de plataformaWindows precisam de execuçãoLinuxCI atual; regressão antigaA1browser eCI ainda pendentes.

Todos os18frames/textos e5originais estão disponíveis, privados. Loader visual Native ainda não executado. Campos específicos do card dependem da resposta do usuário; nenhum campo novo ou texto profissional foi publicado.

Novas mudanças posteriores a esta captura exigem as regressões afetadas antes da entrega final. Etapa3 continua sem autorização.

Novo milestone SEO/idioma privado:13/13HTTPexit0,9Native privados e6NativeReader passaram. Estado atual dos arquivos posteriores ao gate1048 ainda exige verificação agregada; não é aprovação A2. Rascunhos continuam privados e Analytics não foi ativado.

Estimativa: 12–18 hours of work, updated after user asked for remaining time; not a guaranteed delivery time.

A2 pendente; etapa3 depende da aprovação explícita do usuário.
