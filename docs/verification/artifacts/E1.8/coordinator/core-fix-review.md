# E1.8 — conferência delimitada das correções R1/R2

30/10/2026. Etapa 1: **87,5%**. Código WIP; esta conferência não é gate final. Somente leitura do aplicativo/adaptador e escrita deste relatório. Nenhum SQL, serviço, build, teste ou alteração no aplicativo executado pelo revisor.

**Resultado estático no snapshot final abaixo: R1 ADDRESSED; R2 ADDRESSED.** Não encontrei achado remanescente concreto dentro dessas duas correções. Isso não equivale a GREEN independente: a evidência runtime pertence ao executor principal e não foi repetida aqui.

## R1 — operação ausente após COMMIT perdido

`src/helpers/payload/publication-transport.ts:44` agora retorna **503**, com mensagem segura “Não foi possível confirmar a gravação. Recarregue o documento antes de tentar novamente.”, quando a leitura independente não encontra a operação. Não devolve doc/recibo ou mensagem de conteúdo salvo nessa condição.

O caso de revisão diferente está separado na linha 45 e preserva a resposta nativa. Assim, um draft legítimo que conserva operationId de publicação anterior não é confundido automaticamente com COMMIT perdido. O caminho auditado pressupõe autenticação real bem-sucedida, como na operação nativa; uma fixture sem sessão válida toma o retorno anterior da linha 41 e não testa R1.

O teste de autenticação real/COMMIT perdido continua sob responsabilidade do principal. Não afirmo que essa prova passou apenas por ter encontrado o ramo 503 correto no código.

## R2 — persistir propriedade da raiz antes de superseder a operação

No coordenador final, o ramo `!head` não promove conteúdo nem marca a intenção nova como pública:

1. `publication-coordinator.ts:44–47` lê e bloqueia o **head atual** por CAS do mesmo `latestPublicationIntent`. O CAS antigo malsucedido, isoladamente, não bloquearia esse head. Se a intenção mudou entre leitura e CAS, a reconciliação aborta em pendência.
2. Linhas 49–56 recuperam a operação correspondente à raiz confirmada e chamam reconciliação com `retirePending:false`.
3. Só depois a linha 58 marca a operação antiga `superseded`, na mesma transação. `publicConfirmed` aparece apenas no outro ramo (linha 71); a reconciliação antiga não confirma B nem troca seu token de intenção, sua revisão editorial ou seu lease.
4. `case-publication.ts:19–22` confirma os usos da raiz e materializa `everPublished` das rotas. `case-routes.ts:209–210` grava a propriedade histórica antes de remover o pin administrativo por supersessão. Uma falha reverte essas gravações SQL juntas, mantendo a proteção pendente anterior.
5. A composição encaminha a opção sem descartá-la (`src/config/publication.ts:10`). Os adapters de Case e Perfil passam `options.retirePending` para `reconcilePending`. Com `false`, `changeMediaUsage` não rebaixa usos pending; pins da intenção B e demais revisões pendentes permanecem, inclusive quando compartilham mídia com A.

O fence do head atual também serializa a limpeza técnica de reservas privadas em `acknowledgeCaseRoutes:211–212` com Native draft/publish/delete. Essa limpeza usa `payload.db.deleteOne`, portanto não ganha o guard nativo automaticamente. Ler o draft e remover reservas elegíveis sob o mesmo head evita apagar uma reserva que um draft concorrente acabou de selecionar.

## Corrida específica solicitada: leitura antiga de everPublished e leitura nova de pins

A cadeia curta proposta **não era prova suficiente de exclusão indevida**, mesmo antes do novo fence. `synchronizeCaseRoutes:152–161` e `protectContentRouteDeletion:184–195` chamam **`payload.delete`**, e `protectRouteDelete:50–66` relê a rota por `findByID` antes de autorizar. Na implementação nativa instalada, `deleteByID.js:68–75` executa os hooks beforeDelete antes de chamar o adapter.

Assim, se o guard exterior leu `everPublished=false`, mas só observou a ausência do pin depois do commit da reconciliação, o guard interno lê a rota já com `everPublished=true` e bloqueia. Não foi relatado esse interleaving incompleto como bug. Um guard isolado que somente relê não substitui serialização universal, mas o **novo CAS do head atual** fecha a concorrência inteira entre esses caminhos nativos e a reconciliação no snapshot final.

O novo CAS não altera `editorialRevision`, `contentRevision`, `leaseToken`, `leaseOwner` ou expiração. Native D que já detenha o head termina antes da reconciliação; se a intenção continuou igual, esta passa a ler seu draft commitado; se mudou, o CAS falha. Se a reconciliação detiver o head primeiro, Native D espera e lê a propriedade persistida depois. O lock global do escritor permanece externo a esse trecho.

## Mudança de snapshot durante a leitura

A primeira leitura encontrou coordenador `ED6A03991FD0A6103D9657D89C396368585E457907DB585A6C95580AE098E06D`, com reconciliação da raiz antes da supersessão, ainda sem fence do head atual. Durante a conferência, o principal acrescentou esse fence. O resultado ADDRESSED acima se refere **somente** ao coordenador final `A6E1...`, lido novamente com linhas e hash, e não declara a versão inicial equivalente.

## Hashes finais conferidos

Raiz: `E:\a-design-for-life`; SHA-256.

| Arquivo | Hash |
|---|---|
| `src/helpers/payload/publication-coordinator.ts` | `A6E1CDDA5C2B666AED95F511BD0B8B55889B7212F117AA19526BC56D4CAB08EC` |
| `src/helpers/payload/publication-transport.ts` | `A99EBB122919962F82F2208F9899C84E1317F444995B97DE59B128A1C7A3633C` |
| `src/features/cases/server/case-publication.ts` | `8D07CE0EB7927B6890BB8A35F36B5CB8AA103085F7D32BD334A14295BBC2279A` |
| `src/features/cases/content/hooks/case-routes.ts` | `D4B2D496968972B37381A31AAEE84BB4C4911A7464C0802514057AF3565B8B40` |
| `src/features/media-library/server/change-media-usage.ts` | `535AEF4AA6EC1166714A95370BFCB5EB2FBDA0A9673A8B241D148552DEAC24EA` |
| `src/features/media-library/server/track-media-usage.ts` | `EA6DCAD15952376D311A5BC0505403F4EF8A08BCED2415A0A7053D7FE2FD8E8C` |
| `src/features/professional-profile/server/profile-publication.ts` | `36080F6051AB24B4ED2A13C0320DF6339C02D81EE57ADEF21A09B3109791A57D` |
| `src/config/publication.ts` | `1E509E955C05025E38EE57F97ED73A9A807A1CBC3A3D0FE52CFF46DC249D870D` |

Limites: revisão apenas R1/R2 e efeitos imediatos das correções. Não valida ausência universal de corridas, falha de conexão depois do fence, durabilidade física, todos os transportes/controles de autenticação, ou completude E1.8. Nenhum teste existente ou relatado pelo principal foi representado como execução deste revisor.
