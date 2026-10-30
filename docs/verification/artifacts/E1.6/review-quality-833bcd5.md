# E1.6 — revisão independente de qualidade/correção/segurança

Target: `833bcd54e56e6a562614f470c253177ab04df5e5`. Base: `a2741a295135be49d8408aced4cfa67f29af4c10`. Data: 2026-10-30. Etapa 1: 75% (6/8); E1.6 continua candidata, E1.8/A1 não concluídas.

**Veredito: solicitar correção do achado P2 abaixo antes de fechar o gate de qualidade.** Contagem: 0 críticos, 1 importante (P2), 0 menores. Não identifiquei caminho acionável de exposição de bytes privados, perda de referências confirmadas ou exclusão de mídia publicada no escopo inspecionado. Isso não constitui certificação de ausência de vulnerabilidades.

## Achado importante

### [P2] Ordenar os locks pela união das duas transições da publicação

Local principal: `src/features/cases/content/hooks/case-media-usage.ts:49–51`. Mesmo padrão em `src/features/professional-profile/content/profile-media-usage.ts`, ramo publicado. Implementação relacionada: `src/features/media-library/server/track-media-usage.ts:27–41,68–84`.

O hook chama `trackMediaUsage` para `confirmed` e depois para retirar `draft`, conservando a mesma transação. Cada chamada inclui somente usos anteriores do seu próprio estado e ordena somente os IDs daquele conjunto. Portanto, a ordenação não cobre todos os locks que a transação vai adquirir.

Interleaving alcançável, sem acesso privilegiado ou dados inválidos:

1. Há dois documentos editoriais independentes e válidos, A e B, ainda não publicados. A tem uma referência draft à mídia X; B tem uma referência draft à mídia Y. X e Y estão prontas.
2. Em sessões autorizadas com leases válidos para documentos diferentes, publicar A enviando sua nova capa Y e publicar B enviando sua nova capa X. Os demais campos obrigatórios estão preenchidos; não há outros usos para simplificar.
3. T1 executa a fase confirmed de A e atualiza/bloqueia Y. T2 executa a fase confirmed de B e atualiza/bloqueia X. Nenhuma fase inclui a referência draft antiga do próprio documento.
4. T1 entra na fase de retirar draft de A e tenta atualizar X. T2 entra na fase de retirar draft de B e tenta atualizar Y. T1 espera T2 e T2 espera T1.

O adaptador instalado `@payloadcms/drizzle@3.92.1` foi inspecionado: `updateOne({ options: { atomic: true }, req })` executa `UPDATE ... WHERE ... RETURNING` usando `getTransaction(req)`. Os locks permanecem até o término da transação. PostgreSQL precisa abortar uma das publicações nesse ciclo. As quatro tentativas em `trackMediaUsage` só tratam CAS que retornou null; não capturam o erro de deadlock nem reiniciam a transação abortada. Assim, uma publicação concorrente válida pode falhar por uma ordem de locks criada pela aplicação, embora os documentos sejam distintos. O rollback evita afirmar corrupção ou vazamento.

Garantia afetada: consistência operacional das publicações concorrentes e a alegação arquitetural de que as operações reclamam Media em ordem estável. Os testes atuais de corrida verificam publicação versus lixeira sobre uma única linha Media e rollback; não cobrem esta aquisição cruzada entre fases.

Correção sugerida: reunir os IDs novos e os usos anteriores draft/confirmed do dono, adquirir a união em uma única ordem estável dentro da transação e aplicar ambas as transições após isso. Conservar o CAS/revalidação dos tipos e disponibilidade. Um teste real PostgreSQL com barreiras nas duas transações deve demonstrar que ambas terminam sem deadlock e que só as referências finais permanecem confirmadas.

**Classificação da evidência:** fatos estáticos e sequência causal verificados no código fixado e no adaptador instalado. A corrida específica não foi executada nesta revisão, porque a tarefa restringiu expressamente DB/serviços e reexecuções amplas. Não é alegada reprodução runtime nem usado double como prova de PostgreSQL.

## O que foi verificado na leitura

- Intake nativo autentica antes de decoder/storage mesmo em Local override; cria manifesto somente após validação e escrita dos derivados. Receipt em WeakMap, campos técnicos recusados e bytes imutáveis por MediaID. A consulta original do update do Payload ocorre depois do guard que reclama a linha, evitando concluir erroneamente que `writeMediaReceipt` repõe um guard antigo.
- Resolver consulta Media/estado/usos antes de ler qualquer objeto. Preview requer usuário da collection users; rota própria exige origem adequada. GET/HEAD próprios, handler nativo e negativas usam respostas seguras sem cache. Configuração Next desativa o otimizador e a rota é dinâmica. HEAD nativo fechado/404 é limitação explicitamente documentada.
- Storage privado usa chaves aleatórias, criação exclusiva e verificação de tamanho/SHA256; não decide publicação. Guard de composição rejeita roots resolvidos sob public e .next/static. Testes confinam overrides ao namespace bucket/banco isolado.
- CAS de usos altera guardRevision e JSON de usos na mesma operação atômica, passa req e reconsulta em conflito; guard de lixeira reclama a mesma linha e protege pending/confirmed. Leitura do código das integrações confirmou chamadas ao adaptador real, barreiras após escritas reais e rollback observável, distinguindo-as dos doubles dos testes de resposta HTTP.
- Extração fica nas features, em caminhos aprovados, normaliza IDs e valida todos os tipos esperados para um mesmo ID. Usos anteriores são retidos, e remoção de referência draft já na lixeira é permitida sem permitir novo uso indisponível.
- Decode integral Sharp usa todas as páginas/frames; política de APNG/AVIF animado/senha de PDF segue a decisão autorizada. WebP deriva com delays/loop e tratamento por frame de orientação. PDF combina worker PDF.js e QPDF; cancelamento/cleanup e classificação de indisponibilidade estão explícitos. Não foi introduzido teto próprio novo de dimensão/frame/página.
- Gate permite um trabalho e um em espera, mantém o slot por validação/processamento/escrita e libera no finally. Órfãos de storage em falha não ganham autorização; retenção e reconciliação estão documentadas.
- Migração aditiva, composition roots e contratos não introduzem segundo domínio editorial em helpers. Não vi motivo para promover duplicação superficial ou preferências de estilo a bloqueadores.

## Evidências e limites

Foram lidos o briefing aprovado, AGENTS.md, trechos relevantes do contrato CMS, a decisão de mídia, arquitetura e relatório E1.6, além de fonte/testes fixados por `git show` no target. A primeira leitura combinada do relatório sofreu truncamento; os trechos necessários foram relidos em blocos. Não se presume leitura integral de saída truncada. Os hashes abaixo identificam os arquivos inspecionados; não significam que cada linha de cada arquivo maior foi auditada.

As caudas dos artefatos `e1.6-resume-verify-current.txt` e `e1.6-resume-e2e-current.txt` registram, respectivamente, 347 testes/49 arquivos + build e 22 jornadas. Esses resultados são evidência existente do autor; esta revisão não executou novamente testes/build. A origem dos testes reais de falha de storage/Media DB também foi inspecionada: renomeiam somente recursos isolados e restauram em finally. As provas por doubles de falha inicial HTTP são adequadamente separadas das provas reais.

Não foram executados DB, serviços, build, migração, staging, commit, push ou subagentes. A revisão não altera o app. CI exato é trabalho paralelo do coordenador. R2 real, empacotamento standalone/container, limpeza/backup operacional e coordenação durável da publicação/cache pertencem aos gates futuros declarados. Medição de recursos local de três controles não foi extrapolada para animação pesada, HTTP Next ou dimensionamento de VPS.

Skills consultados: code-review (eixo de qualidade independente, sem nova delegação) e verification-before-completion (não transformar evidência anterior em alegação de execução nova).

## Hashes das fontes inspecionadas

Os identificadores abaixo são hashes Git blob SHA-1, calculados diretamente no target imutável; não são hashes da árvore de trabalho.

| Arquivo | Git blob SHA-1 |
|---|---|
| AGENTS.md | 3a8473d41d62bc24b5450735e0a4102f3371f566 |
| next.config.ts | 36d60bbe51fb46adb3cb4beab068779a60a6e00d |
| src/payload.config.ts | 1a14164930997052d520a2d03ade003223bbc948 |
| src/config/server-env.ts | fa4f0861402cabbf7e2f494dac50690cdba754cb |
| src/config/server-env.test.ts | 33da8902c422f2be1f083808fdcc3bc740c268f9 |
| src/helpers/storage/object-storage.ts | 368b5fbbd65531fb61691e2627e1b30a24f73bdb |
| src/helpers/payload/editorial-revision.ts | 47dabb0bf4b952551518c1f09fa6a8eb3bcaad47 |
| src/features/media-library/content/collections/media.ts | a762db3bfbc037ea235a94f70473dfaba0d2632c |
| src/features/media-library/content/hooks/native-intake.ts | d672202e60ff6506da5cc1b8986c58e5972bb890 |
| src/features/media-library/server/track-media-usage.ts | aa325d4891f9bff9aba3627fb16cdbd82adf406e |
| src/features/media-library/server/change-media-usage.ts | fd8cb95a290ca24e9f8cb602291519b32c582ca1 |
| src/features/media-library/server/resolve-media-access.ts | 6c46229b8348ca4664b8a9c9d2e4ee86368e9bdc |
| src/features/media-library/server/media-response.ts | aabdde5d9d64784e515cb86c58a3637aa2a6eea9 |
| src/features/media-library/server/validate-upload.ts | 57ce2f89f045f4712818aca467c8585225bee286 |
| src/features/media-library/server/preflight-upload.ts | 818557f3f2957e2b0d26b719499e913259847f07 |
| src/features/media-library/server/process-image.ts | 85ab03e506f956c9e4d03ed0e59674c7cc89d77e |
| src/features/media-library/server/inspect-pdf.ts | a652dd70b04389040b2fe8ba48ae09c56fef359c |
| src/features/media-library/server/check-pdf-streams.ts | 700d265e2b63fc8afdd4a663879fb11099897233 |
| src/features/media-library/server/media-runtime.ts | 131b117ab6cfa999f40566123f4711f222f85ce1 |
| src/features/media-library/server/processing-gate.ts | a9121e1a47f2875e24eab323084d31e064c07dff |
| src/features/media-library/server.ts | b268e916c6dea1434aafa7ed594b788e5f715dd0 |
| src/features/media-library/contracts/upload.schema.ts | 05dc391d3e0787a413d96cb4468aa6d77135bc59 |
| src/features/media-library/contracts/validated-upload.schema.ts | bf271857cfeb56ac184d151f84e240c6e29b9fdc |
| src/features/media-library/contracts/media-usage.schema.ts | 39b8a6d34e6975ead2010656d57f8f8a84a613f4 |
| src/features/media-library/contracts/media-manifest.schema.ts | 4b556047d628eb0e02e3554765606b4ae7225159 |
| src/features/media-library/contracts/media-access.schema.ts | 361ccc5d475e918d5ae363c59777c21d49a52879 |
| src/features/cases/content/collections/case-content.ts | 23bec66ada26facc1b49caf35e2a88c825b62fe7 |
| src/features/cases/content/hooks/case-media-usage.ts | 0e092d34cef25b96145fbe9460171ef0dd557e9c |
| src/features/cases/content/hooks/case-routes.ts | 180b6de63ef0cfbd73d9d96f6195058a5bdfc03e |
| src/features/cases/content/hooks/extract-case-media.ts | d84a361e0ad51e5092c18787262972d01924d900 |
| src/features/professional-profile/content/collections/professional-profiles.ts | f7b4b56f4df5c7144c06a63e8fef828387af762a |
| src/features/professional-profile/content/profile-media-usage.ts | f36bff28e2c40430998d53d618fe9bc389b2f4f9 |
| src/features/professional-profile/content/extract-profile-media.ts | f7733b623d566e3690a15ed731ca2cb076c72bc5 |
| src/app/(portfolio)/media/[id]/[variant]/route.ts | b6ffa0bf32a98a00d9dcf5c5ae7669545c848f76 |
| src/app/(portfolio)/preview-media/[id]/[variant]/route.ts | 47aad20b5416da0d9eeda4f5d425795add906141 |
| src/migrations/20261030_093430_private_media_manifests.ts | 6d04ac3ddd1d962c2d23700f5116d7e21165aaba |
| src/features/media-library/content/collections/media.integration.test.ts | 700c660cd90404d951837efa5bc0c59f17ba8e64 |
| src/features/media-library/content/collections/native-upload.integration.test.ts | daf64c06218e0aa3e1c8d821ea4691c3471a5b25 |
| src/features/media-library/server/media-usage-races.integration.test.ts | 1e9a01e75f64115cc5e6fd8d3b7392a55e633a81 |
| src/features/media-library/server/resolve-media-access.integration.test.ts | ab179f1ab34dfaa083537b1f25d0a9e42ee25f47 |
| src/features/media-library/server/media-delivery.e2e.test.ts | 97a59f57a55b0cdb605a0267d2fe9bf95ab9146f |
| src/features/media-library/server/media-response.test.ts | bb237a46777ee35410e24f64fe8d809edd673327 |
| src/features/media-library/server/validate-upload.test.ts | 51885b5279a030e2bff93104957c9f1d1b069cb4 |
| src/features/media-library/server/process-image.test.ts | 65a2bd9f22da181679cc410e723d02286d64b834 |
| src/features/media-library/server/media-runtime.test.ts | adb032e9bd4d6c8dac059368786f81af08ee3519 |
| testing/fixtures/editorial-lifecycle.ts | 6fed24e551fbc99cabc02e7aa347b3aad03c49d7 |
