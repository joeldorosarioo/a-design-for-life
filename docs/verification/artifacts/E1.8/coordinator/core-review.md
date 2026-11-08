# E1.8 — pré-revisão estática delimitada do núcleo WIP

30/10/2026. Etapa 1: **87,5%**; E1.8 em execução, A1 pendente. Revisão somente leitura, sem alterar o aplicativo, executar banco/serviços/build/testes ou interferir no executor principal. Os achados descrevem os hashes abaixo; não constituem revisão final da tarefa nem avaliação de completude de getters, agregados, legado, reinício ou E2E ainda em desenvolvimento.

## Achados acionáveis

### R1 — [P1] Transporte mantém sucesso nativo quando o commit editorial perdeu a operação

**Local:** `E:\a-design-for-life\src\helpers\payload\publication-transport.ts:44` (contexto: linhas 34–50).

`confirmNativePublication` relê a outbox por request independente, mas executa `if (!operation || operation.targetRevision !== document.editorialRevision) return response`. No caso já caracterizado de COMMIT PostgreSQL rejeitado com resolução normal do adapter instalado, o documento devolvido pelo Payload conserva o novo `latestPublicationIntent`, mas a operação e o conteúdo não foram persistidos. A leitura independente retorna `null` e o transporte devolve exatamente a resposta nativa bem-sucedida. Não chega a `retryPublicationUpdate` nem a um erro 503.

É um falso **salvo**, não apenas ausência de confirmação pública. O createHandler instalado devolve 201 com `successfullyCreated`, e updateByIDHandler devolve 200 com `updatedSuccessfully`/`draftSavedSuccessfully` depois da operação nativa. A fachada do aplicativo encaminha esses resultados ao confirmador em `src/app/(payload)/api/[...slug]/route.ts:45,73,83`. Consequentemente, a falha editorial pode aparecer como sucesso no CMS apesar da ausência de conteúdo/outbox commitados.

**Evidência de alcançabilidade:** `publication-fields.ts:35–37` atribui o operationId ao próprio `doc` em afterChange. No Payload instalado, afterRead precede afterChange, e commit vem depois de ambos (`collections/operations/create.js:359–421`; `utilities/update.js:357–387` e `updateByID.js:215–226`). Portanto o marcador não desaparece por afterRead antes da resposta nativa. O teste existente `publication-updates.integration.test.ts:109–130` provoca falha real com UNIQUE diferida, observa ausência do registro e `retryPublicationUpdate(...).ok=false`, mas não verifica o transporte.

**Correção mínima esperada:** separar ausência da operação de revisão não correspondente. Quando uma resposta de publicação aponta para uma operação que não existe após leitura independente, retornar erro seguro não-2xx (503 proposto), sem “salvo”, sem recibo público e sem converter isso em “salvo, atualização pendente”. Divergência de revisão pode corresponder a um save de draft que conserva uma intenção antiga; precisa de seu tratamento próprio, não ser agrupada com operação ausente.

**RED real mínimo:** estender a caracterização existente para passar o documento nativo devolvido após COMMIT perdido por `confirmNativePublication`, com autenticação/runtime reais da fixture, verificando erro HTTP e ausência de alegação de save. Na jornada REST, provocar a mesma rejeição diferida na transação da requisição e observar o resultado real POST/PATCH; a falha deve ocorrer no COMMIT editorial, não num mock de `retry` nem somente no ack posterior. Manter um controle de draft salvo normalmente para não transformá-lo em erro por carregar intenção anterior.

### R2 — [P1] Supersessão de operação antiga remove o único pin de uma rota já confirmada sem ack

**Local primário:** `E:\a-design-for-life\src\helpers\payload\publication-coordinator.ts:40–41`.

**Consumidores que tornam a falha alcançável:** `src/features/cases/content/hooks/case-routes.ts:152–161,167–170,200–202`. A proteção transitória de uma rota é derivada exclusivamente de operações `state=update-pending` cujo target contém aquele slug. No ramo de CAS que não encontrou o head com a intenção antiga, o coordenador marca a operação `superseded` e commita sem reconciliar a raiz pública corrente. Esse ramo não distingue uma tentativa nunca aplicada de uma que promoveu FS mas perdeu o ack SQL.

Sequência suficiente, usando os mecanismos já implementados:

1. Publicar A no slug `a`; promover a raiz FS e rejeitar o ack SQL, como no teste atual de CHECK de estado. A raiz entrega A, `everPublished` continua falso e a operação A pendente sustenta o pin da reserva.
2. Salvar nova intenção B de retirada (`draft:false`, `_status:draft`); seu target tem `slug:null`. Não confirmar B ainda. A deve continuar pública.
3. Retentar A. Seu CAS falha porque o head aponta B; a linha A vira `superseded`. `pendingRouteSlugs` agora não retorna `a`: A foi excluída pelo estado e B não tem slug.
4. Salvar draft com outro slug: `synchronizeCaseRoutes` pode apagar a reserva `a`, embora a raiz ainda publique A. Outro case pode então reservar o endereço. Alternativamente, o guard de delete físico deixa passar porque não há `everPublished` nem pending slug; a raiz perde seu dono editorial recuperável sem ter confirmado a retirada.

O guard de delete testa explicitamente **`pendingRouteSlugs(...).size > 0`**, não a existência de qualquer intenção pendente. B não conserva a rota antiga em outro campo consumido por esse guard: `case-publication.ts:26` prepara retirada com `slug:null`, `detail:null`, `media:[]`, sem `slugs`; `slugs` só é recomposto a partir da raiz no `apply` de B, linhas 28–33, quando B chegar à promoção. `pendingRouteSlugs` examina apenas `operation.target.slug`. Assim, a simples presença de B pendente não fecha a cadeia estática.

Uma variação com B publicado pendente no slug `b` também permite liberar `a` numa edição posterior: apenas `b` continua pinado. Uma futura confirmação de B herda `a` em `slugs` a partir da raiz, mas `acknowledgeCaseRoutes` somente percorre reservas que ainda existem; não recupera automaticamente a propriedade da reserva já liberada/ocupada.

**Correção mínima esperada:** não retirar o pin de A somente por ter sido superada no head. Sob escritor global e fence do head apropriado, reconciliar a proteção da raiz confirmada/histórico antes de efetivar a supersessão, ou manter um pin independente do estado administrativo até essa reconciliação. Não promover A novamente, não alterar leases/revisão do editor e não atualizar a intenção B por conveniência. Preservar a possibilidade de liberar/excluir conteúdo que comprovadamente nunca foi público; não corrigir proibindo exclusão de qualquer draft com outbox histórica.

**RED real mínimo:** ampliar a prova atual de ack rejeitado: depois do root commit sem ack, salvar retirada B, executar retry A, tentar draft/rename, reserva do slug por outro case e delete físico. A deve continuar publicamente disponível até B confirmar, a reserva deve continuar pertencendo ao dono e delete deve ser bloqueado. Após confirmar B, testar 410/histórico reservado. Controle separado: A nunca promoveu FS, foi supersedida com segurança, e após reconciliação o draft nunca público continua elegível à liberação/exclusão.

**Efeito associado a verificar no mesmo controle:** `retainDeletedCaseMedia` limpa somente usos `draft` (`case-media-usage.ts:49–68`). Se o caminho de delete ficar permitido para conteúdo nunca público com uma intenção antiga já supersedida, seus pins `pending` não podem ficar órfãos para sempre. Esta nota não contabiliza isso como achado separado nem afirma execução dessa variante; a limpeza deve fazer parte da reconciliação segura do cenário de controle.

## Observações delimitadas sem novo achado

- O ramo normal possui leitura independente da operação, escritor global, CAS final no mesmo head e guard que exige sessão real do adapter. A composição em `src/config/publication.ts:10–13` faz merge sobre a raiz recebida dentro do escritor; não publica uma cópia pré-calculada de G0 para cases distintos.
- `public-root.ts` escreve arquivo temporário, sincroniza o arquivo e troca `current.json` por rename; Linux sincroniza também diretório. O código distingue limitação de durabilidade por falta de fsync de diretório no Windows. Não foi verificada empiricamente a exclusão do named pipe/socket ou a durabilidade do volume.
- `publication-fields.ts:8–11` acrescenta `publicConfirmed=true` ao filtro de acesso anônimo, antes de query/count, e preserva a condição original `_status=published`. Não encontrei nesse trecho um mascaramento apenas em afterRead que permitisse contar targets pendentes.
- O hook afterChange escreve explicitamente `doc.latestPublicationIntent` e `doc.publicConfirmed=false` depois do afterRead nativo. Os campos persistidos são preservados a partir do head real em beforeChange, não da cópia histórica. Esses detalhes evitam a perda óbvia do recibo por ordem dos hooks, mas não corrigem R1.
- Pins de mídia `pending` agora se acumulam por revisão; são reconciliados no ramo de confirmação sob o head, evitando o rebaixamento antecipado apontado no parecer de protocolo. A autorização pública lê a raiz confirmada, não esses pins SQL. R2 está na remoção do pin de **rota por estado da outbox**.
- Leases, revisão editorial e controles de autorização foram apenas lidos; nenhuma recomendação requer substituí-los. Não foram julgadas como bugs tarefas de completude explicitamente em andamento.

## Snapshot examinado — SHA-256

Raiz de todos os caminhos: `E:\a-design-for-life`. Os quatro arquivos diretamente ligados aos achados (transport/coordinator/fields/case-routes) tiveram hashes capturados durante a leitura numerada; os dois primeiros coincidiram com a leitura inicial. WIP pode avançar depois deste parecer.

| Arquivo | SHA-256 |
|---|---|
| `src/helpers/payload/publication-transport.ts` | `1275891EACBD75A4A5C80D29586EA447A31C83778BC90F23C8F3545C3D90C644` |
| `src/helpers/payload/publication-coordinator.ts` | `00DC69ABACD81645303C528AC205DF9075DE554F6763A9EA217A5021CA8A57B6` |
| `src/helpers/payload/publication-updates.ts` | `4128219A1460F8077A40E50F9B6B9D55B20D4F72C3AB493851CA5E96622BEA19` |
| `src/helpers/payload/publication-runtime.ts` | `77E1117B98A47D527BDD64A27747E47321F8EC398B78E53C1B014E5FC30787B7` |
| `src/helpers/payload/publication-validation.ts` | `9B7DDDEA68B0BF4F4C1BE12A23980FF18D1F212CF95C774E80F820C0F1EF70DA` |
| `src/helpers/payload/publication-writer.ts` | `D880C02365BB58E98E0DA6A474449A917C47F95554B011792D5F254DCB582AD0` |
| `src/helpers/payload/public-root.ts` | `5EA81E9E8E7B995513FC2E9A057B5DDEDDB4C11BA72AC4F3F3A5D8AEDDF17EB9` |
| `src/helpers/payload/publication-fields.ts` | `BE491FC89820B6EA3591A835CDA7834E1B73011C0931DA10A9689CC21EBC8E70` |
| `src/helpers/payload/publication-updates.collection.ts` | `F0DAA94395D4C7F9263442A2F4C4D55D9FDDD464A41170F33D24DD96F81D6693` |
| `src/features/cases/content/hooks/case-routes.ts` | `D4B2D496968972B37381A31AAEE84BB4C4911A7464C0802514057AF3565B8B40` |
| `src/features/cases/content/hooks/case-media-usage.ts` | `1772FCEF37477980887A2DC88ED2EF78B41C8444E9D91D1F01406DE4E6D0F823` |
| `src/features/cases/server/case-publication.ts` | `0035BDD8FE8760D8B1563E8ABF4273E2B5498D6FFE495E5BA4C19D993FE98F14` |
| `src/features/media-library/server/change-media-usage.ts` | `535AEF4AA6EC1166714A95370BFCB5EB2FBDA0A9673A8B241D148552DEAC24EA` |
| `src/config/publication.ts` | `E5FFF2B5EAADC885438356FC38D766F44C162FB5DD9803897CEC7E300B9B7FB4` |
| `src/helpers/payload/publication-updates.integration.test.ts` | `07007B91E63A5E761873060F42B99BCC70B864653ACD86A4E8800D0C4F318726` |
| `src/app/(payload)/api/[...slug]/route.ts` | `8610F0FC9FE74992B677552E8363FECF77A937FE8712E38611ECBF65187874D2` |

**Executado nesta pré-revisão:** leituras de código instalado/aplicativo e hashes; escrita deste relatório no chatwork. **Não executado:** nenhum teste de reprodução, SQL, serviço, build, pnpm, browser ou mudança no aplicativo. Os testes existentes foram lidos, sem reapresentar seus resultados como verificação independente. R1/R2 são conclusões estáticas com caminhos de execução específicos; a implementação deve provar RED/GREEN nos recursos isolados já controlados pelo executor principal.
