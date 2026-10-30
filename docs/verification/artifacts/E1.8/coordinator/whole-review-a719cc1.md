# Revisão independente final de conjunto — etapa 1, E1.1–E1.8

**Ready for technical A1: With fixes.** Dois achados Important e um Minor exigem retorno ao implementador. A CI exata aprovada não cobre os ramos identificados. Esta revisão não concede A1, não promove o SHA e não autoriza etapa 2. Etapa 1 permanece **87,5%** até o coordenador concluir os gates.

## Escopo e proveniência

- Target imutável: **a719cc1a4fda619aadad45576af034cdcaa7f208**.
- Base: árvore vazia **4b825dc642cb6eb9a060e54bf8d69288fbee4904**; o escopo é a etapa inteira, incluindo módulos herdados das tarefas anteriores.
- Pacote recebido: stage1-whole-branch-review-a719cc1.diff, **1.525.548 bytes**, SHA256 **e93e64ee0c762de6d83763a7e8860bb51ebe338e0e66984ab39e6bdb276a15fc**, conferido. Manifesto adjacente: 958 arquivos/hashes; o diff textual contém 323 seções. Não rederivei o diff.
- Fontes obrigatórias lidas integralmente: spec-v1 (prevalente), contratos-cms, inventario-figma e plano-implementacao, incluindo restrições globais, E1.1–E1.8 e matriz de responsabilidades por etapa. Consultei E1.1–E1.8, A1, execucao-etapa-1, arquitetura, decisões, handoff e revisões anteriores como alegações a confrontar.
- Método: passes de requisitos, configuração/fronteiras, edição/autenticação, modelos/rotas, mídia, publicação/migração e integração entre leitores. Li os caminhos críticos de produção, inventariei os testes de todo o pacote e examinei corpos de testes ligados às garantias e falhas mais relevantes. Leituras extensas foram divididas; trechos truncados relevantes foram relidos. Não afirmo inspeção linha por linha de todos os testes, licenças ou snapshots gerados.
- Guia aplicado: requesting-code-review/code-reviewer.md indicado pelo coordenador. A skill verification-before-completion orientou a separação entre evidência lida e execução própria; a proibição explícita de repetir suites prevaleceu.
- Checkout/index/HEAD/branch preservados. Nenhum DB, build, Next, suite, harness de reprodução ou subagente executado. O único arquivo escrito nesta revisão é este relatório no workspace do chat.

## Forças específicas

1. **A publicação tem uma fronteira de confirmação explícita.** A intenção é gravada na mesma transação editorial, e o retry usa leitura independente de intenção comitada, escritor exclusivo entre processos e CAS do head. O guard de COMMIT observa a promise real do adapter, em vez de aceitar apenas o retorno Native. Referências: [publication-updates.ts:43](E:/a-design-for-life/src/helpers/payload/publication-updates.ts:43), [publication-coordinator.ts:31](E:/a-design-for-life/src/helpers/payload/publication-coordinator.ts:31), [transaction-settlement.ts:29](E:/a-design-for-life/src/helpers/payload/transaction-settlement.ts:29).
2. **A composição pública conserva uma geração capturada.** Perfil, Navegação, cases, ordem, destaque, contagem, canonical, histórico, alternates e sitemap derivam da mesma raiz no agregado. O teste de integração mantém explicitamente uma raiz antiga durante publicação e reordenação, sem incorporar drafts PT/EN. Referências: [read-published-portfolio.ts:41](E:/a-design-for-life/src/config/read-published-portfolio.ts:41), [read-published-portfolio.integration.test.ts:142](E:/a-design-for-life/src/config/read-published-portfolio.integration.test.ts:142).
3. **Concorrência editorial permanece no servidor.** Lease, revisão observada, CAS, versão e espelho Native participam da transação. A restauração exige o caminho protegido e cria draft; campos técnicos e capabilities não dependem do CSS administrativo. Slugs usam reserva única por idioma e conservam histórico sem renomeação automática. Referências: [editorial-revision.ts:452](E:/a-design-for-life/src/helpers/payload/editorial-revision.ts:452), [case-routes.ts:1](E:/a-design-for-life/src/features/cases/content/hooks/case-routes.ts:1).
4. **Mídia tem autorização separada dos bytes.** Intake autenticado precede parsers; manifestos e objetos são privados; referências são reunidas e ordenadas antes do CAS concorrente; SQL não concede bytes na ausência de grant da raiz. SVG é recusado, e animações/PDF seguem a decisão explícita, sem inventar uma política nova. Referências: [native-intake.ts:1](E:/a-design-for-life/src/features/media-library/content/hooks/native-intake.ts:1), [track-media-usage.ts:1](E:/a-design-for-life/src/features/media-library/server/track-media-usage.ts:1), [resolve-media-access.ts:40](E:/a-design-for-life/src/features/media-library/server/resolve-media-access.ts:40).
5. **O modelo editorial permanece fechado.** Três tipos de bloco, apresentações predefinidas, comparação textual com dois cards, UUIDs de leitura e TOC/títulos derivados. A fixture ilustrativa permanece draft e não inventa resultados de negócio. Não há segunda API editorial ou collection técnica adicional além de publication-updates.
6. **As correções I1/I2/I3/R-MEDIA foram integradas sem trocar a autoridade pública.** Os testes revisados usam logout Native, renomeação real de tabela, EISDIR real e rejeição real do ACK. Diferenciam falta de prova, intenção comitada pendente, ausência privada e cobertura pública indisponível. Os wrappers de temporização chamam o método real; não fabricam linhas ou commits. Referência: [publication-failure-boundaries.integration.test.ts:120](E:/a-design-for-life/src/config/publication-failure-boundaries.integration.test.ts:120).

## Achados

### Critical

Nenhum achado Critical demonstrado. Isso não certifica ausência de vulnerabilidades em dependências ou topologias ainda não implementadas.

### Important

#### W1 — P1: GET Native com draft=true pode expor a republicação ainda pendente

**Local principal:** [publication-fields.ts:98](E:/a-design-for-life/src/helpers/payload/publication-fields.ts:98), em conjunto com o filtro de acesso na linha 25 e o enfileiramento nas linhas 119–132. [publication-updates.ts:71](E:/a-design-for-life/src/helpers/payload/publication-updates.ts:71) altera apenas o head. A fachada [route.ts:18](E:/a-design-for-life/src/app/(payload)/api/[...slug]/route.ts:18) delega GET Native sem restringir draft=true anônimo.

**Condição concreta:** um documento de case-content, professional-profiles ou site-navigation já teve a primeira publicação confirmada (head.publicConfirmed=true). Uma atualização seguinte com status published comita, mas a confirmação pública permanece pendente, por exemplo porque o escritor público está ocupado.

**Cadeia causal:**

1. beforeChange copia o publicConfirmed=true do head para os dados da atualização.
2. Payload 3.92.1 salva a nova versão antes dos hooks afterChange. Essa versão contém o novo corpo, status published e publicConfirmed=true herdado.
3. afterChange cria a intenção e muda o head para publicConfirmed=false. Não atualiza o marcador da versão recém-criada.
4. Em GET com draft=true, findOperation e findByIDOperation convertem o filtro de acesso para os campos da versão. O adaptador queryDrafts consulta latest=true e version.publicConfirmed=true, sem verificar o marcador atual do head.
5. A versão pendente satisfaz o filtro e seu corpo pode ser devolvido ao visitante, embora a raiz pública ainda exponha a geração anterior. Remover o campo técnico na resposta não remove o corpo já selecionado.

**Impacto:** exposição antecipada do conteúdo destinado à próxima publicação e quebra da garantia de que o alvo pendente não vira conteúdo público por outra superfície Native. Afeta a listagem e findByID com draft=true nas três collections versionadas. Não atribuo a mesma cadeia ao endpoint count, cujo caminho consultado não seleciona drafts.

**Evidência:** cadeia estática confirmada no pacote e no código instalado de Payload/@payloadcms/drizzle 3.92.1. A inspeção externa foi estritamente focada neste risco: collections/endpoints/find.js; collections/operations/find.js e findByID.js; collections/operations/utilities/update.js; versions/saveVersion.js; drizzle/dist/queryDrafts.js. Verifiquei também as guardas locais de leitura e a ordem de hooks; não há uma guarda que force seleção publicada para o anônimo. Não executei uma reprodução Native/DB nesta revisão.

**Lacuna do teste atual:** [publication-updates.integration.test.ts:873](E:/a-design-for-life/src/config/publication-updates.integration.test.ts:873) verifica criação inicial, cujo marcador começa false, e GET sem draft=true. Não cobre republicação após uma confirmação anterior.

**Correção recomendada:** impedir que uma leitura anônima use versões para decidir confirmação pública. Centralizar a recusa ou normalização de draft=true para visitantes nos leitores Native, ou adotar uma classificação equivalente baseada na autoridade atual, sem conceder acesso pelo marcador histórico da versão. Preservar a leitura autenticada de drafts e a proteção contra where/sort/inferência; não resolver somente apagando campos depois da consulta.

**Reprodução específica a exigir:** Native/Payload/PostgreSQL reais, primeira publicação confirmada, escritor da raiz ocupado, segunda publicação com título exclusivo comitada e recibo pending. Sem cookie, consultar lista e ID com draft=true, incluindo where pelo título novo; o corpo novo não pode aparecer. Confirmar que o editor autenticado ainda vê o alvo, a raiz anterior permanece e o retry permite a nova publicação. Exercitar cases, Perfil e Navegação; manter controles de draft privado e primeira publicação pendente. Se a escolha for normalizar para draft=false, conferir também totals e seleção, não apenas o JSON final.

#### W2 — P2: endpoints publicados de Perfil/Navegação convertem falha de dependência em 404

**Locais:** [professional-profiles.ts:40](E:/a-design-for-life/src/features/professional-profile/content/collections/professional-profiles.ts:40) e [site-navigation.ts:37](E:/a-design-for-life/src/features/site-navigation/content/collections/site-navigation.ts:37). Ambos retornam status result.ok ? 200 : 404.

**Cadeia causal:** [get-published-profile.ts:19](E:/a-design-for-life/src/features/professional-profile/server/get-published-profile.ts:19) e [get-published-navigation.ts:22](E:/a-design-for-life/src/features/site-navigation/server/get-published-navigation.ts:22) devolvem unavailable quando a raiz é ilegível/corrompida, falta cobertura confirmada ou há dependência inválida. O adaptador HTTP transforma todos esses resultados em inexistência. Assim, um Perfil/Navegação PT anteriormente confirmado passa a responder 404 se current.json ficar ilegível, mesmo com banco saudável.

**Impacto:** quebra o contrato de falha da própria superfície pública já entregue na etapa 1: indisponibilidade conhecida deve produzir 503 seguro, não parecer conteúdo ausente. A raiz única resolve coerência dos dados, mas o transporte perde a classificação. Requisitos: spec 8.1/8.2, P07/P17 e E1.8; não depende da UI completa futura.

**Evidência:** leitura estática dos dois handlers e getters. Não reproduzido em HTTP nesta revisão. Os testes existentes demonstram unavailable no Result e ausência de tradução EN como 404; isso não demonstra o status HTTP de uma falha real de raiz.

**Correção recomendada:** distinguir indisponibilidade de ausência real antes de formar a resposta. Retornar 503 seguro e não armazenável para erro de raiz/dependência ou falta de cobertura de publicação conhecida. Conservar 404 para idioma inválido e conteúdo verdadeiramente ausente/nunca público. Não trocar indiscriminadamente todos os erros por 503 nem usar o SQL para reconstruir/conceder o corpo pendente.

**Reprodução específica a exigir:** confirmar Perfil e Navegação PT; preservar a raiz e substituí-la temporariamente por um diretório (EISDIR) ou JSON inválido no fixture isolado; GET anônimo dos dois /published/pt deve responder 503/no-store. Restaurar em finally e exigir 200. Cobrir raiz ausente/incompleta com publicação conhecida e controles EN nunca publicado/idioma inválido com 404. A reprodução pode aproveitar as primitivas físicas já usadas no teste de boundaries, sem repetir suites como investigação.

### Minor

#### W3 — P3: helper de slug e teste usam lib, contrariando a convenção aprovada

**Locais:** [suggest-slug.ts:1](E:/a-design-for-life/src/features/cases/lib/suggest-slug.ts:1) e seu teste adjacente em lib. Consumidores: [slug-suggestion.tsx:3](E:/a-design-for-life/src/features/cases/components/slug-suggestion.tsx:3) e [server/suggest-slug.ts:1](E:/a-design-for-life/src/features/cases/server/suggest-slug.ts:1).

O plano, restrições globais, exige “Usar helpers, nunca lib”. É um desvio real de requisito, não preferência do revisor. Não encontrei falha funcional causada pelo nome; por isso a severidade é Minor. Mover implementação e teste para features/cases/helpers, atualizar import e reexport, seguindo o padrão já usado por derive-case-title. Recomendo concluir esse alinhamento pequeno antes de A1. Não requer novo teste comportamental que espelhe a implementação; os consumidores existentes e os checks de importação são a verificação relevante.

## Triagem de I4 e I5

| Item | Conclusão e encaminhamento |
| --- | --- |
| I4 — attempts | Minor de diagnóstico, não novo bloqueio de A1. [publication-coordinator.ts:119](E:/a-design-for-life/src/helpers/payload/publication-coordinator.ts:119) e linha 174 incrementam dentro da transação; o catch persiste diagnóstico sem contar falhas revertidas. As buscas de consumidores não identificaram agendamento, autorização ou idempotência dependentes desse contador. Ele não é um registro completo de tentativas e a documentação atual admite isso. Manter dívida explícita para observabilidade/retry operacional; se corrigido, usar incremento durável concorrente, sem valor obsoleto lido fora do lock. |
| I5 — quatro warnings de lint | Minor de higiene em [20261030_093430_private_media_manifests.ts:3](E:/a-design-for-life/src/migrations/20261030_093430_private_media_manifests.ts:3) e linha 15: payload/req não usados. Não alteram SQL nem demonstram migração defeituosa. Podem ser removidos sem mudar DDL; não são motivo independente para bloquear A1. |
| I5 — pg client.query | Depreciação real, origem exata ainda não localizada. Os passes atuais não provam compatibilidade com pg9; o aviso também não prova corrupção no adapter fixado. Manter visível e exigir rastreamento focado da chamada antes de atualizar pg/adapter ou alegar compatibilidade futura. Nenhuma supressão recomendada. |
| I5 — NO_COLOR/FORCE_COLOR | Ruído de configuração do reporter; sem falha funcional demonstrada. Não promover automaticamente a bug de publicação. |

## Riscos herdados confrontados com a integração atual

A pesquisa registrada de dependências foi lida; não fiz novo audit remoto nem afirmo que estes riscos estejam eliminados. A classificação abaixo trata do alcance demonstrado na etapa 1 e não equivale à aceitação do usuário para produção.

| Risco | Avaliação atual / precisa de correção adicional antes de A1? |
| --- | --- |
| SEC-DOMPURIFY-VENDOR | O override npm não substitui o DOMPurify embutido no Monaco. O cenário documentado depende de SAFE_FOR_TEMPLATES/DOM e execução posterior; não identifiquei um fluxo editorial atual que satisfaça essa cadeia. Lexical está fechado e JSON técnico está oculto. Permanece risco nomeado; sem novo bloqueio demonstrado por esta integração. Reavaliar antes de abrir HTML/editor técnico ou atualizar o fornecedor. |
| SEC-HAPPY-DOM | A versão vulnerável transita pela árvore Lexical; o caminho observado usa headless, sem o import /dom ou um fluxo de importação HTML habilitado nesta feature. Não tratar dependência instalada como corrigida, nem fazer major silencioso. Sem nova exploração concreta identificada. |
| SEC-DEEPMERGE | A pesquisa preserva a prova de herança de protótipo na biblioteca e ausência de patch oficial. Schemas Zod estritos reduzem a entrada própria, mas não certificam todos os caminhos Native. Não demonstrada uma cadeia HTTP atual de exploração; manter risco explícito. |
| SEC-ESBUILD-TOOLING | Versão transitiva antiga permanece; instalar uma versão direta nova não a corrige. O uso observado é transformação/ferramenta, sem servidor esbuild exposto. Sem bloqueio adicional demonstrado no runtime da etapa. |
| AUDIT-GRAPHQL-SCALARS-DISCREPANCY | Registro distingue versão instalada e faixa/implementação descrita no advisory. GraphQL está desabilitado. A discrepância não autoriza declarar a dependência segura nem trocar major apenas para limpar o audit. |
| TOOLING-ESLINT9 | Depreciação da ferramenta, combinação fixada com peers/checks funcionando. Sem defeito atual de produto demonstrado. Planejar atualização compatível, sem confundir depreciação com falha atual. |
| Limiter por processo | Orçamento de transporte é compartilhado por processo/endpoint e reinicia com o processo; não é controle distribuído por IP. Guardas Native de tentativa/token continuam relevantes. Escopo local comprovado, fortalecimento de ingresso/produção pertence à etapa 3. |
| Mail capture | Captura local limitada e temporária; staging/produção não enviam e-mail real por esse mecanismo. Provedor e recuperação operacional reais são posteriores. Não há claim de serviço de e-mail pronto para produção. |
| LEASE-UNLOAD-BEST-EFFORT | Saída de aba/conexão abrupta pode impedir release. Expiração autoritativa de 300s permanece; não vi reintrodução de tomada insegura de lease. Limite operacional explícito, sem correção adicional obrigatória para A1. |

W1 é uma exposição própria da aplicação e deve ser corrigida independentemente dessas avaliações de dependências.

## Integração, evidência e limites

| Área | Resultado da revisão |
| --- | --- |
| Stack e isolamento | Versões fixadas, lockfile/instalação frozen na CI, adapter oficial e namespaces de teste. Payload permanece a via editorial; SQL direto observado pertence a migrações e provas de falha, não a uma segunda API editorial. |
| Fronteiras/contratos | Features e exports, server-only, Zod e mapeadores coerentes nos caminhos revisados; desvio de convenção em W3. Testes adjacentes e guardas de grafo existentes. |
| Native CMS, contas e restauração | Sessões/contas individuais equivalentes, CAS e restauração draft no servidor. A seleção pública Native tem W1; portanto não aprovo integralmente essa fronteira no target. |
| Slugs/PT/EN/modelo Figma | Identidade e locale imutáveis, reservas/histórico concorrentes, títulos/chaves de leitura preservados, catálogo de blocos fechado. UI pública completa, idioma da navegação visual e Motion/tokens permanecem nas tarefas futuras da matriz 9. |
| Mídia | Bytes e derivados privados, inspeção real, limites 10MB/5MB e política explicitamente aprovada, autorização por geração e exclusão serializada. R2/provider/backup e dimensionamento final não foram certificados. |
| Publicação/recibos/restart | Caminhos de intenção+TX, COMMIT real, pending durável, retry idempotente, tentativa obsoleta e ACK falho foram confrontados. A raiz preserva o anterior confirmado. Leitores HTTP estruturais ainda têm W2 e leitura Native tem W1. |
| SEO/analytics | Contratos de dados de SEO/sitemap/alternates revisados; HTML SEO completo é posterior. Runtime atual não habilita medição local/staging/preview/teste. A política GA sem cookies/sem banner permanece para etapa 3, sem mudança proposta aqui. |
| Migração | Captura canônica legacy, bloqueio de bootstrap, histórico e restauração draft revisados. O root informou validação dos originais do upgrade real old0fa. Não executei upgrade, roundtrip ou comparação exaustiva de cada coluna do DDL inicial nesta revisão. |

**CI/evidências:** metadados locais lidos em work/github-ci-a719cc1-status.json fixam target a719cc1, run **41081185948**, job **124150437696**, Ubuntu24.04 e conclusion=success, incluindo Verify e Browser journeys. O root informou ter baixado e validado o log completo de 372.499 bytes: **456 testes/73 arquivos, zero skips e 25 E2E**, incluindo SIGSTOP Linux. Os resultados Windows anteriores eram 455 + 1 skip, e não certificavam o ramo Linux. O root também informou validação dos 50 pares de logs, 10 arquivos legacy e seis PNGs contra originais. São evidências executadas/conferidas pelo coordenador, não execuções deste revisor. Não revalidei integralmente esses pares ou as imagens.

**Limites materiais:** nenhuma certificação de atomicidade distribuída FS+SQL, multi-host, power-loss no Windows, R2/e-mail reais, imagem final de execução, backup, deploy ou produção. O processo HTTP de prova de restart não deve ser descrito como restart completo do Next. Os hooks internos de COMMIT/Native precisam de revalidação ao atualizar Payload/adapter. Não reabri a fonte Figma remota nem julguei fidelidade visual futura a partir de fixtures. A revisão de segurança de dependências se apoia na pesquisa registrada e nas superfícies de código observadas, não em audit remoto atualizado.

## Veredicto e sequência de fechamento

**Ready for technical A1: With fixes.** Corrigir W1 e W2, reproduzir seus ramos com testes reais específicos e corrigir W3. Re-review do novo SHA deve conferir as correções e as regressões dos contratos já protegidos; o coordenador continua responsável pelos gates e pela CI exata do novo candidato. I4/I5 e os riscos herdados devem permanecer explícitos, sem serem descritos como resolvidos por esses fixes.

A revisão ampla anterior e a aprovação estreita da Round1 não substituem esses achados de integração. **Nenhuma promoção de a719cc1 recomendada neste estado. A1 depende de aprovação explícita do usuário após os gates; etapa 2 permanece não autorizada.**
