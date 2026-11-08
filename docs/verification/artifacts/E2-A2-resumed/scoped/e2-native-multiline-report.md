# E2 — preservar LF editorial na edição nativa

Estado: RED real observado, configuração mínima implementada e GREEN real no novo build combinado. Não é conclusão A2.

## Problema demonstrado e correção

Quatro campos existentes têm quebras de linha literais comprovadas na referência, mas o painel os apresentava como input de uma linha: Perfil `homeAbout.title`, Perfil `about.title`, Navegação `footer.title` e Case `sections[].heading`.

O teste adjacente `src/config/editorial-multiline.e2e.test.ts` utiliza Payload/PostgreSQL reais, login real no painel e controles nativos. Preenche duas linhas, aciona Save Draft, exige PATCH200, relê pelo fetch autenticado do navegador e confere a prévia privada. O resultado do build antigo substituiu LF por espaço nos quatro campos. Três jornadas falharam por oito asserções de conteúdo, não por instalação/importação.

Alteração mínima: somente `type: 'text'` para `type: 'textarea'` nesses quatro campos. Continuam strings simples, com os mesmos nomes, contratos, validações, apresentações, identidades e publicação por idioma. Nenhum campo novo, rich text, HTML, CSS ou construtor de layout.

## Ambiente e isolamento

RED executado no BuildID **OQ24Tzea4ev6eqAw2LbDq**, Next16.4.3 em produção local na porta3101. Banco técnico novo **adfl_test_multiline_ui_20261103** no container postgres-test já conferido em loopback55433; bucket **adfl-test-multiline-ui** e namespace de mídia próprios. A prévia visual3100 e seus documentos/checkpoints não foram alterados. .env preservado. Node portátil24.22.2/pnpm12.10.1 e lockfile existentes.

Não foi usado integration-global, teardown de Compose, build ou instalação por este agente. O processo próprio Next3101, PID30652, foi conferido pelo comando exato e encerrado para o rebuild combinado do coordenador. Nenhum leitor de tela foi iniciado.

## Evidências e resultados reais

| Comando / arquivo | Resultado |
|---|---|
| Migrações oficiais no banco técnico novo (`migrate-before.log`) | exit0 |
| Primeira execução dos três testes (`native-ui-red-first.log`) | exit1 por preparação: APIRequestContext GET404; não é RED do comportamento |
| Leitura pelo fetch de origem/sessão do próprio navegador (`native-ui-red-browser-fetch.log`) | exit1;3jornadas,8asserções de LF perdido; Save Draft200/GET200 e prévias alcançadas |
| `generate:types` (`generate-types.log`) | exit0; tipos de string preservados |
| `migrate:create e2_editorial_multiline_controls --skip-empty` (`migration-skip-empty.log`) | exit0; nenhum arquivo/snapshot de migração criado |
| Consulta real information_schema no banco técnico |8colunas atuais/versões continuam `character varying`, nullableYES |
| Prettier dos três owners e teste (`format.log`) | exit0 |
| ESLint dos três owners e teste (`lint.log`) | exit0, sem erros/avisos |

O gerador oficial confirma que text/textarea têm a mesma representação física. Não se criou migração vazia artificial nem se alteraram migrações históricas. Os tipos gerados permanecem com o mesmo contrato de string.

Execução controlada: `node --conditions=react-server ./node_modules/@playwright/test/cli.js test --config .work/E2-native-multiline/playwright.controlled.config.ts`, com TEST_DATABASE_URI/TEST_SITE_ORIGIN/TEST_MEDIA_BUCKET apontando exclusivamente ao cenário acima. Esse config deliberadamente não tem globalSetup; os testes continuam descobertos pelo runner padrão para o gate integral.

O primeiro GET404 foi corrigido usando fetch no documento autenticado, que carrega a sessão e os metadados reais do navegador. Não houve alteração de autenticação, acesso ou API do produto. Esse erro de preparação foi preservado separadamente.

## GREEN atual e limites

No BuildID **W8rBO7P9kI_Dmj9Po036Z**, as mesmas três jornadas passaram, **exit0,3/3,12,9s**, incluindo as oito asserções de LF literal nos quatro campos via persistência Native e prévias autenticadas. Evidência: `native-ui-green.log`, servidor técnico em `next-current-build.log`. Save Draft/GET/prévias reais, sem mocks ou bypass de controles. Warnings NO_COLOR/FORCE_COLOR permaneceram visíveis.

O processo técnico3101 foi encerrado depois do GREEN; nenhum browser próprio ficou aberto. A prévia visual3100 e o banco visual continuaram preservados. Verificações integrais, comparação visual, CI e aceite A2 continuam com o coordenador. Nenhuma etapa3 ou produção foi iniciada.

## Complemento — ênfase do hero

A inspeção normal posterior dos oito nós do hero comprovou LF literal em `home.titleEmphasis`, nos dois idiomas e viewports: PT `Intenção em\ncada escolha.` (123:589/123:722), EN `Purpose in\nevery choice.` (125:3772/125:4033). Os quatro nós de `home.title` normal não têm LF; esse controle permaneceu `text`. Fonte privada atual: `work/figma-current-evidence/normal-editor-home-hero-text-evidence.json`, no workspace C da retomada.

O mesmo teste real foi ampliado somente para o campo comprovado, com duas asserções adicionais (NativeGET + span da ênfase na Home privada). No build W8, o RED atual `native-hero-red.log` contém exatamente essas duas falhas de conteúdo; as oito asserções anteriores passaram. Resultado de processo exit1, uma jornada falhou e duas passaram. Save Draft/GET/prévias funcionaram; não foi falha de preparação.

Depois desse RED, apenas `home.titleEmphasis` mudou para `textarea`. Total final: cinco campos existentes com controles multiline, sem acrescentar um campo. Geração oficial de tipos e `migrate:create e2_hero_emphasis_multiline --skip-empty` passaram exit0, sem migração/snapshot novo. Formato/lint passaram. Logs `hero-generate-types.log`, `hero-migration-skip-empty.log`, `hero-format.log`, `hero-lint.log`. Own Next3101PID8848 encerrado antes da reconstrução.

GREEN atual do candidato003, **BuildID bSRKmF68fRa54zSxfLfOQ**: `native-hero-green-candidate003.log`, **exit0,3/3jornadas em19,1s**, preservando as dez asserções de LF literal nos cinco campos via Native Save Draft/GET e prévias autenticadas. O Next técnico3101PID24828 foi encerrado após o GREEN; sem listener3101 ou browser de teste remanescente. A execução usa somente o banco/bucket técnicos próprios já identificados. Esse é o resultado focado atual; os gates integrais permanecem com o coordenador.
