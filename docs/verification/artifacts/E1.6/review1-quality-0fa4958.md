# E1.6 — revisão restrita da correção, rodada 1

Base: `833bcd54e56e6a562614f470c253177ab04df5e5`.
Target: `0fa495864cfefcf3489856d66444b81fdf1f730e` (`fix: order media locks across publication transitions`).
Data: 2026-10-30. Etapa 1 permanece 75% (6/8); a promoção depende também do CI do target e do gate do coordenador.

**P2: ADDRESSED. Veredito da revisão restrita: aprovado.** Novos achados no fix: 0 críticos, 0 importantes, 0 menores. Não identifiquei regressão de SPEC introduzida por esta alteração. Este parecer complementa a revisão completa de 833bcd5, sem refazê-la ou ampliar seu escopo.

## Correção do achado

O problema anterior era adquirir linhas Media em ordens distintas entre a fase confirmed e a retirada de draft. Os hooks de Case e Profile agora enviam todas as transições da mesma operação em uma única chamada. A retirada de conteúdo Case também foi adaptada ao novo contrato de lote.

Em `track-media-usage.ts`, o lote é tipado por `MediaUsageCommand[]` e validado por `mediaUsageCommandSchema.array().min(1)`. A feature reúne a união das referências novas e dos IDs que possuem uso anterior correspondente a qualquer dono/idioma/estado do lote, ordena essa união uma única vez e aplica todas as transições em um único CAS por linha. A ordem X/Y passa a ser a mesma nas duas publicações concorrentes. Não há uma segunda fase que adquira posteriormente uma linha menor fora dessa ordem.

O `git grep` no target confirmou que todos os consumidores atuais de `trackMediaUsage` foram adaptados: os hooks de Case/Profile e a retirada de Case. Não existe consumidor de produção remanescente usando o contrato antigo ou separando as duas transições.

## Preservação dos contratos

- Autenticação e exigência de `req.transactionID` continuam antes do acesso ao banco. Todas as consultas e CAS conservam a mesma `req` da operação editorial.
- Cada linha é relida em tentativa de CAS. O cálculo das transições parte dos usos dessa leitura, preservando usos de outros documentos/idiomas que tenham sido confirmados antes da nova tentativa. O CAS continua condicionado a ID, guardRevision, state e, para nova referência, ausência de deletedAt.
- Os tipos esperados são reunidos de todos os planos: o mesmo ID exigido como imagem e PDF não perde uma das exigências. Qualquer referência nova continua exigindo mídia pronta e disponível; uma linha antiga na lixeira pode ser modificada somente para retirar/reter seu uso, como antes.
- `changeMediaUsage` permanece inalterada. As transições por dono/idioma/revisão conservam sua ordem e semântica; apenas deixam de ser gravadas em duas operações separadas na mesma linha. Rascunho isolado não retira publicação anterior; publicar retém usos anteriores e elimina o uso draft ativo; retirada atua nos estados enviados; usos de outros donos e estados não enviados permanecem preservados.
- Não mudou a superfície de entrega/autorização de bytes, parser, armazenamento, formato permitido ou limite de produto. O fix não acrescenta serviço, fila ou tentativa de reutilizar uma transação abortada.

## Validade da regressão e evidências lidas

Foi lido integralmente o pacote restrito de 601 linhas, em três blocos sem truncamento. Os três arquivos de produção alterados e a nova seção do teste foram conferidos também por `git show` do target, além dos contratos/transição pura usados pelo lote. O diff imutável confirma exatamente quatro arquivos alterados sob `src`.

O novo teste cria documentos/arquivos reais pelo Payload, obtém leases válidos e chama update com `overrideAccess:false`. O spy encaminha o UPDATE original: a primeira barreira só sinaliza depois que a escrita real retorna; para a segunda transação, observa escrita concluída ou espera de lock real em `pg_stat_activity` no banco corrente antes de liberar a primeira. O pequeno polling verifica essa condição; não presume posse de lock apenas pelo tempo decorrido. As operações pendentes são aguardadas e a barreira liberada no finally antes de restaurar o spy.

As asserções finais exigem duas publicações concluídas, uso confirmed de cada dono em seu arquivo final, ausência de draft/confirmed desse dono no arquivo anterior e entrega pública autorizada do arquivo final. Isso verifica o resultado sem confundir um arquivo compartilhado ainda público com referência antiga do dono que deveria ter sido retirada.

Evidências fixadas inspecionadas:

| Artefato em `docs/verification/artifacts/E1.6/` | Resultado registrado e qualificação |
|---|---|
| `e1.6-review1-lock-order-red.txt` | Leitura integral: três falhas de regressão com PostgreSQL `40P01`, em case/case, profile/profile e case/profile; quatro testes existentes aprovados. A falha é comportamental, não de preparação. |
| `e1.6-review1-lock-order-green.txt` | Leitura integral: sete testes aprovados após o fix. |
| `review1-source-provenance.json` | Registra que a asserção contra usos antigos foi depois fortalecida para excluir draft e confirmed; o gate completo seguinte executa essa versão. Quatro hashes de fontes foram recalculados diretamente nos bytes Git do target e coincidiram com o manifesto. |
| `e1.6-review1-verify-current.txt` | Cabeçalho/resultado/build relidos em bloco limitado: typecheck, formatação, 350 testes/49 arquivos e build concluídos. Lint registra zero erros e quatro warnings de parâmetros não usados na migração gerada já existente; não é execução sem warnings nem regressão deste fix. |
| `e1.6-review1-e2e-current.txt` | Resultado registrado: 22 jornadas aprovadas; jornadas de mídia incluindo autorização, revogação, falhas reais e animação estão presentes. |

Uma busca inicial nos logs retornou saída truncada por incluir stacks; os resultados necessários foram relidos em blocos menores. Não é alegada auditoria integral dos logs completos de verify/E2E. Os resultados acima são de execuções reais registradas pelo autor e inspecionadas nesta revisão; não foram reexecutados pelo revisor. O CI antigo de 833bcd5 não foi usado como validação do novo target.

## Limitações e escopo

Revisão somente da correção do P2, da nova regressão e de efeitos introduzidos pelo fix. Nenhuma edição no app, teste novo, DB, serviço, build, migração, staging, push ou subagente foi executado. Foi escrito somente este relatório no workspace autorizado.

Não se declara ausência universal de deadlocks em qualquer futura composição de operações; o parecer cobre os consumidores editoriais atuais e a inversão entre estados apontada no P2. R2, imagem standalone/container, recursos de processamento, recuperação operacional e E1.8 mantêm as limitações/gates já registrados. CI exato e promoção protegida permanecem com o coordenador.

## Hashes das quatro fontes alteradas

SHA256 calculado nesta revisão com `git show 0fa495864cfefcf3489856d66444b81fdf1f730e:<path>` capturado como bytes, sem normalização de newline; comparação automática com o manifesto retornou sucesso para 4/4.

| Arquivo | Bytes | SHA256 |
|---|---:|---|
| `src/features/cases/content/hooks/case-media-usage.ts` | 2192 | `dd51502b8f2deb8fdee26490bc3543b2a0942e89c4d3ee95e5190f1b12444fb7` |
| `src/features/media-library/server/media-usage-races.integration.test.ts` | 15283 | `490371603f8f8a2d56919c8630a37ed409fe8d8f0cc785af9ff0ba89c45b6a9a` |
| `src/features/media-library/server/track-media-usage.ts` | 4077 | `f11751cb267815b7813867f72655448db6af43d8eeca24635749074c8c3d62f8` |
| `src/features/professional-profile/content/profile-media-usage.ts` | 1720 | `e35ba1bb84e52ae387253e5a73ed511c425b4394f8e22e0f340118bd32646fca` |
