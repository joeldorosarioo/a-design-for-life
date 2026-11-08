# E1.8 — revisão independente da tarefa

## Spec Compliance

- **SPEC: issues.** Os contratos centrais foram implementados, mas há três lacunas no comportamento de falha: sucesso Native sem recibo após perda da segunda autenticação; exceções anteriores ao coordenador escapam do contrato `Result`/retorno parcial; e ausência de projeção de uma rota comprovadamente pública é convertida em 404. Referências e cadeias causais em I1–I3.
- **QUALITY: Needs fixes.** As provas existentes são substanciais, mas não exercitam os três ramos identificados. É necessário corrigir e demonstrar os casos com Native/Payload e PostgreSQL reais antes de aprovar a tarefa.
- **⚠️ Cannot verify:** CI Linux do SHA exato ainda estava em andamento na comunicação do root; o skip Windows não prova SIGSTOP Linux (`src/helpers/payload/publication-writer.test.ts:75`). Esta revisão não concede A1 nem altera os 87,5% da etapa 1 (`docs/verification/A1.md:3`, `:19`).

## Escopo e proveniência

- Base: `0f3aa9452309d097eab9d9f8c8125523289c7737`.
- Target: `a78b2ddda26176bf7b93d7ab8ab1588b2023cb54`.
- Pacote: `e1-8-task-review-a78b2dd.diff`, 438447 bytes; SHA256 conferido: `149a99d04f4400dddd002d276019f695f3a95d2de35ed6af39a04cb50adf9cd6`.
- Requisitos: `E1.8-approved-task.md` e restrições globais transmitidas pelo root. Handoff e documentos de verificação foram tratados como alegações, confrontadas com os hunks de implementação e testes.
- Todo o diff textual foi lido em partes, incluindo fonte, testes, migração SQL, tipos gerados incluídos no pacote e documentação autoral. Um trecho de saída inicialmente truncado foi relido antes da avaliação; não se tratou truncamento como conteúdo completo. Não se rederivou o diff.
- Checkout, index, HEAD e banco não foram alterados. Não executei build, Next, suites globais ou subagentes. O único arquivo escrito é este relatório.

## Strengths

- A intenção e o head são escritos com o mesmo `req` transacional (`src/helpers/payload/publication-updates.ts:43`). O retry usa request independente, escritor entre processos e CAS no head, e reconcilia a raiz antes de aposentar intenção obsoleta (`src/helpers/payload/publication-coordinator.ts:27`, `:50`, `:65`, `:93`). Isso corresponde às corridas reais e falhas de ACK demonstradas nos testes, sem depender de um Map de processo.
- O guard de COMMIT observa a promise bruta de Drizzle e preserva o adapter nativo (`src/helpers/payload/transaction-settlement.ts:29`, `:47`). Os testes inserem falha PostgreSQL diferida e verificam que head, versões e operação não são apresentados como salvos; também isolam três transações simultâneas (`src/helpers/payload/transaction-settlement.integration.test.ts:63`, `:163`).
- A raiz completa é escrita em arquivo temporário, sincronizada e renomeada sob exclusividade; a geração explícita é repassada aos consumidores (`src/helpers/payload/public-root.ts:29`, `src/config/read-published-portfolio.ts:41`). As integrações conferem ordem, destaque, corpo, canonical, histórico e tradução privada sob gerações diferentes (`src/config/read-published-portfolio.integration.test.ts:49`, `src/features/cases/content/collections/route-lifecycle.integration.test.ts:414`).
- O modelo continua fechado: quatro apresentações de seção, somente três tipos de bloco, comparação com dois textos, títulos/TOC derivados e UUIDs preservados entre reordenação e tradução (`src/features/cases/content/fields/case-presentation-fields.ts:17`, `src/features/cases/content/hooks/validate-publication.ts:47`, `src/features/cases/server/map-case-detail.ts:5`). Os testes Native persistem/releem versões, recusam estilo/HTML livre e mantêm o exemplo ilustrativo em draft (`src/features/cases/content/fields/case-presentation.integration.test.ts:103`, `:213`, `:327`, `:366`).
- Migração captura a seleção canônica `draft:false`, histórico e tombstones, e bloqueia mutações durante bootstrap pendente (`src/config/capture-legacy-publications.ts:43`, `src/features/cases/server/case-publication.ts:50`, `src/helpers/payload/require-legacy-bootstrap.ts:9`). A documentação distingue explicitamente reinício do harness HTTP de reinício completo do Next e não promete atomicidade FS+SQL ou topologia multi-host (`docs/architecture/publicacao-e-falhas.md:22`, `:57`).

## Issues

### Critical (Must Fix)

Nenhum achado P0 demonstrado neste escopo.

### Important (Should Fix)

#### I1 — [P1] Segunda autenticação nula devolve sucesso Native sem estado parcial

- **Arquivo:** `src/helpers/payload/publication-transport.ts:84–85`; consumidor: `src/app/(payload)/api/[...slug]/route.ts:66`.
- **Cadeia causal:** a gravação Native já terminou e produziu um documento com intenção/revisão. O wrapper autentica novamente. Se o token expirar ou a sessão for revogada entre as duas autenticações, `if (!user) return response` devolve integralmente o 2xx original, sem executar retry, sem `publicationReceipt` e sem mensagem de pendência. A intenção permanece pendente, mas a resposta de publicação não informa essa condição.
- **Impacto:** viola a exigência de não marcar sucesso público com base apenas na gravação e de retornar o estado parcial específico. O fluxo pode anunciar sucesso Native enquanto os leitores conservam a geração anterior. A existência de um banner consultado separadamente não corrige o contrato dessa resposta e sua consulta também depende da sessão.
- **Evidência:** leitura estática e simulação de ramo em memória com a função extraída do pacote: `status=200`, `sameResponse=true`, `receipt=null`, `retryCalls=0`, preservando a mensagem de sucesso fornecida pelo Native simulado. **Não é reprodução de expiração/revogação numa sessão Native real.**
- **Correção:** ao reconhecer uma resposta editorial com intenção, nunca retornar sucesso indiferenciado por perda de autenticação. Emitir resultado seguro e explícito de confirmação indisponível, mantendo a distinção entre gravação e confirmação pública; não promover com usuário ausente. Exigir RED/GREEN com Native real, provocando perda da sessão entre gravação e confirmação e verificando resposta, intenção persistida e raiz anterior.

#### I2 — [P1] Falhas de leitura antes do coordenador escapam de `Result` e perdem o retorno parcial

- **Arquivo:** `src/helpers/payload/publication-updates.ts:95–122`, especialmente `:111`; limites adicionais em `src/helpers/payload/publication-coordinator.ts:30–43` e `src/helpers/payload/publication-transport.ts:83–105`.
- **Cadeia causal:** criação do request independente, leitura inicial da operação e leitura da raiz/dependência ocorrem fora de qualquer `try/catch` do contrato público. Além disso, a leitura inicial interna de `coordinator.retry` antecede seu `try`. Uma falha SQL ou de leitura de `current.json` rejeita a Promise antes do trecho que devolve `update-pending`. `confirmNativePublication` também não contém essas exceções. No comando Local, `confirmPublicationWrite` não as traduz; os wrappers existentes `caseResult`/`editorialResult` relançam erros comuns, em vez de preservarem recibo.
- **Impacto:** um conteúdo e uma intenção que já comitaram podem gerar erro genérico sem operationId/estado parcial. A assinatura `Promise<Result<PublicReceipt>>` não é cumprida nessas falhas esperadas. O editor perde a informação necessária para distinguir falha de gravação de pendência pública e repetir somente a intenção correta.
- **Evidência:** simulação em memória de `readPublicRoot` lançando `EACCES` após encontrar a operação produziu `REJECTED instead of Result`; o coordenador não chegou a executar. A consulta focada dos wrappers inalterados confirmou o relançamento (`src/features/cases/server/case-result.ts:19`, `src/helpers/payload/editorial-result.ts:34`). **A temporização da falha após COMMIT não foi reproduzida em Native nesta revisão.**
- **Correção:** fechar o tratamento de falhas desde a primeira leitura independente, diferenciando operação não comprovadamente comitada de operação comitada cuja promoção não concluiu. Preservar o recibo pendente quando já houver comprovação da intenção; retornar indisponibilidade segura quando não houver essa comprovação. Exigir RED/GREEN Native com falhas nas leituras preliminares e no FS, verificando persistência, resposta parcial/segura e retry idempotente.

#### I3 — [P2] A ausência da projeção vira 404 mesmo quando o banco comprova uma rota já pública

- **Arquivo:** `src/features/cases/server/resolve-case-route.ts:43–51`.
- **Cadeia causal:** se a raiz não contiver o assunto, o código consulta `case-routes`, mas descarta o resultado e retorna sempre 404. Assim, `current.json` ausente ou uma projeção ainda incompleta durante bootstrap produz 404 mesmo quando a consulta devolve `everPublished:true` para a rota corrente/histórica. A origem saudável prova a existência da reserva pública, não sua ausência.
- **Impacto:** converte indisponibilidade da projeção em inexistência do case, contrariando a distinção solicitada entre estado sem cache e ausência real. Também pode apresentar como inexistente uma retirada conhecida, cuja classificação depende da projeção ausente. Não se deve reconstruir o corpo a partir do alvo editorial pendente para resolver isso.
- **Evidência:** simulação em memória da função real com raiz nula e resposta de origem `{everPublished:true,state:'current'}` retornou `{status:404}` após uma consulta. **Isso prova o ramo, não uma falha operacional de volume em Native.** Os E2E existentes verificam origem indisponível e endereço desconhecido, mas não esse retorno positivo da origem com projeção ausente (`src/features/cases/server/resolve-case-route.e2e.test.ts:317`).
- **Correção:** usar o resultado da classificação privada: conservar 404 para ausente/nunca público; se houver publicação histórica sem cobertura confirmada suficiente, responder 503 seguro. Exigir integração real com raiz isolada ausente/incompleta, rota previamente confirmada, histórico e controles desconhecido/draft.

### Minor (Nice to Have)

#### I4 — [P3] Contador de tentativas não registra tentativas que falham

- **Arquivo:** `src/helpers/payload/publication-coordinator.ts:112`, `:167`, `:186–195`.
- **Risco estático:** `attempts` só incrementa nos caminhos SQL de sucesso/superseded, dentro da transação que é revertida em falha. O catch persiste apenas `diagnostic`. Falhas repetidas do escritor/FS podem deixar `attempts=0` indefinidamente, embora a collection seja descrita como persistência de tentativas.
- **Impacto:** diagnóstico operacional inexato; não demonstrado como quebra de confidencialidade ou de idempotência. Registrar tentativas de maneira durável e concorrente, sem usar valor obsoleto lido antes do lock. Não executei um quarto teste para esse contador.

#### I5 — [P3] Avisos permanecem como dívida explícita, sem prova de falha atual

- **Arquivo:** `docs/verification/E1.8.md:39`; `docs/verification/artifacts/E1.8/verify-candidate.txt:6`.
- Os quatro warnings históricos de parâmetros não usados da migração E1.6 são ruído de lint, sem impacto funcional novo demonstrado. O aviso de `pg.client.query()` concorrente merece localizar a origem antes de atualizar para pg9, sobretudo com a compatibilidade de COMMIT dependente do adapter. Não há evidência nesta revisão de que o aviso implique perda de dados na versão fixada. O aviso NO_COLOR/FORCE_COLOR é de reporter. Nenhum foi silenciado nem se declarou saída limpa; eles não são o motivo do veredicto bloqueante.

## Cobertura dos requisitos e limites

| Requisito | Evidência revisada / conclusão |
| --- | --- |
| Collection técnica única, server-only; intenção e publicação na mesma TX | `publication-updates.collection.ts:4`, `publication-updates.ts:43`, `publication-fields.ts:119`; atende ao desenho observado. SQL e tipos gerados incluem apenas a collection técnica adicional. |
| Pending persistido, retorno parcial e ação de retry | `publication-status.tsx:70`, `publication-transport.ts:105`, E2E `src/config/publication.e2e.test.ts:37`; implementado no caminho coberto, com I1/I2. |
| Reinício, idempotência e tentativa antiga sem substituir nova | `publication-coordinator.ts:65`, `:115`; `src/config/publication-updates.integration.test.ts:401`; `publication-restart.integration.test.ts:20`; E2E antigo→novo em `src/config/publication.e2e.test.ts:139`. Os testes usam Payload real e observações públicas, além de barreiras/injeções limitadas. O helper nominal `testing/fixtures/cms-scenario.ts` do exemplo não foi adicionado; o comportamento foi implementado com cenários inline e fixtures existentes. |
| Draft posterior não vira publicação; PT/EN independentes | alvo imutável em `case-publication.ts:92`, seleção de intenção em `publication-fields.ts:84`; integrações de draft posterior e agregado `read-published-portfolio.integration.test.ts:49`; restauração/independência em `case-presentation.integration.test.ts:366`, `:496`. |
| Corpo, rotas, ordem, destaque, contagem, SEO, sitemap, alternates, perfil/nav da mesma geração | `read-published-portfolio.ts:41`, `:55`, getters correspondentes e testes reais; observado no diff. O fallback de rota sem cobertura tem I3. |
| Retenção de mídia e reservas durante pendência/ACK falho | `case-routes.ts:202`, `:225`, `case-publication.ts:68`, `change-media-usage.ts:11`, `track-media-usage.ts:36`; integrações reais de ACK, supersession e exclusão revisadas. |
| Figma sem builder livre; três blocos; comparação textual fechada; chaves/TOC derivados | Campos, schemas, mapper, fixture e testes Native revisados. Não reabri a referência Figma nem validei visualmente as seis PNGs nesta revisão; o root informou sua validação. Não alego equivalência visual por inferência do código. |
| Migração, versões e restauração apenas draft | captura canônica e migração lidas; resumos de upgrade real conferidos. Parte da implementação de restauração/lease e validação de formatos de mídia é herdada e não está completa nos hunks; não se infere auditoria integral desses módulos inalterados. |
| Verify completo, CMS com dois editores, A1 | índices/resumos locais conferidos; o diff contém jornadas Native e adaptações dos testes anteriores. CI Linux exata e aprovação explícita de A1 continuam gates do root/usuário. Nenhuma etapa 2 autorizada. |

## Verificações realizadas

1. Hash e tamanho do pacote conferidos; leitura integral por partes, sem comandos Git de rederivação.
2. Leitura do índice `docs/verification/artifacts/E1.8/evidence-index.json`. Leitura e comparação de SHA256 com o índice de quatro exportações: `verify-candidate.txt` (`5cfb7703…5928`, 445 pass/72 arquivos/1 skip), `e2e-candidate.txt` (`630460ef…2072`, 25 pass), `receipts-batch2.txt` (`bc8bdf3f…1ca6`, 22 pass/5 arquivos) e `legacy-routes-green-verify.txt` (`c2f72098…058e`, registro saneado do upgrade). São exportações identificadas como extratos, não logs completos nem execução independente do revisor. O root informou validação separada de 47 pares original/exportado e seis PNGs; esta revisão não se atribui essa execução.
3. Um harness em memória, executado por Node 24.22.2, extraiu as três funções do próprio diff e transpôs TypeScript para JavaScript sem arquivos temporários. Dependências foram simuladas. Saída observada: auth nula → 200 original/sem recibo/zero retries; leitura de raiz EACCES → Promise rejeitada; raiz nula + rota pública encontrada → 404. Este harness só confirma controle de fluxo. Não é RED/GREEN Native, prova transacional, prova de permissões ou corrida real.
4. Única investigação externa focada de implementação: risco I2, verificar se o wrapper de comando captura o erro e preserva resultado parcial. A tentativa inicial de ler `run-editorial-command.ts` encontrou arquivo inexistente. A busca restrita e as linhas 9–17 omitidas do hunk de `publish-case.ts` identificaram `caseResult`; foram lidos `case-result.ts` e `editorial-result.ts`, que confirmam o relançamento de erros comuns. Nenhum outro arquivo alterado foi relido fora desse hunk incompleto.
5. Não foram repetidas suites registradas. Os novos casos de falha requerem testes de integração específicos reais pelo implementador, e os gates finais do root devem ser vinculados ao novo SHA se houver correção.

## Assessment

**SPEC: issues. QUALITY: Needs fixes.** A implementação apresenta separação coerente entre intenção editorial e geração pública, com provas reais de vários modos difíceis de falha. Os limites de resposta e a classificação de cobertura ausente ainda contradizem contratos explícitos; os passes existentes não cobrem nem eliminam I1–I3.

**A1 continua pendente; etapa 1 permanece 87,5%; etapa 2 não autorizada.**
