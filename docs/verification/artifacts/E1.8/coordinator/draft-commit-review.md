# E1.8 — veracidade do Save Draft após falha real de COMMIT

30/10/2026. Etapa 1: **87,5%**. Seguimento estático estritamente delimitado ao save de draft e resultado transacional nativo. R1/R2 de publicação já tratados não foram reabertos. Nenhum banco, serviço, build, teste ou arquivo do aplicativo foi executado/modificado por este revisor.

## D1 — [P1] Save Draft ainda pode informar sucesso quando sua transação foi rejeitada

**Local de resposta:** `E:\a-design-for-life\src\helpers\payload\publication-transport.ts:38,45`.

**Condição concreta:** salvar documento versionado pelo fluxo nativo com `draft=true` e `_status=draft`, com sessão/lease/revisão válidos, e ocorrer falha de COMMIT que o adapter instalado absorve. Não é preciso mudar a lógica de publicação nem criar intenção pública. A resposta continua 200 com a mensagem nativa de rascunho salvo, embora versão e CAS desse save tenham sido revertidos.

Há dois caminhos atuais:

- Documento nunca publicado, sem `latestPublicationIntent`: o confirmador retorna a resposta nativa diretamente na linha 38, sem prova de persistência.
- Documento com intenção pública anterior: o draft mantém o operationId anterior, mas recebe nova revisão editorial. A operação anterior continua existindo; sua `targetRevision` difere da revisão retornada pelo draft e a linha 45 retorna a resposta nativa. A nova proteção de operação ausente da linha 44 não se aplica.

**Impacto e contrato:** a pessoa pode fechar o editor acreditando que o rascunho foi salvo e perder a edição. É falsidade sobre a gravação editorial, não um estado legítimo de “salvo, atualização pública pendente”. Afeta o Save Draft nativo do CMS/REST e a conclusão de operações Local que sejam donas da transação. A spec §8.2 exige “Não converter falha em sucesso”; a publicação parcial de §8.1 só se aplica quando o conteúdo realmente foi salvo. Não se observou ocorrência espontânea dessa falha em produção nesta revisão.

## Cadeia completa verificada no código

1. `src/helpers/payload/editorial-revision.ts:249–264` realiza CAS do head dentro do `req.transactionID`, gerando nova `editorialRevision`. O beforeChange propaga a nova revisão também para `contentRevision`; o afterRead autenticado devolve a revisão selecionada da versão (`:576–605`). Esses dados podem existir dentro da transação antes de seu desfecho.
2. Payload instalado, `collections/operations/utilities/update.js:40`, reconhece o draft explícito. No caminho draft, não substitui o corpo publicado (`:309`), mas salva versão com o mesmo `req` (`:324–336`). Isso não dispensa commit: versão nova e CAS são parte da transação editorial.
3. `publication-fields.ts:34` identifica essa gravação como privada; `:36` conserva o operationId do head anterior e `:41–43` sai sem enqueue. Este comportamento editorial está correto: salvar draft não deve gerar publicação apenas para produzir um recibo.
4. `collections/operations/updateByID.js:24` determina propriedade da transação. Quando a operação é dona, `:225–228` aguarda `commitTransaction(req)` e então devolve o `result` já construído. O helper nativo `utilities/commitTransaction.js` simplesmente aguarda `payload.db.commitTransaction` e remove `req.transactionID`.
5. No adapter `@payloadcms/drizzle@3.92.1`, `transactions/beginTransaction.js` cria `done = this.drizzle.transaction(...).catch(transactionFailed)`. Após `transactionReady` resolver a promise de inicialização, uma rejeição tardia chega ao `transactionFailed` dessa promise já resolvida; o catch não relança. `session.resolve()` retorna esse `done` tratado. Portanto o chamador pode observar resolução normal apesar da rejeição do COMMIT.
6. `transactions/commitTransaction.js` remove a sessão e aguarda `session.resolve`; seu catch chama `session.reject`, sem um resultado de commit independente. É insuficiente supor que uma resolução normal aqui prova o save. A caracterização real de COMMIT já existente no projeto confirma essa classe de comportamento para uma transação; esta revisão não executou sua variante de draft.
7. `collections/endpoints/updateByID.js:25–42` escolhe `version:draftSavedSuccessfully` quando draft e devolve status 200. A fachada `src/app/(payload)/api/[...slug]/route.ts:73,83` passa o resultado ao confirmador, que toma uma das duas saídas descritas acima.

Na composição lida (`src/payload.config.ts:72–79`), o banco usa `postgresAdapter` diretamente, sem guard geral do desfecho. A busca dirigida não encontrou função própria exportada `saveDraft`; o caminho real é a operação nativa e seus helpers. O wrapper transacional de `editorial-revision.ts:37–52` também confia na resolução de `db.commitTransaction`, quando ele é dono; não fornece por si só uma prova alternativa.

## Fronteira mínima recomendada para mitigação

**Preferir um guard de resultado transacional no adapter composto pelo aplicativo**, cobrindo os callers nativos REST/Local e wrappers que já usam esse adapter. O comportamento requerido é pequeno: depois do pedido de commit pelo dono, só resolver como sucesso se o settlement real da transação for bem-sucedido; rejeição/resultado ambíguo deve produzir erro seguro, sem alegação de save. Não transformar drafts em outbox e não adicionar collection.

Mas essa recomendação **não** equivale a apenas `try { await nativeCommit(id) } catch { ... }`: a rejeição pode ter desaparecido antes de `nativeCommit` terminar. Tampouco observar apenas se `session.reject` foi chamado resolve, pois `session.resolve` pode receber a promise `done` já convertida em resolução normal pelo catch de beginTransaction.

A costura precisa observar o settlement bruto da transação **antes** desse catch, associá-lo à identidade correta da sessão e preservá-lo até o owner commitar/abortar. Isso pode ser realizado em um adaptador de compatibilidade do aplicativo em torno do adapter instalado, mantendo Payload/Drizzle nativos como único acesso aos dados. A implementação concreta dessa observação não foi desenvolvida nem validada nesta leitura; exige teste com transações concorrentes e com inicialização/rollback, sem misturar resultados de duas sessões. Não editar `node_modules`, instalar outro ORM, substituir autenticação nem fazer SQL de conteúdo por um caminho paralelo.

Esse limite é mais concentrado que acrescentar provas por tipo em cada handler, porque o defeito está no desfecho comum da transação. A alternativa de leitura independente por **revisão/versão exata** pode proteger o HTTP como defesa adicional, mas exige cobrir drafts novos, drafts sobre publicado, operações não versionadas e Local; verificar apenas o head mais recente pode gerar falso negativo se outra gravação legítima já avançou o head. Verificar apenas a existência da intenção pública antiga não prova o novo draft.

**Propriedade transacional permanece nativa:** `initTransaction.js` retorna false quando o request já tem transação externa. Uma chamada Local dentro dela continua devolvendo resultado provisório ao caller; não deve fazer commit antecipado nem ser convertida em save confirmado. O guard tem que refletir a falha no commit efetivamente feito pelo dono externo. Não promover FS como efeito dessa verificação de draft.

## Prova real sugerida — ainda não executada

Usar o PostgreSQL isolado e o executor principal já existentes. Aplicar fault injection **no banco e na fronteira COMMIT**, não um mock que faz o handler lançar antes de gravar.

Uma opção determinística é um constraint trigger temporário, `DEFERRABLE INITIALLY DEFERRED`, na tabela de versões nativa `_case_content_v`, limitado ao documento/revisão da fixture, que rejeite a transação somente no commit. Ele fica apenas no banco isolado do teste e é removido em finally. Outra opção é adaptar a técnica real de UNIQUE diferida existente para a versão da fixture. Esse mecanismo injeta uma falha real de PostgreSQL para caracterizar a fronteira; não afirma que a produção contém a constraint artificial.

Executar dois casos com **auth real e lease/revisão atuais**, no save nativo que é dono da transação:

1. Draft de conteúdo nunca publicado, sem operationId anterior.
2. Draft novo sobre conteúdo previamente publicado/confirmado, conservando operationId anterior e gerando revisão nova.

Asserções: o save não retorna HTTP 2xx nem mensagem de sucesso; erro seguro orienta recarregar; leitura independente confirma que a nova versão não foi commitada e que o head/último draft anterior permanece; nenhuma nova outbox foi criada; conteúdo público e referências continuam os anteriores. Um controle sem a falha confirma save de draft normal. Para Local com transação externa, verificar separadamente que o retorno antes do commit é provisório e que o commit externo rejeita de modo observável, sem publicação antecipada.

O RED precisa mostrar a resposta falsa atual no transporte real, e o GREEN deve cobrir o guard realmente instalado na composição. Um teste que apenas chama a API com sessão inválida, ou que só verifica `retryPublicationUpdate`, não percorre D1.

## Snapshot e limites

Raiz do aplicativo: `E:\a-design-for-life`. SHA-256 dos arquivos lidos:

| Arquivo | Hash |
|---|---|
| `src/helpers/payload/publication-transport.ts` | `A99EBB122919962F82F2208F9899C84E1317F444995B97DE59B128A1C7A3633C` |
| `src/helpers/payload/publication-fields.ts` | `C83BD44ABBAF20FD82D9CE887AA07D891D0B7BA4C60B794A6D860148C589FBCC` |
| `src/helpers/payload/editorial-revision.ts` | `CD263CE0AC1E47159447B4A9F2BF5B66391EE3A419A21417467A7749704AD1F8` |
| `src/payload.config.ts` | `788AA8BECE19B6CCB52DCAAFB2B7BE4A55865D6E7F48999581B714D824A4F3F3` |
| `src/app/(payload)/api/[...slug]/route.ts` | `8610F0FC9FE74992B677552E8363FECF77A937FE8712E38611ECBF65187874D2` |
| Drizzle 3.92.1 `dist/transactions/beginTransaction.js` | `19C7EFA7721A08DB4343512386ECB7B3A90B17B98B369CBE458313976D6C1763` |
| Drizzle 3.92.1 `dist/transactions/commitTransaction.js` | `BAE2D14DE0F2D4D21793D2A5AE916C97C87E9F01ADC4C9B20C234EC6C56158B2` |

Pacote Drizzle lido em `node_modules/.pnpm/@payloadcms+drizzle@3.92.1__7198a0185fe1e6d263e2eb02da9ec726/node_modules/@payloadcms/drizzle`. WIP pode mudar depois desses hashes. Conclusão é estática e condicionada à falha real de COMMIT conhecida; não há RED/GREEN independente de draft nem alegação de incidência dessa falha no uso comum.
