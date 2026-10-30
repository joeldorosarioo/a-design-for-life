# Progresso verificável — etapa 2

**53,3%: 16 de 30 itens do checklist concluídos. Uma de seis tarefas inteiramente encerrada (E2.1). A2 pendente.**

A métrica anterior16,7% contava somente tarefas fechadas e ocultava avanços parciais. Após a observação do usuário, o indicador principal passa a contar as30caixas do plano original: cinco por tarefa, com peso igual e sem pontuação parcial. Não mede horas, esforço ou percentual de testes aprovados. Os documentos originais continuam imutáveis; este registro deriva deles.

Uma caixa que pede escrever e observar o primeiro RED pode estar concluída enquanto o comportamento correspondente continua em implementação nas caixas seguintes. Isso está explícito em E2.5.1. Nenhuma aprovação ou verificação final é inferida desse número. Se uma mudança invalidar a evidência de um item, ele volta a pendente.

| Tarefa | Itens concluídos | Estado da tarefa |
| ------ | ---------------- | ---------------- |
| E2.1   | 5/5              | Encerrada        |
| E2.2   | 3/5              | Em andamento     |
| E2.3   | 3/5              | Em andamento     |
| E2.4   | 3/5              | Em andamento     |
| E2.5   | 2/5              | Em andamento     |
| E2.6   | 0/5              | Em andamento     |

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
- [ ] **E2.3.5** Gate e comparações de listagem/detalhes PT/EN e segundo EN. Evidência/pendência: Faltam comparação renderizada e referências ainda inacessíveis pelo editor.
- [x] **E2.4.1** Negociação/prioridade/pesos/variantes com RED/GREEN. Evidência/pendência: E2.4.md; artifacts/E2.4/evidence-manifest.json
- [x] **E2.4.2** Entrada307 privada e URLs explícitas sem negociação. Evidência/pendência: artifacts/E2-ui-transport-preparation/e2e-final.txt; artifacts/E2-public-pages-integration/E2-public-pages-http-first.txt
- [x] **E2.4.3** Cookie funcional com prazo/atributos e gravação manual. Evidência/pendência: artifacts/E2-ui-transport-preparation/language-http-green.txt; artifacts/E2-ui-transport-preparation/e2e-final.txt
- [ ] **E2.4.4** Jornada completa de escolha na UI, visitas, renovação e expiração. Evidência/pendência: Oito jornadas de transporte/cookie passaram; clique real da UI e integração atual ainda aguardam GREEN.
- [ ] **E2.4.5** Gate integral atual da resolução de idioma. Evidência/pendência: Gate combinado posterior à UI pendente.
- [x] **E2.5.1** Primeiro E2E escrito e RED comportamental observado. Evidência/pendência: artifacts/E2-public-pages-integration/E2-reading-position-first-red.txt; RED: páginas200, controle English ausente. Esta caixa conclui a preparação TDD, não o comportamento final.
- [ ] **E2.5.2** Captura/restauração exata após imagens/fontes. Evidência/pendência: Controlador tem testes focados; primeiro GREEN real e timeout/layout ainda pendentes.
- [x] **E2.5.3** Chaves estáveis de seções/blocos/Perfil e lacunas resolvidas. Evidência/pendência: artifacts/E2-public-pages-integration/E2-reading-prerequisites-implementation.md; decisão do usuário registrada na execução.
- [ ] **E2.5.4** Tradução ausente, avisos, cancelamento e histórico. Evidência/pendência: Classificação Native passou; jornadas completas de UI ainda pendentes.
- [ ] **E2.5.5** Matriz das quatro páginas, viewport, mídia lenta e gate. Evidência/pendência: Primeira jornada real em integração; matriz completa ainda não executada.
- [ ] **E2.6.1** Metadados, sitemap/alternates e exclusões verificados. Evidência/pendência: Gerador46/46; sitemap/robots e provas HTTP completas pendentes.
- [ ] **E2.6.2** Acessibilidade automatizada e inspeção manual completa. Evidência/pendência: Menu/links têm provas; faltam leitor de tela, zoom e auditoria integrada.
- [ ] **E2.6.3** Comparação visual completa e larguras intermediárias. Evidência/pendência: Oito baselines disponíveis; preview visual e comparações completas pendentes.
- [ ] **E2.6.4** Jornadas públicas/privadas, gate e diagnóstico de desempenho. Evidência/pendência: Backend de preview Native7/7; UI privada e gate atual pendentes.
- [ ] **E2.6.5** Pacote A2 demonstrável entregue com modelos privados. Evidência/pendência: Entrega A2 ainda não produzida; etapa3 depende da aprovação posterior.

## Gates ainda necessários

O último verify integral foi729aprovados/2skipsWindows no snapshot preparado; não cobre automaticamente a integração posterior. Os gates HTTP posteriores passaram6jornadas públicas e1de imagem, nos seus snapshots. O primeiro teste da UI de leitura teve RED legítimo; uma tentativa posterior parou por um import relativo incorreto antes de executar jornadas. O import foi corrigido e a tipagem atual passou; o navegador precisa ser repetido.

Continuam obrigatórios: leitura/fallback/histórico e mídia lenta; prévia visual autenticada com modelos em rascunho; mensagens negativas editoriais; sitemap/robots e SEO HTTP; comparação Figma completa, teclado/leitor/zoom/contraste; gate integral atual, CI e pacote A2. Estimativa atual de trabalho restante: **12–18horas**, sujeita às verificações, sem horário garantido.
