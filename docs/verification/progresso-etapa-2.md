# Progresso verificável — etapa 2

**56,7%: 17/30 itens; 1/6 tarefas inteiramente encerradas. A2 pendente.**

Antes de cada atualização, revisar novas evidências e itens afetados, atualizar os estados e executar `node scripts/recalculate-stage-progress.mjs`. O comando recalcula as contagens e deriva as tarefas fechadas; não decide sozinho se um critério foi atendido. `--check` confere sem escrever.

A métrica conta as trinta caixas do plano original, cinco por tarefa, com peso igual e sem crédito parcial. Mede entregas, não esforço, horas ou percentual de testes. A caixa de preparação do primeiro RED pode estar concluída com a implementação ainda aberta nas seguintes (E2.5.1). Evidência invalidada por mudança torna o item pendente novamente. Os originais e logs históricos permanecem imutáveis.

| Tarefa | Itens | Estado       |
| ------ | ----- | ------------ |
| E2.1   | 5/5   | Encerrada    |
| E2.2   | 3/5   | Em andamento |
| E2.3   | 3/5   | Em andamento |
| E2.4   | 3/5   | Em andamento |
| E2.5   | 3/5   | Em andamento |
| E2.6   | 0/5   | Em andamento |

## Checklist e evidências

- [x] **E2.1.1** Referências, skills, originais e proveniência conferidos. Evidência/pendência: E2.1.md; artifacts/E2.1/reference-final/verified.json
- [x] **E2.1.2** Tokens e escalas da referência centralizados. Evidência/pendência: E2.1.md; ../architecture/mapeamento-figma.md
- [x] **E2.1.3** Reutilização/primitivas e teste inicial da política de movimento. Evidência/pendência: E2.1.md; artifacts/E2.1/evidence-manifest.json
- [x] **E2.1.4** RED/GREEN de movimento reduzido e conteúdo SSR legível. Evidência/pendência: E2.1.md; artifacts/E2.1/foundation-final-focused.txt
- [x] **E2.1.5** Gate da fundação, bundle e usos de contraste registrados. Evidência/pendência: E2.1.md; artifacts/E2-preparation/evidence-manifest.json
- [x] **E2.2.1** Destinos/rótulos fixos e contatos tipados com RED/GREEN. Evidência/pendência: E2.2.md; artifacts/E2.2/evidence-manifest.json
- [ ] **E2.2.2** Menu, foco e contato sem encobrimento pelo header. Evidência/pendência: Menu anterior passou em HTTP; offsets do header sticky recém-aprovado aguardam regressão real.
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
- [ ] **E2.4.4** Jornada completa de escolha na UI, visitas, renovação e expiração. Evidência/pendência: Oito jornadas de transporte/cookie passaram; primeiro clique real Home PT→EN passou com204 e prazo de180dias. A matriz completa de UI, visitas, renovação e expiração ainda precisa de regressão agregada atual.
- [ ] **E2.4.5** Gate integral atual da resolução de idioma. Evidência/pendência: Gate combinado posterior à UI pendente.
- [x] **E2.5.1** Primeiro E2E escrito e RED comportamental observado. Evidência/pendência: artifacts/E2-public-pages-integration/E2-reading-position-first-red.txt; RED: páginas200, controle English ausente. Esta caixa conclui a preparação TDD, não o comportamento final.
- [x] **E2.5.2** Captura/restauração exata após imagens/fontes. Evidência/pendência: Primeiro GREEN real: pnpm test:e2e reading-position.e2e.test.ts not-found.e2e.test.ts, exit0, 3/3, BuildID2jd7ygNItui2m5VNuJ4XF. Home PT/EN manteve a mesma chave em ±2px; 14/14 testes focados de remount/layout, timeout explícito e transferência temporária por Document. Matriz de outras páginas, mídia lenta e histórico permanece em E2.5.4/E2.5.5.
- [x] **E2.5.3** Chaves estáveis de seções/blocos/Perfil e lacunas resolvidas. Evidência/pendência: artifacts/E2-public-pages-integration/E2-reading-prerequisites-implementation.md; decisão do usuário registrada na execução.
- [ ] **E2.5.4** Tradução ausente, avisos, cancelamento e histórico. Evidência/pendência: Classificação Native passou; jornadas completas de UI ainda pendentes.
- [ ] **E2.5.5** Matriz das quatro páginas, viewport, mídia lenta e gate. Evidência/pendência: Primeira jornada real em integração; matriz completa ainda não executada.
- [ ] **E2.6.1** Metadados, sitemap/alternates e exclusões verificados. Evidência/pendência: Gerador46/46; sitemap/robots e provas HTTP completas pendentes.
- [ ] **E2.6.2** Acessibilidade automatizada e inspeção manual completa. Evidência/pendência: Menu/links têm provas; faltam leitor de tela, zoom e auditoria integrada.
- [ ] **E2.6.3** Comparação visual completa e larguras intermediárias. Evidência/pendência: Todos os18baselines disponíveis. Prévia visual privada e comparação renderizada completa ainda pendentes.
- [ ] **E2.6.4** Jornadas públicas/privadas, gate e diagnóstico de desempenho. Evidência/pendência: Prévia visual autenticada no build de produção local:8/8HTTP (HTML semJSPT/EN nasquatro páginas,HEAD,Flight/prefetch,mídia/PDF privados,negações e revogação). Fonte474arquivos+78exports em artifacts/E2-private-preview. Faltam gate integral atual,jornadas públicas ampliadas e diagnóstico de desempenho.
- [ ] **E2.6.5** Pacote A2 demonstrável entregue com modelos privados. Evidência/pendência: Entrega A2 ainda não produzida; etapa3 depende da aprovação posterior.

## Gates e limites

Último gate integral pnpm verify:exit1,970pass1fail2skip/124arquivos. O teste de lista privada pressupunha banco vazio; RED de isolamento reproduzido e GREEN9/9 na mesma ordem. Após ajuste apenas de tipagem no seletor, getter7/7+Proxy1/1 passaram; repetir o par com o arquivo legado correto ainda pendente. Gate integral após as novas fontes permanece aberto.

Prévia privada:20/20unit e50/50Native (o50 inclui o39 anterior). Frame17/17+46regressões; Proxy35/35unit e1/1Native. Tipagem completa exit0 após trocar toSorted por cópia+sort, preservando a libTypeScript aprovada.

HTTP privado atual exit0,8/8,BuildIDHqSsC4h2NmoWBbjHU3mLo,Node24.22.2/Next16.4.3/Payload3.92.1/PostgreSQL17.11isolado55433. Falhas anteriores de filtro sem testes,fixture sem retrato e protocolo de prefetch estão preservadas e separadas do RED404 original. Serviços encerrados e snapshot de474fontes/78exports registrado antes da próxima janela.

Todos os18frames e textos necessários estão disponíveis com origem e hashes. O loader visual Native ainda não foi executado; não há comparação renderizada completa, conteúdo demonstrativo publicado ou aprovação A2.

Primeira troca real HomePT→EN passou em±2px; Nativeclassificação e14units de remount/layout passaram. Nova matriz de leitura e contato está na janela isolada de navegador; itens correspondentes só mudam após os resultados.

Campos específicos de título/identificação do card dependem da resposta à lacuna apresentada ao usuário. Sumário continua derivado de seções; nenhuma lista manual ou artigo profissional foi inventado.

Estimativa: 12–18 hours of work, updated after user asked for remaining time; not a guaranteed delivery time.

A2 pendente; etapa3 depende da aprovação explícita do usuário.
