# Plano de implementação do portfólio

> **Para o agente executor:** executar tarefa por tarefa com a skill `executing-plans`, localizada e lida no ambiente de execução. Usar caixas de seleção para acompanhar o trabalho. **Este documento não autoriza execução:** aguardar aprovação do plano e autorização para iniciar a etapa 1. Parar em cada uma das quatro aprovações. Delegação depende de autorização aplicável e não elimina essas paradas.

**Goal:** entregar o portfólio bilíngue de Product Design e UX, fiel ao Figma, com edição segura pelo Payload, qualidade verificável e publicação controlada.

**Architecture:** monólito Next.js e Payload, organizado por features. Rotas finas compõem contratos públicos das features; o Payload concentra o acesso editorial, PostgreSQL mantém os dados e R2 armazena os arquivos. Contratos de apresentação são separados dos modelos persistidos e transformados dentro da feature responsável.

**Tech Stack:** Next.js estável mais recente na execução, React, TypeScript estrito, Payload CMS, PostgreSQL, Cloudflare R2, pnpm, Tailwind CSS, CVA, shadcn/ui, Zod, Motion, Vitest, Testing Library, Playwright, GitHub Actions, Docker e Coolify.

**Spec:** [spec principal](2026-10-29-portfolio-spec-v1.md), [inventário do Figma](2026-10-29-portfolio-inventario-figma.md) e [contratos do CMS](2026-10-29-portfolio-contratos-cms.md). Ler os três antes de executar. A aprovação da spec foi dada pelo usuário nesta conversa; o plano permanece para aprovação.

29 de outubro de 2026. Estado desta entrega: planejamento; nenhuma tarefa de implementação iniciada. Caminhos de código e comandos abaixo descrevem o futuro repositório, que ainda não existe nesta pasta. Os trechos TypeScript são contratos e testes planejados, sem arquivos de aplicação criados ou execução comprovada.

## 1. Restrições globais

Todas as tarefas incluem estas restrições, mesmo quando não as repetem:

- “Home, listagem de cases, detalhe de case e Sobre.” Português e inglês desde a primeira versão. Sem blog, busca interna, formulário, cadastro público, outro tema ou construtor livre.
- “Iniciar com a versão **estável mais recente do Next.js**, conferida no momento da implementação, com correções de segurança vigentes.” Validar Payload, React e Node.js; não usar canary/beta/RC ou fazer downgrade silencioso.
- “Testes vivem junto do item testado.” `testing/` recebe somente suporte compartilhado. Usar `helpers`, nunca `lib`; usar `stylesheets`, nunca `styles`.
- “Payload é a única camada de acesso ao conteúdo.” Nenhum segundo ORM, SQL de negócio paralelo ou API editorial duplicada. Migrações e adaptadores oficiais continuam responsáveis pela persistência.
- “CMS não aceita classes CSS, cores, fontes, espaçamentos ou estilos livres.” Zod nas fronteiras; tipos gerados do Payload na persistência; variantes fechadas e tipadas com CVA.
- “Antes de criar um componente, verificar os existentes no projeto e no shadcn/ui.” O painel usa os recursos nativos do Payload. A aparência pública segue a página `03 · Layout proposto` do Figma e as alterações expressamente aprovadas.
- “TDD obrigatório para comportamentos e correções: teste falha pelo motivo esperado, implementação mínima, teste passa e refatoração mantendo a verificação.” Não escrever comportamento de produção antes do teste vermelho correspondente.
- Header: Projetos, Sobre, Currículo e Contato, nessa ordem. Contato vai a `#contact` na página atual. Currículo abre PDF publicado do idioma atual em nova aba com indicação acessível.
- Entrada em `/`: escolha manual válida → preferência compatível do navegador → inglês. URL de idioma explícito prevalece. Cookie somente `pt`/`en`, por 180 dias desde a última escolha manual, sem renovação nas visitas.
- Troca de idioma preserva trecho e posição na tela; tradução de case ausente leva à listagem de destino no topo, com toast acessível no idioma escolhido.
- “Upload de SVG é proibido permanentemente no CMS”, inclusive em versões futuras. JPEG/PNG/WebP/AVIF até 10 MB e PDF até 5 MB; processamento de imagens na aplicação, sem outro serviço.
- Rascunhos e suas mídias são privados; exemplos do Figma permanecem rascunhos até revisão do conteúdo final. Não inventar resultados, métricas, depoimentos ou experiência.
- “Manter **Google Analytics**, sem cookies de analytics.” `analytics_storage: denied` permanente; nenhuma escolha de aceitar/recusar cookies ou estatísticas. Somente produção pública e métricas aprovadas; sem publicidade, User-ID, fingerprinting ou identificadores persistentes alternativos.
- “Uma imagem Docker identificada pelo commit é construída, validada em homologação e promovida para produção **sem reconstrução**.” Configuração por ambiente e segredos em execução.
- Backups semanais e extras antes de migrações, oito semanas, banco completo e arquivos, criptografados em bucket R2 privado exclusivo fora da VPS; chave separada e restauração isolada comprovada.
- Quatro etapas com aprovação do usuário antes de avançar. Homologação não autoriza lançamento. Sem contratação, compra de domínio, migração destrutiva ou publicação de produção por iniciativa do agente.

## 2. Sequência e aprovações

| Etapa | Tarefas | Entrega revisável | Parada obrigatória |
|---|---|---|---|
| 1. Estrutura e modelos do CMS | E1.1–E1.8 | Base executável, modelos, contratos, segurança editorial e provas de concorrência/publicação | Aprovação A1 antes da etapa 2 |
| 2. Páginas conforme o Figma | E2.1–E2.6 | Páginas PT/EN, navegação, preservação de leitura, acessibilidade e comparação visual | Aprovação A2 antes da etapa 3 |
| 3. Integrações e publicação | E3.1–E3.6 | R2 real, cache/publicação, Analytics, imagem, homologação, backup e operação | Aprovação A3 antes da etapa 4 |
| 4. Validação final | E4.1–E4.3 | Jornadas, auditorias, desempenho e procedimento de lançamento | Aprovação A4 antes de lançar produção |

A aprovação deste plano permitirá solicitar/iniciar a etapa 1 conforme autorização do usuário; não equivale a A1, A2, A3 ou A4. Dentro de uma etapa, o executor pode resolver detalhes internos e produzir correções sem uma nova pergunta a cada tarefa. Uma mudança real de comportamento, visual, conteúdo, escopo, custo ou garantia exige uma proposta concreta e resposta do usuário.

Dependências principais: E1.1 → E1.2 → E1.3; E1.3 sustenta E1.4, E1.5 e E1.6; E1.6 e E1.7 fecham a publicação em E1.8. Etapa 2 consome os contratos aprovados em A1. A etapa 3 integra e endurece o sistema aprovado em A2. A etapa 4 valida a mesma imagem aprovada em A3. Integrações mínimas de armazenamento, e-mail e invalidação podem existir na etapa 1 para provar os contratos, sem antecipar a infraestrutura final nem a aprovação da etapa 3.

As provas HTTP da etapa 1 usam a API do Payload, as rotas de entrega/autorização e a resolução de conteúdo; a interface visual completa e a prévia das páginas são entregues na etapa 2. Se uma correção da etapa 4 gerar nova imagem, ela volta à homologação e repete as verificações afetadas de A3 antes de pedir A4; o digest promovido continua sendo exatamente o validado.

### Pacote obrigatório de cada aprovação

- Alterações e demonstração dos fluxos da etapa, com commit e imagem quando existir.
- Requisitos atendidos, divergências concretas e itens ainda bloqueados, sem chamar pendência de aprovação técnica.
- Comandos efetivamente executados, ambiente, saída resumida, códigos de saída e links dos relatórios; evidência RED/GREEN dos comportamentos novos.
- Comparação visual e gravações quando houver interface; dados profissionais demonstrativos identificados e privados.
- Riscos, dados externos necessários à etapa seguinte e decisão explícita: **aguardando aprovação A1/A2/A3/A4**.

## 3. Mapa dos arquivos e responsabilidades

Os arquivos abaixo são destinos planejados. Criar cada um somente quando sua tarefa o exigir. Nomes internos podem ser ajustados por razão concreta, com atualização deste mapa e dos consumidores, sem alterar os limites aprovados.

| Área | Arquivos principais planejados | Responsabilidade |
|---|---|---|
| Rotas públicas | `src/app/(portfolio)/page.tsx`, `[locale]/layout.tsx`, `[locale]/page.tsx`, `[locale]/cases/page.tsx`, `[locale]/cases/[slug]/page.tsx`, `[locale]/sobre/page.tsx`, `[locale]/about/page.tsx` | Resolver contexto, compor features e responder com semântica HTTP correta |
| Painel e API | `src/app/(payload)/admin/[[...segments]]/page.tsx`, `src/app/(payload)/api/[...slug]/route.ts`, `src/payload.config.ts` | Integração nativa do Payload, sem outro backend editorial |
| Cases | `src/features/cases/{contracts,content,server,components}/` | Identidade, traduções, reservas, publicação, consultas, apresentação e sumário |
| Perfil | `src/features/professional-profile/{contracts,content,server,components}/` | Home, Sobre, contatos, currículo e metadados do perfil |
| Navegação | `src/features/site-navigation/{contracts,content,server,components}/` | Textos globais, destinos tipados, header e footer |
| Idioma | `src/features/language-switcher/{contracts,server,components}/` | Preferência, destino equivalente e preservação de leitura |
| Mídia | `src/features/media-library/{contracts,content,server,components}/` | Validação, processamento, referências e entrega autorizada |
| Analytics | `src/features/analytics/{contracts,components}/` | Inicialização por ambiente e eventos públicos permitidos |
| Infraestrutura compartilhada | `src/helpers/{payload,storage,i18n,logger,motion}/`, `src/config/{server-env,public-runtime}.ts` | Capacidades técnicas; sem regras editoriais de features |
| UI e tokens | `src/components/ui/`, `src/stylesheets/{globals,tokens}.css` | Primitivas acessíveis e tema do Figma |
| Suporte de testes | `testing/setup/{vitest,integration,playwright}.ts`, `testing/fixtures/{cms-scenario,content,files}.ts` | Inicialização, dados sintéticos e isolamento; sem suítes centralizadas |
| Arquitetura | `src/config/architecture.test.ts`, `eslint.config.mjs`, `dependency-cruiser.config.cjs` | Regras de importação, ciclos e fronteiras servidor/navegador |
| Operação | `Dockerfile`, `compose.local.yaml`, `.github/workflows/{checks,release}.yml`, `ops/` | Ambiente local, imagem, verificações, migrações, backup e execução |
| Documentação | `docs/specs/`, `docs/architecture/`, `docs/decisions/`, `docs/verification/`, `docs/runbooks/` | Fontes aprovadas, decisões e evidências reproduzíveis |

Cada feature exporta tipos/componentes seguros em `index.ts` e operações exclusivas do servidor em `server.ts`, com proteção `server-only`. As duas rotas de Sobre validam o idioma correspondente: `/pt/about` e `/en/sobre` não se tornam cópias indexáveis. A rota raiz fica no grupo público, fora de `[locale]`.

### Contratos de integração propostos

Os schemas Zod de cada feature são a fonte dos respectivos DTOs. As declarações abaixo fixam nomes e significados para o plano; não devem virar uma segunda definição manual dos mesmos tipos.

```ts
type Locale = 'pt' | 'en'; // src/helpers/i18n/locale.ts
type EntityId = string | number; // alinhar aos tipos gerados na E1.1
type ExpectedError =
  | 'invalid-input' | 'slug-conflict' | 'locked' | 'stale-revision'
  | 'unauthorized' | 'not-found' | 'unavailable' | 'update-pending';
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ExpectedError; correlationId?: string };

type ReadingAnchor = { key: string; offsetFromViewportTop: number };
type RouteResolution =
  | { kind: 'current'; caseId: EntityId; contentId: EntityId }
  | { kind: 'redirect'; location: string }
  | { kind: 'withdrawn' }
  | { kind: 'not-found' }
  | { kind: 'unavailable'; correlationId: string };
type PublicationReceipt = {
  operationId: string;
  targetRevision: string;
  state: 'public' | 'update-pending';
};
```

`Result` fica em `src/helpers/payload/result.ts`, como contrato técnico pequeno; mensagens e regras específicas pertencem às features. IDs não são convertidos em título/slug. `targetRevision` é um token opaco persistido, comparável por igualdade; a ordenação das operações vem de sequência/versão controlada no servidor, não de comparar textos de tokens.

## 4. TDD e protocolo de verificação

Para **cada comportamento** listado em uma tarefa, executar um ciclo pequeno, sem escrever todos os testes e toda a implementação em blocos separados:

1. Nomear o erro real que o teste detecta e escrever a menor expectativa observável, com resultado independente do código testado.
2. Rodar o teste e observar falha de asserção pelo comportamento ausente. Erro de instalação, importação, banco desconectado ou digitação não é RED válido; corrigir a preparação e observar a falha comportamental.
3. Escrever somente o código necessário para esse teste passar. Usar a interface/algoritmo da tarefa, sem funcionalidades adicionais.
4. Rodar novamente, observar GREEN e refatorar com a verificação preservada. Em integração, usar Payload e PostgreSQL reais isolados para transações, índices, permissões e concorrência.
5. Executar a suíte do projeto e os checks aplicáveis; registrar evidências e criar commit coeso. Antes de declarar a tarefa/etapa pronta, aplicar `verification-before-completion` com saídas atuais. Não omitir falha preexistente.

Usar dublês somente no limite externo necessário: transporte de e-mail, R2 indisponível ou destino do Analytics. Não substituir Payload/índices por mocks para provar concorrência, nem comparar apenas chamadas de mock. Testes de UI observam função, semântica, foco e resultado; evitar snapshots extensos e testes que leem o próprio código como expectativa.

Configurações, arquivos gerados, tokens visuais e documentação são verificados pelo consumidor real — build, tipagem, análise de importações, renderização e inspeção — sem testes artificiais para cada linha estática. Isso não dispensa TDD dos comportamentos que essas configurações habilitam.

### Comandos a disponibilizar em E1.1

| Comando no futuro repositório | Efeito esperado |
|---|---|
| `pnpm test` | Executar toda a suíte Vitest, incluindo integração com serviços isolados; excluir arquivos Playwright |
| `pnpm test:unit -- <arquivo>` | Vitest de regra/componente específico, sem modo watch |
| `pnpm test:integration -- <arquivo>` | Vitest com Payload/PostgreSQL/armazenamento de teste inicializados e limpeza garantida |
| `pnpm test:e2e -- <arquivo>` | Playwright contra build de produção local ou homologação isolada, nunca recursos de produção |
| `pnpm test:architecture` | Importações entre features, ciclos e fronteiras de servidor |
| `pnpm typecheck` / `pnpm lint` / `pnpm format:check` | Tipagem, lint e formatação |
| `pnpm build` | Build da aplicação e do painel com a configuração validada |
| `pnpm verify` | Tipagem, lint, formatação, suíte Vitest, arquitetura e build; comando agregador com falha propagada |

Criar esses scripts antes de usá-los como evidência; não são comandos já disponíveis nesta pasta. A suíte E2E cresce com as jornadas; executá-la também nos gates e nas mudanças que afetem esses fluxos. Na CI, instalação usa lockfile imutável, serviços temporários e credenciais exclusivas de teste.

Suporte de integração em `testing/fixtures/cms-scenario.ts`: `createCmsScenario()` devolve `baseURL`, `request(path, init?)`, `ids` e `dispose()`. `request` usa HTTP real com a sessão editorial autenticada; chamadas públicas usam `fetch` sem essa sessão. `ids` identifica case, conteúdo PT/EN, Navegação PT/EN, Perfil PT/EN e arquivos de teste. Fixtures começam com conteúdo sintético completo identificado, sem publicação automática em produção. `dispose` limpa apenas recursos do cenário. Os testes abaixo incluem o núcleo da expectativa; imports, preparação e limpeza ficam no próprio teste ou nesse suporte documentado.

## 5. Etapa 1 Estrutura e modelos do CMS

### E1.1 Base executável e ambiente de testes

**Depende de:** aprovação do plano e autorização de início da etapa 1.

**Arquivos:** criar `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `compose.local.yaml`, `.env.example`, os arquivos nativos do grupo `(payload)`, `src/payload.config.ts`, `src/config/server-env.ts` e suporte em `testing/setup/`. Copiar os três documentos aprovados para `docs/specs/`; registrar combinação validada em `docs/decisions/001-stack-validada.md`.

**Interfaces:** `readServerEnv(input: NodeJS.ProcessEnv): ServerEnv`, schema de configuração exclusivamente no servidor; scripts da seção 4. Nenhum valor secreto no DTO público.

- [ ] Consultar documentação oficial e avisos de segurança vigentes de Next/Payload/React/Node; registrar versões exatas, compatibilidade, adaptadores e data. Interromper em conflito com a política aprovada, sem instalar versão anterior silenciosamente.
- [ ] Criar a preparação mínima e escrever em `src/config/server-env.test.ts` um teste que detecte inicialização insegura; observar RED e implementar a validação mínima.

```ts
it('recusa iniciar sem segredo do Payload', () => {
  expect(() => readServerEnv({
    NODE_ENV: 'test',
    DATABASE_URI: 'postgres://portfolio_test:local@localhost:5432/portfolio_test',
  })).toThrow(/PAYLOAD_SECRET/);
});
```

- [ ] Inicializar Payload/PostgreSQL local, gerar tipos/migração pelos mecanismos da versão validada e abrir `/admin`. Configurar Vitest/Testing Library/Playwright; separar descoberta de `.test`, `.integration.test` e `.e2e.test` sem duplicar execução. Bloquear URLs/buckets de produção no setup de teste.
- [ ] Rodar `pnpm test:unit -- src/config/server-env.test.ts`, `pnpm test` e `pnpm build`; observar GREEN e documentar comandos reais de início/limpeza local. O build não pode depender de conteúdo ou conexão com o banco de produção.
- [ ] Versionar a base e as evidências em commit `chore: preparar base e verificacao local`.

**Aceite:** painel e suíte locais executáveis, configuração inválida rejeitada, lockfile gerado, sem segredo real em `.env.example` e sem projeto/serviço de produção criado.

### E1.2 Limites arquiteturais e configuração por ambiente

**Arquivos:** criar `eslint.config.mjs`, `dependency-cruiser.config.cjs`, `src/config/architecture.test.ts`, `src/config/public-runtime.ts`, `src/config/public-runtime.test.ts`, `.github/workflows/checks.yml`, `docs/architecture/fronteiras.md`. Criar exports das features conforme os primeiros consumidores, sem pastas vazias.

**Interfaces:** `readPublicRuntime(env: ServerEnv): PublicRuntime` expõe somente `siteOrigin`, `environment` e identificação/configuração permitida do Analytics. A composição em `app` é responsável por conectar features; `helpers` não as importa. Adotar dependency-cruiser para análise do grafo e ESLint para importações restritas, após avaliação de manutenção/compatibilidade em E1.1.

- [ ] Escrever cenários de grafo em `architecture.test.ts` que importem arquivo interno de outra feature, criem ciclo e liguem componente cliente a módulo `server-only`; observar a análise falhar por essas violações. Fixtures desse teste ficam junto dele, não em código de produção.
- [ ] Implementar regras que permitam apenas `index.ts`/`server.ts` entre features, proíbam `helpers`/UI → features e ciclos; integrar ao CI. Usar o build como prova adicional da separação cliente/servidor.
- [ ] Escrever o teste de DTO público, observar RED e implementar a seleção mínima de configuração. Não serializar o objeto de ambiente inteiro.

```ts
it('não entrega o segredo do CMS ao navegador', () => {
  const config = readPublicRuntime(validServerEnv({ PAYLOAD_SECRET: 'segredo-de-teste' }));
  expect(JSON.stringify(config)).not.toContain('segredo-de-teste');
});
```

`validServerEnv(overrides)` é fixture de configuração em `testing/fixtures/content.ts`, preenchida com valores locais válidos e sem credenciais reais.

- [ ] Rodar `pnpm test:architecture`, o teste acima e `pnpm verify`. Configurar checks obrigatórios para tipagem, lint/formatação, testes, arquitetura e build. Proteção efetiva da branch depende do acesso ao repositório GitHub; registrar como bloqueada se esse acesso ainda não existir.
- [ ] Refatorar regras e documentar o grafo permitido; commit `chore: proteger fronteiras e verificacoes da base`.

**Aceite:** exemplos de importação proibida realmente falham; imports válidos passam; CI propaga falhas e nenhuma informação secreta chega à configuração pública.

### E1.3 Modelos editoriais e provisionamento idempotente

**Arquivos:** criar `features/cases/content/collections/{cases,case-content,case-routes}.ts`, `features/site-navigation/content/collections/site-navigation.ts`, `features/professional-profile/content/collections/professional-profiles.ts`, `config/provision-structural-documents.ts` e respectivos testes colocados ao lado; caminhos sob `src/`. Adicionar coleções de mídia/usuários nas tarefas E1.6/E1.7. Gerar `src/payload-types.ts` e migrações em `src/migrations/`.

**Interfaces:** `provisionStructuralDocuments(req): Promise<void>` é composição em `config`, usando o contexto transacional do Payload e as operações públicas `ensureNavigationDrafts(req)` e `ensureProfileDrafts(req)` das respectivas features. Cada uma implementa suas próprias regras/collections; `helpers` não importa essas features. `case-content` referencia `cases` pelo campo `case` e usa `locale`; modelos de Navegação/Perfil contêm os grupos descritos no complemento. Definir schemas de entradas e DTOs em `contracts/` de cada feature; o mapeamento para DTO fica em `server/map-*.ts` da mesma feature.

Campos técnicos de referência: `cases` usa `internalTitle`, `sortOrder` e `featured`; `case-content` usa `case`, `locale`, `title`, `summary`, `slug`, `cover`, `role`, `scope`, `contextNote`, `sections` e `seo`; `case-routes` usa `locale`, `slug`, `case`, `content` e `everPublished`, com estado suficiente para distinguir endereço corrente de reserva de rascunho. Campos de identidade/revisão e versões não são editáveis livremente. Grupos e conteúdo do Perfil/Navegação seguem o complemento, sem duplicar currículo/contatos na Navegação.

- [ ] Escrever teste real de provisionamento repetido e concorrente, observar RED e criar exatamente quatro documentos estruturais em rascunho. Proibir exclusão e alteração do idioma no servidor.

```ts
it('não duplica documentos estruturais em duas inicializações', async () => {
  await Promise.all([provisionStructuralDocuments(req), provisionStructuralDocuments(req)]);
  const navigation = await payload.find({
    collection: 'site-navigation', req, limit: 10, draft: true, overrideAccess: false,
  });
  expect(navigation.totalDocs).toBe(2);
  expect(navigation.docs.map(d => d.locale).sort()).toEqual(['en', 'pt']);
});
```

O teste usa Payload real e contexto de teste autenticado; testar também Perfil e ausência de versão pública. Conflitos esperados de criação são resolvidos pelo provisionador de modo idempotente, sem ignorar outros erros.

- [ ] Criar restrições físicas equivalentes a `UNIQUE(case_id, locale)`, `UNIQUE(locale)` em cada collection estrutural e `UNIQUE(locale, slug)` no registro único de rotas. Usar configuração/migrações do adaptador validado; validar os índices resultantes por inserções simultâneas via Payload, sem SQL de negócio paralelo.
- [ ] Escrever RED para duas traduções simultâneas do mesmo par case/idioma; implementar validação e tradução do conflito do banco para erro editorial específico. Não aplicar unicidade às tabelas de versões como se fossem novos documentos.
- [ ] Criar mapeadores mínimos por feature e testar que campos administrativos/rascunhos não aparecem nos DTOs; rodar `pnpm test:integration -- src/config/provision-structural-documents.integration.test.ts`, testes das collections e `pnpm verify`.
- [ ] Registrar campos, índices e migração em `docs/architecture/modelo-editorial.md`; commit `feat: modelar conteudo e provisionar documentos por idioma`.

**Aceite:** modelo compartilhado + tradução separada, quatro rascunhos protegidos e unicidade comprovada sob corrida real. A identificação interna do case não substitui seu título público traduzido.

### E1.4 Rascunho publicação restauração e edição concorrente

**Arquivos:** criar `cases/server/publish-case.ts`, `cases/server/restore-case-draft.ts`, hooks de publicação/versões em `cases/content/hooks/`; guardas equivalentes em Navegação/Perfil; infraestrutura técnica de revisão/bloqueio em `helpers/payload/editorial-revision.ts`. Testes de integração ao lado de cada responsável, incluindo `editorial-revision.integration.test.ts`.

**Interfaces:** `publishCase({ contentId, expectedRevision }, req): Promise<Result<PublicationReceipt>>`; `restoreCaseDraft({ contentId, versionId, expectedRevision }, req): Promise<Result<{ revision: string }>>`. Navegação e Perfil expõem operações equivalentes nos seus `server.ts`. Guardas também cobrem chamadas nativas diretas do Payload, não apenas os botões personalizados.

- [ ] Escrever RED para publicar PT sem publicar EN e para salvar rascunho sem mudar versão pública. Usar uma verificação HTTP pública sem sessão além da consulta autenticada do CMS.

```ts
it('bloqueia retirar navegação já publicada', async () => {
  const response = await cms.request(`/api/site-navigation/${cms.ids.navigationPt}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ _status: 'draft' }),
  });
  expect(response.ok).toBe(false);
  expect(await getPublishedNavigation('pt')).toMatchObject({
    ok: true, value: { locale: 'pt' },
  });
});
```

`getPublishedNavigation(locale): Promise<Result<NavigationDTO>>` é a consulta pública da feature de Navegação, definida nesta tarefa e consumida em E2.2; a fixture publica antes uma versão válida. Distinguir uma tentativa de retirada de publicação do fluxo normal de salvar uma nova revisão em rascunho mantendo a versão pública; provar ambos separadamente.

- [ ] Implementar drafts/versions e validação de publicação: título, resumo, capa, papel, slug, ao menos um bloco e alternativas de imagens; exigir campos globais necessários. Rejeitar publicação inválida preservando a versão pública anterior e informar campos específicos.
- [ ] Escrever RED para restauração nativa/API de uma versão antiga; adaptar a operação para produzir rascunho com identidade/relacionamentos preservados. A publicação exige outra ação explícita e nova validação.
- [ ] Escrever RED com dois editores e uma sessão antiga: segundo editor em leitura, documento distinto editável, expiração/saída liberando bloqueio e gravação antiga rejeitada mesmo após readquirir edição. Usar revisão esperada com comparação e gravação na mesma operação condicional ou transação serializada suportada pelo adaptador, além do bloqueio nativo; uma leitura isolada em `beforeChange` não prova proteção contra corrida. Proposta técnica inicial: expiração após cinco minutos sem renovação; documentar renovação/saída conforme APIs nativas validadas e demonstrar no gate A1.
- [ ] Rodar testes das operações/guardas, `pnpm test` e `pnpm verify`; documentar transições e resposta `stale-revision`/`locked`; commit `feat: proteger ciclo editorial e concorrencia`.

**Aceite:** nenhuma alteração cruzada entre grupo/idioma, nenhuma restauração pública implícita e nenhum caminho de API que permita ignorar bloqueio, revisão ou restrição estrutural.

### E1.5 Slugs reservas e resolução pública

**Arquivos:** criar `cases/contracts/slug.schema.ts`, `cases/server/{suggest-slug,reserve-case-route,resolve-case-route}.ts`, hooks da collection `case-routes` e testes unitários/integração colocados ao lado. Documentar tabela de transições em `docs/architecture/rotas-e-reservas.md`.

**Interfaces:** `suggestSlug(title: string): string`; `reserveCaseRoute({ caseId, contentId, locale, slug }, req): Promise<Result<{ slug: string }>>`; `resolveCaseRoute(locale, slug): Promise<RouteResolution>`. Separar sugestão da validação e da mudança explícita; a publicação escolhe o endereço corrente.

- [ ] Escrever RED para sugestão/validação e implementar formato com letras minúsculas sem acento, números/hífens e máximo 80 caracteres. Rascunho sem slug é permitido; publicar sem slug não. Alterar título não dispara nova reserva automaticamente.

```ts
it('sugere slug sem acentos sem decidir conflitos', () => {
  expect(suggestSlug('Aplicativo de Finanças')).toBe('aplicativo-de-financas');
});
```

- [ ] Escrever RED de duas reservas simultâneas para cases distintos no mesmo idioma; implementar registro único com restrição do banco e transação Payload. Permitir mesmo slug em outro idioma e nunca acrescentar sufixo silencioso.
- [ ] Testar e implementar cada transição: liberar slug nunca público, reservar novo em rascunho mantendo URL pública, tornar antigo histórico na publicação, retornar ao próprio histórico e restaurar conteúdo sem mudar URL pública. O registro aponta ao case proprietário e resolve o destino **atual**, evitando uma lista de redirecionamentos encadeados.
- [ ] Aplicar semântica HTTP planejada: atual publicado `200`; histórico `308` direto ao atual; inexistente ou somente rascunho `404` com resposta indistinguível; endereço que já foi público e foi retirado `410` com “Case indisponível”, links de listagem/contato e sem indexação; falha sem cache utilizável `503`, sem representar inexistência. Não revelar reservas privadas nas mensagens públicas.
- [ ] Rodar testes de sugestão, reservas/transações e resolução; verificar cabeçalhos/destinos em HTTP real, `pnpm verify`; commit `feat: garantir slugs e historico por idioma`.

**Aceite:** todos os casos da P03 testados, ausência de cadeias/ciclos, nenhuma colisão entre reserva atual/rascunho/histórico. Registrar palavras reservadas somente quando colidirem com rotas reais.

### E1.6 Upload processamento e privacidade de arquivos

**Arquivos:** criar `media-library/content/collections/media.ts`, `media-library/contracts/upload.schema.ts`, `media-library/server/{validate-upload,process-image,resolve-media-access,track-media-usage}.ts`, testes ao lado e rotas `src/app/(portfolio)/media/[id]/[variant]/route.ts` e `preview-media/[id]/[variant]/route.ts`.

**Interfaces:** `validateUpload(file: { bytes: Uint8Array; name: string; declaredType: string }): Result<ValidatedUpload>`; `processImage(upload): Promise<ProcessedImage>`; `resolveMediaAccess({ mediaId, variant, preview }, req): Promise<Result<AuthorizedMedia>>`. Tipos pertencem aos schemas da feature. O adaptador de bytes em `helpers/storage/object-storage.ts` não decide se um arquivo é publicável.

- [ ] Escrever RED com conteúdo SVG disfarçado de imagem, PDF inválido e arquivos acima dos limites; implementar identificação do conteúdo real e rejeição no servidor. Incluir limites exatos, quatro formatos de imagem e PDF válido.

```ts
it('rejeita SVG mesmo declarado como PNG', () => {
  const result = validateUpload({
    bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    name: 'retrato.png', declaredType: 'image/png',
  });
  expect(result).toMatchObject({ ok: false, error: 'invalid-input' });
});
```

- [ ] Implementar processamento na aplicação com a biblioteca de imagens compatível com o Payload validado. Gerar derivados responsivos sem ampliar o original, usando larguras de consumo previstas de 342, 640, 960, 1280 e até 2560 px quando a resolução de origem justificar telas densas. Preservar proporção/dimensões; medir consumo próximo de 10 MB, limitar concorrência de processamento inicialmente a um trabalho por processo e ajustar por evidência.
- [ ] Implementar dois caminhos de entrega: público apenas com referência aprovada; prévia autenticada com `private, no-store`. Bucket privado; nenhuma URL pública direta do R2 como autorização. Derivados seguem a mesma política. Começar sem cache compartilhado externo na entrega; cache interno de bytes nunca substitui a autorização. Se houver otimizador do Next, provar que não cria uma URL alternativa que exponha mídia privada; preferir derivados já processados quando isso eliminar esse desvio.
- [ ] Escrever RED para acesso direto sem sessão, miniatura/derivado, publicação PT sem exposição de outras mídias e compartilhamento de arquivo público com rascunho EN. Impedir exclusão de mídia usada por publicação, inclusive em corrida com publicar. Derivar/manter referências por documento/revisão com consistência transacional aplicável; versões históricas e limpeza respeitam recuperação e retenção.
- [ ] Rodar integração com armazenamento local isolado compatível e prova de acesso; registrar limitação dessa prova frente ao R2 real, a completar em E3.1. Rodar `pnpm verify`; commit `feat: validar e proteger biblioteca de midias`.

**Aceite:** uploads e derivados seguros antes de liberar edição/publicação. Restrições adicionais de dimensão que excluam arquivos até então permitidos precisam ser apresentadas no gate, não impostas silenciosamente. Nenhum serviço de imagens externo.

### E1.7 Contas prévias e recuperação nativa de senha

**Arquivos:** criar `helpers/payload/users.collection.ts`, `helpers/payload/preview-session.ts`, `helpers/payload/preview-session.integration.test.ts`, `helpers/payload/password-reset.integration.test.ts`, `app/(portfolio)/preview/route.ts`, configuração de e-mail em `payload.config.ts` e `docs/runbooks/acesso-editorial.md`.

**Interfaces:** usuário/sessão são nativos do Payload. `authorizePreview(request): Promise<Result<PreviewContext>>` valida sessão e escopo; não aceita URL externa arbitrária como destino. Preview usa consulta de rascunho separada, autenticada e sem cache público.

- [ ] Escrever RED para visitante acessando prévia/API privada e para URL de retorno externa; implementar guardas, origens confiáveis, cookies de sessão e redirecionamento interno seguro. Local API pública usa permissões explicitamente, sem depender de defaults privilegiados.
- [ ] Configurar duas contas individuais com permissões editoriais iguais, sem autoinscrição pública. Proteger criação de conta por caminho administrativo autenticado ou provisionamento de implantação controlado. Testar tentativas anônimas e acesso editorial não autorizado no servidor.
- [ ] Usar transporte de e-mail local capturado para testar o fluxo nativo: solicitar link, extrair token recebido, redefinir e entrar com senha nova. Observar RED nas proteções próprias; testar token inválido, expirado e já utilizado sem colocar tokens em logs/relatórios.

```ts
it('recusa token de recuperação inválido', async () => {
  const response = await fetch(`${cms.baseURL}/api/users/reset-password`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'token-invalido-de-teste', password: 'Senha-local-de-teste-2!' }),
  });
  expect(response.ok).toBe(false);
});
```

- [ ] Configurar proteção nativa contra tentativas repetidas, limitação dos endpoints sensíveis e respostas que não enumerem e-mails. Validar cabeçalhos com o painel real, sem aplicar uma política que quebre seus recursos. Provedor/credenciais reais de envio ficam para E3.1.
- [ ] Rodar `pnpm test:integration -- src/helpers/payload/password-reset.integration.test.ts`, testes de sessão e `pnpm verify`; commit `feat: configurar acesso e recuperacao editorial`.

**Aceite:** prévias e mídia privada protegidas; recuperação nativa comprovada localmente; sem sistema de autenticação paralelo ou e-mail real enviado a terceiros nesta tarefa.

### E1.8 Coordenação da publicação e demonstração dos contratos

**Arquivos:** criar `helpers/payload/publication-updates.collection.ts`, `helpers/payload/publication-updates.ts` e teste de integração; completar `publish-case.ts` e operações de Navegação/Perfil; `cases/server/get-published-case.ts` e testes; `docs/architecture/publicacao-e-falhas.md` e `docs/verification/A1.md`.

**Interfaces:** `enqueuePublicationUpdate({ subject, targetRevision, dependencies }, req): Promise<{ operationId: string }>`; `retryPublicationUpdate(operationId, req): Promise<Result<PublicationReceipt>>`. A collection técnica `publication-updates` acrescenta persistência de tentativas ao contrato de consistência: não é novo conteúdo editorial, fica restrita ao servidor e contém estado, assunto, revisão, dependências, tentativas e diagnóstico seguro. Publicação e registro da operação usam a mesma transação de banco quando aplicável.

- [ ] Escrever RED para conteúdo salvo seguido de falha na atualização pública; implementar estado persistido `update-pending`, retorno parcial específico e ação de tentar novamente no CMS. Não marcar sucesso público com base somente em gravação no banco.

```ts
it('não deixa uma tentativa antiga substituir publicação mais recente', async () => {
  const oldOperation = await scenario.publishWithPublicUpdateFailure('pt', 'versao-antiga');
  await scenario.publishSuccessfully('pt', 'versao-atual');
  await retryPublicationUpdate(oldOperation.operationId, req);
  expect(await getPublishedCase('pt', 'case-de-teste')).toMatchObject({
    ok: true, value: { title: 'versao-atual' },
  });
});
```

`scenario` é preparação em `testing/fixtures/cms-scenario.ts`: `publishWithPublicUpdateFailure(locale, title)` retorna o recibo da operação pendente; `publishSuccessfully(locale, title)` conclui a atualização pública. Os dois métodos usam publicação real pelo Payload e controlam apenas a falha do limite de atualização pública. `getPublishedCase(locale, slug)` retorna `Promise<Result<CaseDetailDTO>>`; a expectativa observa o resultado público, sem acessar `value` de uma variante de erro.

- [ ] Persistir contexto suficiente para reinício do processo. Tornar retries idempotentes; ao executar, comparar revisão alvo com a revisão mais recente e descartar/substituir trabalho obsoleto. Não adicionar serviço externo de filas. Casos, Navegação e Perfil continuam donos das regras de publicação.
- [ ] Mapear dependências: documento/idioma, detalhe atual/histórico, listagem, destaques, contagem, metadados, sitemap, alternates e referências de mídia. Reordenação/destaque atualiza as listagens sem publicar traduções. Manter conteúdo público previamente confirmado em falha temporária e demonstrar estado sem cache como indisponibilidade.
- [ ] Demonstrar decomposição editorial do Figma: títulos/seções e sumário derivados, três tipos de bloco e composição antes/depois predefinida. Fixar chaves de leitura e correspondências entre traduções, sem depender da posição dos arrays nem permitir campos livres de estilo.
- [ ] Rodar integração completa, `pnpm verify` e demonstração do CMS com dois editores. Entregar A1 com estados/restrições, riscos, migrações e evidências; commit `feat: coordenar publicacao e concluir contratos editoriais`.

**Parada A1:** aguardar aprovação explícita de estrutura, modelos, contratos e provas. Não iniciar componentes/páginas da etapa 2 enquanto A1 estiver pendente. A prova de cache nativa e integração externa é aprofundada na etapa 3; isso não permite adiar os testes de confidencialidade e publicação parcial exigidos aqui.

## 6. Etapa 2 Páginas conforme o Figma

### E2.1 Tokens primitivas e fundação de movimento

**Depende de:** A1 aprovada.

**Arquivos:** criar `stylesheets/{tokens,globals}.css`, primitivas necessárias em `components/ui/`, `helpers/motion/{tokens,presets,load-features}.ts`, `helpers/motion/motion-provider.tsx`, `helpers/motion/presets.test.ts`; caminhos sob `src/`. Registrar conferência de ativos/componentes em `docs/architecture/mapeamento-figma.md`.

**Interfaces:** `MotionProvider({ children })` e presets fechados para interações de botão/menu/toast. `resolveInteractionMotion({ kind, reducedMotion })` seleciona a política central de animação; seu contrato inclui `initial`/`animate` com `y` e `opacity`, consumidos pelos componentes. Variantes de UI são derivadas de CVA; primitivas recebem propriedades públicas pequenas, sem documentos do CMS.

- [ ] Ler `figma:figma-design-to-code` antes de consultar contexto/implementar a referência. Exportar e conferir originais: retrato, fotografias, capas e vetores aprovados. Registrar origem/node, proporção e uso; nenhum PDF ou conteúdo demonstrativo passa a público automaticamente.
- [ ] Mapear paleta Cherry Cola, aliases semânticos, stacks de sistema/Georgia, escala tipográfica, espaçamentos, raios e breakpoints do inventário para tokens centralizados. Conferir propriedades internas não extraídas, sem substituir os valores documentados por tema padrão do shadcn.
- [ ] Para cada primitiva necessária, registrar reutilização existente/shadcn ou composição própria. Escrever primeiro teste da política própria de movimento; comportamentos específicos de controles compostos serão testados nas jornadas que os usam. Não duplicar testes internos do shadcn nem testar apenas valores estáticos de CSS.

```tsx
it('remove deslocamento do toast quando movimento reduzido está ativo', () => {
  const animation = resolveInteractionMotion({ kind: 'toast', reducedMotion: true });
  expect(animation.initial.y).toBe(0);
  expect(animation.animate.y).toBe(0);
});
```

- [ ] Observar RED na política de movimento, implementar a seleção mínima e refatorar variantes fora do JSX. Configurar Motion com conteúdo SSR legível e movimento reduzido. Avaliar `LazyMotion`/`m` e registrar qualquer importação enxuta necessária em relação aos exemplos das skills, sem duplicar animação CSS da mesma propriedade.
- [ ] Rodar testes de componentes/presets, `pnpm verify` e inspeção do bundle inicial. Registrar contraste dos usos concretos; commit `feat: aplicar tokens e primitivas do portfolio`.

**Aceite:** aparência baseada nos tokens aprovados, foco visível, movimento reduzido e ausência de biblioteca pesada carregada em todas as páginas sem necessidade. Nenhuma animação de entrada/rolagem elaborada.

### E2.2 Header footer Home e Sobre

**Arquivos:** criar `site-navigation/contracts/navigation.schema.ts`, `site-navigation/server/{get-published-navigation,resolve-navigation}.ts`, `site-navigation/components/{site-header,site-footer,mobile-menu}.tsx`; `professional-profile/server/get-published-profile.ts`, componentes `home-content.tsx` e `about-content.tsx`, com testes ao lado; layouts/rotas públicas correspondentes sob `src/app/(portfolio)/`.

**Interfaces:** `getPublishedProfile(locale): Promise<Result<ProfessionalProfileDTO>>`; `getPublishedNavigation(locale): Promise<Result<NavigationDTO>>`; `resolveNavigation({ locale, navigation, profile }): ResolvedNavigationDTO`. A feature de Navegação recebe contatos/currículo pelo contrato público do Perfil, composto pela rota/layout; não importa seus arquivos internos. A Home recebe destaques pela interface pública de Cases.

- [ ] Escrever RED para resolução de destinos fixos e links tipados; implementar rótulos editáveis sem alterar finalidades/ordem. `contact` resolve para `#contact`, `resume` para PDF publicado do idioma atual; campos de contato validam esquema e rejeitam JavaScript/HTML.

```tsx
it('mantém contato na página atual', () => {
  render(<SiteHeader navigation={navigationPtFixture} />);
  expect(screen.getByRole('link', { name: 'Contato' })).toHaveAttribute('href', '#contact');
});
```

`navigationPtFixture` em `testing/fixtures/content.ts` é DTO público com os quatro destinos resolvidos e literais de teste, sem o mesmo resolvedor usado para calcular a expectativa.

- [ ] Escrever testes de menu mobile por teclado, Escape e retorno de foco; implementar com primitiva adequada do shadcn, sem tornar o header inteiro componente cliente. Footer contém lista real de contatos e destino acessível não encoberto pelo header.
- [ ] Compor Home: hero/retrato, destaques, Sobre/ trajetória, abordagem e footer. Compor Sobre: abertura, introdução/retrato, percurso, fotografias, pausa editorial, abordagem, Em movimento e encerramento. Usar grupos estruturados do Perfil; não criar editor de página livre.
- [ ] Provar currículo em nova aba com indicação acessível, `rel` apropriado e PDF PT/EN correto. Não alterar silenciosamente abertura dos demais links. Na Home, reutilizar os dados publicados de Cases e ocultar traduções privadas mesmo quando o case é destaque.
- [ ] Rodar testes de UI/consultas, E2E das páginas PT/EN, `pnpm verify` e comparar frames Home/Sobre desktop/mobile do inventário; commit `feat: construir apresentacao e navegacao bilingues`.

**Aceite:** quatro itens em desktop/mobile; Contato funciona em toda página atual; header sem Abordagem, seção Abordagem presente na Home; nenhum texto profissional inventado. Conteúdo final ainda não revisado continua privado, demonstrado em prévia autenticada ou ambiente de teste.

### E2.3 Listagem detalhe e apresentações editoriais

**Arquivos:** criar `cases/server/{get-published-cases,get-featured-cases,map-case-detail}.ts`, `cases/components/{case-card,case-list,case-detail,case-contents,case-blocks,case-comparison}.tsx`; contratos em `cases/contracts/case.schema.ts`; testes colocados ao lado; rotas `app/(portfolio)/[locale]/cases/{page.tsx,[slug]/page.tsx}` e suas jornadas.

**Interfaces:** `getPublishedCases(locale): Promise<Result<CaseCardDTO[]>>`; `getFeaturedCases(locale): Promise<Result<CaseCardDTO[]>>`; `getPublishedCase(locale, slug): Promise<Result<CaseDetailDTO>>`. `CaseDetailDTO` contém somente abertura, papel/escopo, mídia autorizada, seções/blocos, chaves de leitura e metadados públicos; sumário deriva das seções publicadas.

- [ ] Escrever RED para ordenação/destaque por idioma e contagem real; implementar consultas explícitas de publicação, idioma e acesso. Falha de origem não pode retornar `[]` ou ser tratada como ausência de cases.
- [ ] Escrever teste de dupla imagem em ordem editorial e links do sumário; implementar texto formatado, imagem única e dupla imagem. Sanitização/renderização só permite parágrafos, listas, links e destaques aprovados. Mobile empilha as duas imagens sem inverter leitura.

```tsx
it('deriva o sumário apenas das seções recebidas', () => {
  render(<CaseContents sections={[
    { key: 'context', heading: 'Contexto' },
    { key: 'learning', heading: 'Aprendizados' },
  ]} />);
  expect(screen.getAllByRole('link').map(link => link.getAttribute('href')))
    .toEqual(['#context', '#learning']);
});
```

- [ ] Aplicar composição antes/depois aprovada em A1 por apresentação tipada dos mesmos dados, sem novos tipos de bloco. Reservar dimensões, usar `sizes` coerente com o grid e priorizar apenas a imagem principal relevante; imagens abaixo da dobra sob demanda.
- [ ] Implementar estados de listagem vazia, indisponibilidade, `404` e `410` conforme E1.5, com mensagens PT/EN e links seguros. Páginas públicas nunca usam consulta de preview ou fallback de texto do outro idioma para disfarçar tradução incompleta.
- [ ] Rodar testes de consultas/componentes, jornadas de listagem/detalhe, `pnpm verify` e comparação dos quatro frames de Cases por página, mais o segundo exemplo EN como variação de conteúdo; commit `feat: apresentar cases e narrativa editorial`.

**Aceite:** listagem e detalhe representam apenas a tradução publicada, sumário acompanha a narrativa real e componentes não recebem documentos completos do CMS.

### E2.4 Resolução inicial e cookie funcional de idioma

**Arquivos:** criar `helpers/i18n/{locale,negotiate-locale,routes}.ts`, `language-switcher/server/{resolve-entry-locale,set-language-preference}.ts`, testes colocados ao lado e jornada `app/(portfolio)/page.e2e.test.ts`; completar a rota raiz e validação das rotas traduzidas.

**Interfaces:** `negotiateLocale(acceptLanguage: string | null): Locale`; `resolveEntryLocale({ savedLocale, acceptLanguage }): Locale`; `setLanguagePreference(locale, response)` só é invocado por escolha manual. Mapa de páginas fechado: Home, Cases e Sobre; detalhe usa a identidade permanente do case.

- [ ] Escrever testes de prioridade e negociação com pesos `q`, variantes como `pt-BR`/`en-US`, valores inválidos, idioma incompatível e ausência de cabeçalho. Observar RED e implementar sem inferir localização geográfica.

```ts
it.each([
  [{ savedLocale: 'pt', acceptLanguage: 'en-US,en;q=0.9' }, 'pt'],
  [{ savedLocale: null, acceptLanguage: 'en;q=0.5,pt-BR;q=0.9' }, 'pt'],
  [{ savedLocale: 'valor-invalido', acceptLanguage: 'fr-FR' }, 'en'],
])('resolve preferência de entrada', (input, expected) => {
  expect(resolveEntryLocale(input)).toBe(expected);
});
```

- [ ] Implementar `/` com redirecionamento temporário `307`, `Cache-Control: private, no-store`, sem cache compartilhado do destino negociado. Links com `/pt` e `/en` não passam por negociação nem são reescritos conforme cookie.
- [ ] Configurar cookie funcional `portfolio_locale`, somente `pt`/`en`, `Path=/`, `SameSite=Lax`, `Secure` em HTTPS e sem `Domain` amplo. Preferir gravação pelo servidor e `HttpOnly`; o cliente recebe o idioma pela URL, não precisa ler cookie. `Max-Age` de 15.552.000 segundos a partir da escolha manual. Não renovar em acesso/redirect/hidratação.
- [ ] Escrever E2E com relógio controlado para escolha manual, visitas subsequentes sem `Set-Cookie`, nova escolha renovando prazo e expiração/remoção retomando navegador/inglês. Testar que URL explícita prevalece e que `/pt/about`/`/en/sobre` não duplicam páginas indexáveis.
- [ ] Rodar testes unitários/E2E e `pnpm verify`; commit `feat: resolver idioma e persistir escolha manual`.

**Aceite:** todas as regras da P05 comprovadas, nenhuma identificação de visitante no cookie e nenhum comportamento novo de detecção automática nas rotas explícitas.

### E2.5 Troca de idioma preservando a leitura

**Arquivos:** criar `language-switcher/contracts/reading-anchor.schema.ts`, `language-switcher/server/resolve-translated-destination.ts`, `language-switcher/components/{language-toggle,reading-position-provider,translation-toast}.tsx`, `language-switcher/components/reading-position.e2e.test.ts`; testes de destino ao lado da operação.

**Interfaces:** `resolveTranslatedDestination({ sourcePage, targetLocale }): Promise<{ kind: 'equivalent'; href: string } | { kind: 'case-missing'; href: string }>`; `captureReadingAnchor(): ReadingAnchor | null`; `restoreReadingAnchor(anchor): Promise<void>`. `sourcePage` é união fechada de Home, Cases, Sobre e `{ kind: 'case'; caseId }`, resolvida pelo servidor. Não obter identidade traduzindo o slug.

- [ ] Escrever primeiro E2E com Home PT/EN em alturas diferentes: capturar um elemento de leitura estável e seu deslocamento na tela, trocar e exigir a mesma chave/posição. Usar tolerância técnica inicial de 2 px CSS para arredondamento no navegador fixado; isso não substitui preservar o trecho nem autoriza salto perceptível.

```ts
const source = page.locator('[data-reading-key="home-approach"]');
const before = await source.evaluate(el => el.getBoundingClientRect().top);
await page.getByRole('button', { name: 'English' }).click();
await expect(page).toHaveURL(/\/en(?:$|#)/);
await expect.poll(() => page.locator('[data-reading-key="home-approach"]')
  .evaluate(el => el.getBoundingClientRect().top))
  .toBeGreaterThanOrEqual(before - 2);
await expect.poll(() => page.locator('[data-reading-key="home-approach"]')
  .evaluate(el => el.getBoundingClientRect().top))
  .toBeLessThanOrEqual(before + 2);
```

- [ ] Implementar captura da chave do trecho visível e deslocamento em pixels **relativo a esse trecho**, navegação sem reset automático e restauração após layout/decodificação de imagens/fontes. Usar metadados temporários da navegação/histórico, sem cookie/localStorage de rastreamento e sem persistir progresso de leitura além da sessão de navegação necessária.
- [ ] Preservar chaves ao editar títulos/reordenar blocos. Home/Sobre usam chaves semânticas estáveis; cases usam as correspondências editoriais aprovadas em A1. Não calcular destino pela porcentagem da página ou índice do array. Se um trecho não tiver equivalente e o contrato não fornecer solução, apresentar essa lacuna concreta antes de alterar comportamento.
- [ ] Escrever RED de case sem tradução publicada: navegar para `/en/cases` ou `/pt/cases`, posicionar no topo e anunciar toast no idioma de destino sem repetição ao atualizar. Tratar cliques rápidos, navegação cancelada, retorno/avanço e entrada direta; a restauração não pode roubar foco nem quebrar o histórico nativo.
- [ ] Rodar jornada em Home/Sobre/lista/detalhe, celular/desktop, imagens lentas e movimento reduzido; `pnpm verify`; commit `feat: preservar contexto ao trocar idioma`.

**Aceite:** visitante mantém o trecho e sua posição mesmo com alturas diferentes; exceção de tradução ausente cumpre topo + toast, sem expor documento privado. Nenhuma animação de página adicionada para mascarar deslocamento.

### E2.6 SEO acessibilidade responsividade e aceite visual

**Arquivos:** criar `app/(portfolio)/sitemap.ts`, `app/(portfolio)/robots.ts`, `config/build-localized-metadata.ts` e teste ao lado; caminhos sob `src/`. Completar geração de metadados nas rotas, jornadas colocadas junto de cada página e `docs/verification/{A2,visual,a11y,seo}.md`.

**Interfaces:** `buildLocalizedMetadata({ locale, page, origin, publishedAlternates })` produz metadados a partir de contratos públicos; nenhum domínio final inventado. A composição em `config` recebe DTOs das features; helpers de i18n limitam-se a idioma/rotas e não consultam conteúdo editorial. Sitemap e alternates só usam páginas/traduções efetivamente públicas; canonicals apontam à própria versão de idioma.

- [ ] Escrever RED para tradução privada em sitemap/alternates e para metadados apontando tudo a PT; implementar metadados, OG, canonical e links rastreáveis no HTML do servidor. Preview/painel/homologação recebem exclusão de indexação e proteção de acesso apropriadas.

```ts
it('não anuncia uma tradução de case que não está publicada', () => {
  const metadata = buildLocalizedMetadata(publishedPtCaseWithoutEnglishFixture);
  expect(metadata.alternates.languages).not.toHaveProperty('en');
});
```

`publishedPtCaseWithoutEnglishFixture` contém origem local controlada, identidade/página e apenas alternativa PT publicada; expectativa não usa o próprio gerador de metadados.

- [ ] Executar testes acessíveis de menu, links, sumário, toast, foco, landmarks e títulos. Fazer inspeção manual por teclado/leitor de tela, contraste, zoom e movimento reduzido. WCAG 2.2 AA não é comprovada por uma nota automática isolada.
- [ ] Comparar Home/listagem/detalhe/Sobre PT/EN nos frames de 390 e 1440 px. Verificar também tablet, larguras intermediárias, textos longos e zoom sem rolagem horizontal indevida. Documentar diferenças aprovadas do header/currículo e corrigir divergências relevantes.
- [ ] Executar as jornadas públicas e de prévia sobre build de produção local, `pnpm verify`, medir um diagnóstico inicial de desempenho sem atribuir aprovação P12 e reunir capturas/relatórios.
- [ ] Entregar A2 com páginas demonstráveis e conteúdo-modelo ainda privado; commit `test: validar paginas acessibilidade e referencia visual`.

**Parada A2:** aguardar aprovação explícita das páginas, navegação, leitura preservada, acessibilidade e evidências visuais. Não iniciar a implantação/integrações finais da etapa 3 enquanto A2 estiver pendente.

## 7. Etapa 3 Integrações e preparação da publicação

### E3.1 Ambientes R2 e e-mail reais

**Depende de:** A2 aprovada. Solicitar apenas dados externos necessários neste momento, sem reabrir as decisões de produto.

**Arquivos:** completar `src/helpers/storage/{object-storage,r2-storage}.ts`, `src/features/media-library/server/r2-delivery.integration.test.ts`, configuração de e-mail no Payload, `docs/runbooks/{ambientes,armazenamento,recuperacao-de-acesso}.md` e `docs/decisions/002-infraestrutura.md`.

**Interfaces:** `ObjectStorage` oferece `put`, `get`, `head` e `delete` com chave opaca, bytes e metadados técnicos; não inclui decisão editorial. Usar adaptador R2/S3 compatível com a versão do Payload, preservando as autorizações da feature de mídia. E-mail permanece no adaptador nativo de recuperação.

- [ ] Levantar acessos existentes; apresentar VPS/plano e custos atuais antes de contratar. Dimensionar aplicação, PostgreSQL, homologação, build quando aplicável e pico de processamento medido. Registrar domínio escolhido pelo usuário, registry, origens dos ambientes, conta/propriedade GA4, envio de e-mail e credenciais mínimas. Nenhum domínio, provedor ou preço é presumido por este plano.
- [ ] Criar/configurar recursos somente após as autorizações correspondentes. Isolar PostgreSQL, buckets de mídia e credenciais de homologação/produção; bucket privado de backup separado. Credencial de uma aplicação não deve acessar o bucket do outro ambiente nem backups por conveniência.
- [ ] Escrever integração real com bucket de homologação: upload válido, publicação, entrega autorizada, derivados, remoção de referência e acesso privado. Primeiro observar falha contratual com cenário controlado; implementar o adaptador mínimo e obter GREEN. Testes não apontam para o bucket de produção.

```ts
it('não entrega uma mídia de rascunho por URL direta', async () => {
  const response = await fetch(`${cms.baseURL}/media/${cms.ids.privateImage}/640`);
  expect(response.status).toBe(404);
  expect(response.headers.get('content-type')).not.toMatch(/^image\//);
});
```

- [ ] Comprovar que URL direta do objeto/derivado no R2 não é pública; revisar caminhos do otimizador e caches. Testar falha de rede no envio e impedir referência editorial apontando a upload incompleto. Artefatos de imagem recebem chaves imutáveis; alteração de arquivo gera novo recurso/revisão, facilitando recuperação consistente.
- [ ] Validar configuração real de e-mail com conta editorial autorizada e autorização específica para envio de teste; usar captura local até essa autorização. Não enviar mensagens a outras pessoas. Rodar integração, `pnpm verify` e registrar evidências sem segredos; commit `feat: integrar armazenamento e envio editorial`.

**Aceite:** provas reais de R2 com isolamento e privacidade; configuração de envio pronta e resultado de entrega identificado. Falta de credencial ou contratação não é marcada como integração aprovada.

### E3.2 Cache invalidação e recuperação de atualização pública

**Arquivos:** criar `src/helpers/payload/public-cache.ts`, `src/helpers/payload/public-cache.integration.test.ts`, completar `publication-updates.ts`, operações das features e `docs/runbooks/publicacao-e-cache.md`. Se o teste da combinação validada exigir handler específico, localizá-lo em `helpers/payload/cache-handler.ts`, sem novo serviço externo.

**Interfaces:** `readPublicSnapshot({ key, locale, origin, loader }): Promise<Result<PublicSnapshot>>`; `refreshPublicDependencies(operationId): Promise<Result<PublicationReceipt>>`. `loader` é fornecido pela feature e consulta exclusivamente o Payload. A infraestrutura de cache não importa Cases/Perfil/Navegação; recebe chaves e callbacks na composição.

- [ ] Escrever testes contra `next build` + servidor de produção: aquecer Home/lista/detalhe; interromper PostgreSQL/CMS; exigir conteúdo público confirmado em cache; testar rota não aquecida como `503`. Garantir que erro do loader não seja armazenado como documento ausente ou lista vazia.

```ts
it('preserva a página confirmada quando a origem fica indisponível', async () => {
  const before = await fetch(`${cms.baseURL}/pt/cases/case-de-teste`);
  expect(before.status).toBe(200);
  await scenario.stopDatabase();
  const during = await fetch(`${cms.baseURL}/pt/cases/case-de-teste`);
  expect(during.status).toBe(200);
  expect(await during.text()).toContain('Título público de teste');
});
```

`stopDatabase()` controla apenas o contêiner PostgreSQL dedicado ao cenário e possui limpeza/reinício garantidos. Nunca simular essa falha no ambiente de produção.

- [ ] Implementar cache compatível com a versão do Next validada, chaveado por ambiente/origem, idioma e dependência. Preservar último resultado público válido em falhas e usar armazenamento persistente montado na VPS quando necessário à estratégia escolhida. Não presumir que invalidar uma tag prova regeneração; uma verificação pública confirma a revisão servida. Registrar a API exata e o comportamento observado.
- [ ] Conectar operações persistidas de E1.8: atualização de conteúdo, rotas históricas, destaques, ordem, contagem, sitemap/alternates e mídias. Executar tentativas por processo da mesma stack ou job nativo validado, com processamento idempotente e exclusão de operações obsoletas. Proposta operacional a avaliar em A3: propagação normal em até 60 segundos; tentativas automáticas em 1, 5 e 15 segundos, depois estado pendente visível e repetição manual. Isso é uma proposta operacional, não uma meta já aprovada na entrevista.
- [ ] Testar falha entre gravação e invalidação, reinício durante tentativa e nova publicação antes de retry antigo. Retirada de publicação/revogação não aparece como concluída enquanto a verificação ainda encontrar o recurso público. Rascunho nunca publicado continua privado em qualquer falha; manter cache confirmado não autoriza consultar a versão de rascunho.
- [ ] Validar cache de bytes e autorização das mídias separadamente: arquivo compartilhado com outra publicação continua permitido; removida a última referência pública, invalidar autorização/entrega controlada e não usar cópia de cache como permissão. Não prometer apagar cópias já baixadas. Rodar integração e `pnpm verify`; commit `feat: garantir atualizacao publica e tolerancia a falhas`.

**Aceite:** cache, propagação e estado parcial comprovados no servidor real, inclusive com imagens, sem alegar disponibilidade durante queda da VPS única. Aprovar em A3 o prazo operacional efetivamente sustentado pelos testes.

### E3.3 Google Analytics automático sem cookies

**Arquivos:** criar `src/features/analytics/contracts/event.schema.ts`, `src/features/analytics/components/{analytics-provider,tracked-link}.tsx`, `src/features/analytics/analytics-policy.test.ts`, `src/features/analytics/analytics-events.e2e.test.ts`, `docs/verification/analytics.md`.

**Interfaces:** `track(event: PortfolioAnalyticsEvent): void`; união fechada de `page_view`, `contact_email_click`, `contact_linkedin_click` e `resume_open`, com `locale` e contexto de página pública sanitizado. `canMeasure({ environment, area, preview }): boolean` é política pura da feature; o provedor só inicializa no site público de produção.

- [ ] Escrever RED para ambientes/áreas excluídos, campos não permitidos e duplicação de page view. Implementar schema fechado, inicialização única e envio por navegação pública concluída; não contabilizar navegação cancelada nem enviar endereço de e-mail/LinkedIn como rótulo/URL do evento.

```ts
it.each([
  [{ environment: 'staging', area: 'public', preview: false }, false],
  [{ environment: 'production', area: 'admin', preview: false }, false],
  [{ environment: 'production', area: 'public', preview: true }, false],
  [{ environment: 'production', area: 'public', preview: false }, true],
])('limita a medição ao contexto autorizado', (context, expected) => {
  expect(canMeasure(context)).toBe(expected);
});
```

- [ ] Configurar GA4 com `analytics_storage: denied` antes de qualquer medição e sem mudança posterior para habilitar armazenamento. Desativar publicidade/remarketing, User-ID e medição automática ampliada de rolagem, busca, cliques externos e downloads que extrapole os eventos aprovados. Não instalar gerenciador de tags ou outro produto de analytics sem necessidade aprovada.
- [ ] Testar contrato do transporte em ambiente isolado, sem enviar dados reais ao Google: somente eventos aprovados, locale, caminho público sanitizado e dados técnicos indispensáveis do protocolo; sem nomes, e-mails, tokens, conteúdo privado ou identificadores persistentes alternativos. Evento `resume_open` confirma o acionamento, não o download/leitura. Inspecionar cookies e storage; o cookie funcional de idioma não pode ser lido para identificar visitantes.
- [ ] Documentar quais relatórios GA4 são efetivamente disponíveis sob essa política. Enviar ping não comprova disponibilidade de relatório. A demonstração não pode ativar Analytics em homologação/testes nem presumir os requisitos de modelagem atendidos. Se a prova exigir tráfego público de produção, identificar antes da ativação a evidência que falta e o conflito de sequência no pacote A3/A4; não declarar medição validada por um teste de transporte e não flexibilizar a política para contornar o limite.
- [ ] Provar que não existe banner/modal/escolha de aceite ou recusa. Rodar testes, `pnpm verify` e comparar custo de JavaScript; commit `feat: integrar medicao publica sem cookies`.

**Aceite:** política técnica preservada, eventos sem duplicação/PII, relatórios comprovados ou limitação impeditiva explicitamente apresentada antes da ativação. Não reabrir a decisão de interface ou sugerir cookies/identificadores como solução silenciosa.

### E3.4 Imagem única configuração de execução e homologação

**Arquivos:** criar `Dockerfile`, `.dockerignore`, `.github/workflows/release.yml`, `ops/verify-image.ts`, `ops/verify-image.test.ts`, completar `src/config/{server-env,public-runtime}.ts`, `docs/runbooks/{build-e-promocao,homologacao}.md`.

**Interfaces:** `verifyImagePromotion({ stagingDigest, productionCandidateDigest }): Result<void>` compara digests imutáveis. Configuração pública é lida no servidor em execução e passada como DTO mínimo aos componentes; nenhuma origem ou identificação GA específica do ambiente é incorporada no build para exigir reconstrução.

- [ ] Escrever RED para promoção de digests diferentes e para configuração pública vazando segredo/origem de homologação. Implementar validação mínima e teste com a mesma imagem iniciada em duas configurações locais isoladas. Inspecionar HTML/manifestos/bundles sem disparar Analytics real.

```ts
it('recusa promover uma imagem diferente da validada', () => {
  expect(verifyImagePromotion({
    stagingDigest: 'sha256:aaa', productionCandidateDigest: 'sha256:bbb',
  })).toMatchObject({ ok: false, error: 'invalid-input' });
});
```

- [ ] Criar Docker multistage com dependências/lockfile fixados, usuário sem privilégios e artefatos estritamente necessários. Segredos somente na execução; build sem consultar conteúdo de produção. Não usar `NEXT_PUBLIC_*` para valores que variam entre homologação/produção; não pré-renderizar metadados absolutos com origem do ambiente de build.
- [ ] Entregar runtime config pelo servidor, escapando serialização e incluindo somente campos autorizados. Isolar cache por ambiente/origem e persistir o que a estratégia de E3.2 exigir. Verificar funcionamento do painel, API, arquivos estáticos, imagens e geração de URLs após trocar o ambiente sem reconstruir.
- [ ] Construir a imagem identificada pelo commit, publicar no registry autorizado e implantar somente em homologação autenticada, sem indexação e sem Analytics. Registrar digest, configuração sem segredos e evidência de que a candidata a produção tem exatamente o mesmo digest. A promoção real fica para depois de A4.
- [ ] Rodar `pnpm verify`, E2E contra a imagem e inspeção de usuário/processo/camadas; commit `build: preparar imagem unica e homologacao isolada`.

**Aceite:** mesma imagem funciona com configuração própria de cada ambiente; nenhum segredo em camadas/client bundle; homologação protegida e produção ainda não lançada.

### E3.5 Migrações logs e verificações de saúde

**Arquivos:** criar `src/helpers/logger/{logger,redact}.ts` e testes, `src/app/(portfolio)/health/route.ts` e teste ao lado, diagnóstico autenticado dentro da integração Payload; `ops/migrate.ts`, `docs/runbooks/{migracoes,saude-e-logs,rollback}.md`.

**Interfaces:** `logger.info/error({ operation, result, correlationId, ...safeContext })`; `redact(value): unknown`. Health público devolve somente prontidão mínima; diagnóstico de PostgreSQL/R2 requer autorização e não compõe a condição automática para derrubar páginas ainda servíveis em cache.

- [ ] Escrever RED de segredo/token em log e de diagnóstico público detalhado; implementar campos permitidos, data/nível/operação/resultado/correlação e redigir dados sensíveis antes de escrever em stdout.

```ts
it('remove tokens do contexto de erro', () => {
  const output = JSON.stringify(redact({ operation: 'reset-password', token: 'token-secreto' }));
  expect(output).not.toContain('token-secreto');
});
```

- [ ] Implementar endpoint leve sem consulta pesada a dependências. Verificar no Coolify o probe disponível na imagem; proposta inicial: intervalo 30 s, timeout 5 s, três falhas consecutivas, com período de início medido. Usar um probe com Node ou disponibilizar o binário necessário, sem assumir ferramenta ausente na imagem mínima.
- [ ] Configurar logs de execução consultáveis no Coolify e separados dos de implantação; proposta inicial de rotação: 10 MB por arquivo, três arquivos por contêiner, ajustada ao disco contratado e documentada em A3. Diagnósticos não expõem credenciais, configuração ou texto de rascunho. Sem monitoramento/notificações externos.
- [ ] Executar migração em etapa controlada separada da inicialização, com backup prévio. Testar migração da versão anterior e rollback de imagem com schema compatível; impedir execução concorrente. Migração destrutiva só com aprovação explícita e recuperação preparada. Não executar reversão automática de dados para acompanhar rollback de imagem.
- [ ] Demonstrar falhas de PostgreSQL/R2 sem retirar por engano a aplicação que ainda serve cache; rodar testes, E2E operacional e `pnpm verify`; commit `chore: preparar migracoes diagnosticos e operacao`.

**Aceite:** prontidão/diagnósticos distintos, rotação aplicada, logs seguros e procedimento de migração/rollback reproduzível em homologação.

### E3.6 Backup criptografado e restauração isolada

**Arquivos:** criar `ops/backup/{run,restore,retention}.ts` com testes ao lado, `ops/backup/Dockerfile`, `docs/runbooks/backup-e-restauracao.md` e `docs/verification/A3.md`.

**Interfaces:** `runBackup({ environment, destination, recipient }): Promise<BackupManifest>`; `restoreBackup({ backupId, isolatedTarget, identity }): Promise<RestoreReport>`; `selectExpiredBackups(manifests, now)` seleciona apenas conjuntos fora das oito semanas. Scripts recusam alvo de restauração de produção por padrão; restauração real de produção exigiria autorização explícita própria.

- [ ] Usar `pg_dump` em formato apropriado à restauração integral, cópia dos objetos necessários e manifesto de integridade/referências; criptografia com `age`, versão validada no job operacional. Chave pública de criptografia pode estar no job; identidade privada de recuperação fica separada da VPS e do bucket. Não criar criptografia própria.
- [ ] Escrever RED para retenção apagando conjunto recente e para destino de restauração não isolado; implementar seleção por data controlada e recusa segura. Um backup só aparece como concluído depois de upload/manifesto verificados; falha parcial não apaga o último conjunto válido.

```ts
it('preserva um backup dentro das oito semanas', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  const manifests = [{ id: 'recente', completedAt: '2026-11-01T00:00:00Z', complete: true }];
  expect(selectExpiredBackups(manifests, now)).toEqual([]);
});
```

- [ ] Agendar execução semanal no ambiente operacional e chamada extra antes de migração/atualização. Guardar no bucket privado exclusivo de backup com credenciais próprias. Cobrir banco completo, traduções, imagens/PDFs e seus relacionamentos; registrar versão da aplicação/schema e checksums sem conteúdo sensível em logs.
- [ ] Coordenar snapshot de banco e arquivos: objetos imutáveis referenciados pelo dump são copiados/validados; suspender limpeza de órfãos durante o conjunto e não permitir exclusão física que quebre a cópia. Só aplicar retenção a conjuntos completos fora da janela; apagar arquivo corrente não apaga imediatamente seu histórico de backup.
- [ ] Restaurar um conjunto de verdade em banco/bucket isolados, descriptografar com a identidade separada e verificar conteúdos PT/EN, versões/rotas, arquivos e login/recuperação necessários. Registrar duração e resultado como observações, sem inventar RPO/RTO contratados. Entregar A3 e commit `ops: comprovar backup e recuperacao isolada`.

**Parada A3:** aguardar aprovação explícita das integrações, homologação, operação, política técnica do Analytics e propostas operacionais medidas. Falhas ou dados externos ausentes ficam identificados, sem passar para validação final como se estivessem resolvidos. Nenhum lançamento em produção nesta etapa.

## 8. Etapa 4 Validação final

### E4.1 Jornadas integradas segurança e conteúdo final

**Depende de:** A3 aprovada.

**Arquivos:** completar os `.e2e.test.ts` junto das páginas/features responsáveis e testes de integração existentes; criar `docs/verification/{jornadas,seguranca,conteudo-final}.md`. Correções alteram somente seus módulos donos e respectivos testes.

**Interfaces:** jornadas consomem UI/HTTP reais da imagem candidata e os contratos já aprovados. Nenhum novo endpoint, tipo de bloco ou campo de estilo é introduzido para facilitar teste.

- [ ] Executar matriz integrada da seção 9: edição, publicação, retirada, restauração, concorrência, slugs/histórico, mídias, troca de idioma, raiz, currículo/contatos, falhas, operação e recuperação. Usar duas sessões editoriais e visitante sem sessão; testes nunca usam recursos de produção.
- [ ] Para cada falha encontrada, escrever primeiro um teste que reproduza o comportamento e observe RED, corrigir o mínimo, observar GREEN e refatorar. Não ajustar uma expectativa para aprovar uma regressão contra a spec.

```ts
test('abre o currículo inglês preservando a aba do portfólio', async ({ page }) => {
  await page.goto('/en');
  const [pdfTab] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: /Resume/ }).click(),
  ]);
  await expect(page).toHaveURL(/\/en$/);
  await expect(pdfTab).toHaveURL(/\/media\//);
});
```

Completar a asserção com a referência exata do PDF EN da fixture, resposta PDF autorizada e indicação acessível da nova aba. Não exigir evento de “download concluído”.

- [ ] Revisar conteúdo final com os responsáveis: apresentação, contatos, currículos PT/EN, textos/alternativas de imagens, cases reais/conceituais identificados e metadados. Modelos não revisados continuam rascunhos; nenhum seed de exemplo é publicado para preencher o lançamento. O lançamento exige os documentos globais válidos nos dois idiomas e destinos reais.
- [ ] Auditar acesso direto ao Payload, prévias, mídia/derivados, bloqueio/revisão, recuperação, uploads, rate limits, esquema de links e segredos. Reconsultar avisos atuais das dependências e aplicar correções necessárias com TDD/validação de compatibilidade.
- [ ] Rodar `pnpm verify`, `pnpm test:e2e` e revisão de diff contra a spec. Se houver correção, gerar nova imagem candidata e validá-la em homologação; depois promover esse mesmo digest. Não reconstruir a imagem já validada durante promoção.

**Aceite:** jornadas e conteúdo final revisados com evidências, nenhuma exposição de rascunhos e nenhum risco obrigatório omitido. Aprovação editorial de conteúdo é revisão de material real, sem reabrir os modelos e políticas da entrevista.

### E4.2 Auditorias visuais acessibilidade SEO e performance

**Arquivos:** `docs/verification/{visual,a11y,seo,performance,web-quality}.md`, relatórios brutos em `docs/verification/artifacts/` quando adequados ao repositório, e scripts de medição em `ops/performance/` com testes ao lado se contiverem transformação/decisão própria.

**Interfaces:** o protocolo de medição recebe URLs, perfil de dispositivo e configuração registrada; produz resultados por cenário com mediana e variação, sem alterar as condições para aprovar o resultado.

- [ ] Ler `web-quality-audit`, `seo`, `performance` e `accessibility` nos respectivos gatilhos. Reexecutar comparação visual dos frames aprovados e estados relevantes; testar teclado/leitor de tela, foco, contraste, zoom, movimento reduzido e tablet. Conferir HTML SSR, canonical, alternates, sitemap, robots e `404`/`410`/`503`.
- [ ] Documentar o protocolo antes de medir: commit/digest, dados, URL, ferramenta/versão, máquina, viewport/DPR, CPU, rede, cache, autenticação de homologação e limites entre ambientes. Protocolo inicial proposto abaixo; fixar a tradução desses valores para a versão validada do Lighthouse/Chrome em `ops/performance/profiles.json`, sem confundir emulação com um aparelho físico real. Manter configuração e resultados juntos.

| Condição de laboratório proposta | Celular | Desktop |
|---|---|---|
| Viewport CSS | 390 × 844 | 1440 × 900 |
| DPR | 3 | 1 |
| CPU simulada | Desaceleração 4× | Sem desaceleração adicional, 1× |
| Rede simulada | RTT 150 ms; download 1.600 Kbit/s; upload 750 Kbit/s | RTT 40 ms; download 10.000 Kbit/s; upload 5.000 Kbit/s |
| Cache do navegador no cenário principal | Frio em cada execução | Frio em cada execução |

O estado do cache do servidor também é registrado e mantido equivalente nas repetições. Se o ambiente não suportar esse protocolo, explicar e fixar uma alternativa reproduzível antes da primeira rodada; não mudar o perfil após ver os resultados para obter aprovação.

- [ ] Medir **12 cenários**: Home, listagem e case representativo mais pesado × PT/EN × celular/desktop. Fazer no mínimo três execuções equivalentes por cenário, total mínimo de **36 medições**, com mediana e variação. Registrar cache frio para o cenário principal e diagnóstico de cache aquecido separado; não misturar condições na mesma mediana.
- [ ] Comparar medianas às metas aprovadas: LCP ≤ 2,5 s e CLS ≤ 0,1 em ambos; TBT ≤ 200 ms no celular e ≤ 150 ms no desktop. Diagnosticar JavaScript, imagens, Motion e Analytics; corrigir gargalos concretos e repetir os cenários afetados, além da suíte necessária. Não exigir nota 100 ou cobertura de 100%.
- [ ] Exercitar menu, idioma, toast, sumário e contatos para observar resposta em laboratório. Registrar INP de referência ≤ 200 ms **em campo**, p75 e celular/desktop separados quando houver amostra suficiente; ausência de campo no lançamento é evidência indisponível. TBT ou interação isolada não aprova INP. Não adicionar coleta RUM nem ativar Analytics em homologação para medir.
- [ ] Identificar diferenças de origem/cache/Analytics entre homologação e produção e seu impacto na prova. Sem tráfego real autorizado, relatório de homologação não é chamado de relatório de campo/produção. Se uma condição obrigatória não puder ser demonstrada antes do lançamento, apresentar essa limitação concreta em A4; não conceder aprovação por aproximação silenciosa.

**Aceite:** metas de laboratório documentadas por cenário, auditorias integradas com achados corrigidos ou decisões explícitas, prova visual anexada e limites das medições claramente identificados.

### E4.3 Dossiê final e autorização de lançamento

**Arquivos:** criar `docs/verification/A4.md`, `docs/runbooks/lancamento.md` e completar matriz de requisitos/relatórios. Nenhuma implantação pública faz parte da criação deste dossiê.

**Interfaces:** o procedimento recebe commit/digest homologado, domínio real, configuração de produção aprovada, backup verificável e autorização A4. Essas entradas são pré-condições, não valores fictícios a preencher automaticamente.

- [ ] Conferir todos os requisitos da seção 9 contra código, testes e evidências. Anotar qualquer bloqueio por nome e impacto, especialmente conteúdo final, infraestrutura, e-mail, relatórios GA4 e metas de performance. Não declarar “pronto” com esses requisitos obrigatórios não comprovados.
- [ ] Verificar branch protegida/checks obrigatórios, imagem/digest, segredos externos, isolamento, migrações, backup/restauração, logs/saúde e documentação de uso do CMS. Preparar operação de implantação com responsáveis, ordem, verificações e recuperação.
- [ ] Documentar sequência **posterior à aprovação A4**: confirmar autorização de lançamento → backup prévio → migração controlada necessária → promover digest já homologado → validar saúde/TLS/origem/URLs/conteúdo → verificar configuração pública sem enviar medições enquanto o acesso estiver privado → liberar acesso público e medição automática conforme a autorização. Sem rebuild ou migração destrutiva implícita; Analytics só inicializa quando a produção estiver efetivamente pública.
- [ ] Separar verificações manuais pontuais de produção de testes automatizados: visitantes/testes sintéticos não devem enviar eventos ao Google. A demonstração dos relatórios reais respeita o bloqueio identificado em E3.3; se não for tecnicamente possível antes da ativação, apresentar ao usuário a condição exata que requer decisão, mantendo a política sem cookies e sem banner.
- [ ] Registrar evidências frescas de `pnpm verify`, E2E, auditorias e digest. Entregar pacote final com procedimento de rollback da imagem e recuperação de dados; encerrar como **aguardando aprovação A4 e autorização explícita para lançar**.

**Parada A4:** produção permanece sem lançamento até a resposta explícita do usuário. A aprovação de A1/A2/A3, a aprovação da spec ou a aprovação deste plano não substituem A4. Após o lançamento autorizado, verificar os dados de campo quando existirem, sem criar automação recorrente ou monitoramento externo por conta própria.

## 9. Rastreabilidade e matriz de aceite

| Fonte/requisito | Implementação | Evidência principal |
|---|---|---|
| Objetivo, escopo e conteúdo profissional — spec 1–2 | E1.3, E2.2–E2.3, E4.1 | Páginas e conteúdo revisado; exemplos continuam privados |
| P01 Figma, tokens, ativos e componentes | E1.8, E2.1–E2.3, E2.6, E4.2 | Mapeamento, arquivos de origem, capturas PT/EN e diferenças aprovadas |
| P02 modelos/idiomas e unicidade editorial | E1.3–E1.4 | PostgreSQL/Payload reais sob concorrência; independência PT/EN |
| P02 documentos estruturais e continuidade pública | E1.3–E1.4 | Quatro rascunhos, exclusão/idioma bloqueados, edição não retira publicação |
| P02 restauração e edição concorrente | E1.4 | Restauração gera rascunho; bloqueio, expiração e stale write rejeitado |
| P02 links tipados e contratos mínimos | E1.3, E2.2, E2.3 | Schemas/mapeadores, URLs seguras e DTOs sem campos privados |
| P03 slugs e ciclo de reservas | E1.5, E1.8, E4.1 | Corridas, histórico direto, volta ao próprio slug e restauração sem publicar |
| P04 leitura/histórico e tradução ausente | E1.8, E2.5 | Mesma chave/posição com alturas diferentes; fallback topo + toast |
| P05 entrada e cookie 180 dias | E2.4 | Cookie → navegador → EN; URL explícita; visita sem renovação |
| P06 Analytics automático sem cookies | E3.3, E4.2–E4.3 | Política/transportes/storage, exclusões e relatórios efetivamente demonstrados |
| P07 cache/falha parcial/retry | E1.8, E3.2 | Interrupção real, reinício, tentativa antiga e revisão pública confirmada |
| P08 mídia privada, compartilhamento e exclusão | E1.6, E3.1–E3.2 | URLs diretas/derivados negados; acesso público controlado; exclusão concorrente |
| P09 formatos/limites/SVG/processamento | E1.6, E3.1 | Conteúdo real, limites e pico de memória, quatro formatos aceitos |
| P10 acesso e recuperação de senha | E1.7, E3.1, E4.1 | Sessões/permissões, link válido, token inválido/expirado/reutilizado |
| P11 versões e segurança de dependências | E1.1, E4.1 | Combinação estável validada e avisos atuais antes de implantação |
| Arquitetura, TDD e ferramentas — spec 6, 11, 13 | E1.1–E1.2 e todas as tarefas comportamentais | RED/GREEN, testes colocados ao lado, fronteiras/ciclos e CI |
| Estilos e Motion — spec 7 | E2.1, E2.2, E2.5, E4.2 | CVA/tokens, reduced motion, SSR e custo de bundle medido |
| SEO e rastreabilidade — spec 10.1 | E2.6, E4.2 | HTML, canonicals próprios, alternates/sitemap só publicados |
| P12 performance | E4.2 | 12 cenários/≥36 medições, medianas/variação e INP de campo separado |
| P13 imagem promovida sem rebuild | E3.4, E4.3 | Digest idêntico e configuração por ambiente em execução |
| P14 dados/custos de implantação | E3.1, E3.4, E4.3 | Recursos/origens reais aprovados antes de contratar/publicar |
| P15 backup oito semanas/restauração | E3.6 | Backup criptografado completo, retenção e restauração isolada real |
| P16 logs e saúde | E3.5 | Logs seguros/rotação e health sem derrubar cache por falha de dependência |
| P17 HTTP e indisponibilidade | E1.5, E2.3, E3.2, E4.2 | 200/307/308/404/410/503 e mensagens sem revelar rascunhos |
| Contato/header/currículo — spec 3.5–3.7 | E2.2, E4.1 | Ordem fixa; âncora atual; PDF correto em nova aba e evento de acionamento |
| Aprovações e autonomia — spec 14 | A1, A2, A3, A4 | Pacote revisável e autorização registrada antes de avançar |

Essa matriz também cobre o complemento de contratos: `cases`, `case-content`, `case-routes` em E1.3–E1.5; Navegação/Perfil em E1.3–E1.4/E2.2; mídia em E1.6/E3.1; usuários em E1.7; fronteiras/erros em E1.2/E1.8. A única collection de suporte adicional proposta é `publication-updates`, justificada pela persistência de falhas/retries exigida pelo contrato, sem novo domínio editorial.

## 10. Skills e referências para execução

| Momento | Skill obrigatória quando aplicável |
|---|---|
| Executar tarefas do plano | `executing-plans`, respeitando as quatro paradas deste plano |
| Cada comportamento/correção | `test-driven-development`; ler também sua referência de bons testes |
| Concluir tarefa/etapa | `verification-before-completion` |
| React/Next e separação servidor/cliente | `vercel-react-best-practices` |
| Consultar contexto/implementar Figma | `figma:figma-design-to-code` |
| Tokens/presets e interações de movimento | `motion-foundations`, `motion-patterns` |
| Acessibilidade e SEO | `accessibility`, `seo` |
| Gargalos e auditoria integrada | `performance`, `web-quality-audit` |
| Falha inesperada | `systematic-debugging` antes de propor correção |

Localizar as skills no ambiente executor; referências de caminhos estão na spec. A skill de planejamento usada nesta entrega foi localizada em `C:/Users/joeld/.codex/.tmp/plugins/plugins/superpowers/skills/writing-plans/SKILL.md`. Caminho temporário não é dependência permanente do projeto. Nenhuma recomendação de skill autoriza iniciar código, delegar ou ultrapassar gate sem a autorização aplicável.

Fundamentos técnicos consultados para o desenho do plano, a revalidar com as versões escolhidas:

- Índices compostos/unicidade pela configuração das collections: [Payload — Indexes](https://payloadcms.com/docs/database/indexes).
- Contexto transacional compartilhado entre operações Payload: [Payload — Transactions](https://payloadcms.com/docs/database/transactions). Trabalho externo de mídia/cache continua fora dessa transação.
- Distinção entre versão, rascunho e publicação: [Payload — Drafts](https://payloadcms.com/docs/versions/drafts). A restauração para rascunho e proteção contra stale write continuam sendo contratos próprios a comprovar.
- Variáveis de execução e cache em implantação própria: [Next.js — Self-hosting](https://nextjs.org/docs/app/guides/self-hosting). Configuração específica do ambiente deve ser lida em execução para preservar a imagem única.
- Regras de grafo e ciclos: [dependency-cruiser — Rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md).
- Ferramenta proposta de criptografia dos backups: [age — documentação do projeto](https://github.com/FiloSottile/age).
- Analytics e limites de relatórios: [Google — Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode) e [modelagem comportamental](https://support.google.com/analytics/answer/11161109?hl=en), já relacionados na spec.

## 11. Estado para iniciar

- [x] Spec principal e dois complementos aprovados pelo usuário.
- [x] Plano escrito com 23 tarefas, TDD e quatro etapas de aprovação.
- [ ] Plano aprovado pelo usuário.
- [ ] Etapa 1 autorizada a iniciar.
- [ ] A1 aprovada.
- [ ] A2 aprovada.
- [ ] A3 aprovada.
- [ ] A4 aprovada e lançamento autorizado.

**Próxima ação permitida nesta entrega:** revisão do plano. Nenhuma instalação, scaffold, implementação, contratação ou implantação foi iniciada para produzi-lo.
