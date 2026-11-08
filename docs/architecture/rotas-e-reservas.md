# Rotas e reservas por idioma

Etapa 1 em 62,5% (E1.1–E1.5 concluídas); E1.5 verificada e revisada. Fonte: P03/P17 da spec e “Registro de endereços” do contrato CMS. Este documento descreve o domínio e a superfície HTTP mínima da etapa 1; não é o layout público da etapa 2.

## Formação e escolha explícita

`suggestSlug(title)` é determinística: NFKD, remoção de diacríticos, minúsculas, separadores em hífens, corte em 80 caracteres e remoção do hífen final. A sugestão não consulta reservas e não acrescenta números para decidir conflitos. Uma entrada sem caracteres convertíveis pode sugerir vazio.

Um slug fornecido deve obedecer a `^[a-z0-9-]+$`, com 1–80 caracteres. Não há normalização silenciosa na gravação. Hífens consecutivos ou nas extremidades são permitidos pelo formato aprovado. Vazio/nulo/ausente representa rascunho incompleto, não uma reserva; publicar exige slug válido. A validação de entrada protege também rascunhos.

O campo nativo continua editável. O botão “Sugerir a partir do título” somente altera o campo ao ser acionado; a reserva ocorre ao salvar. Editar o título não executa sugestão nem reserva. O helper puro compartilhado fica na própria feature, sem importação cliente de `server/`.

Não há palavras reservadas adicionais: `/pt/cases/[slug]` e `/en/cases/[slug]` não colidem com `/admin` ou `/api`, e a listagem está no nível anterior. Uma futura rota estática dentro desse segmento exige revisão de colisão concreta.

## Propriedade e transação

`case-routes` é o único registro de endereço: idioma, slug, case proprietário, documento editorial, `everPublished` e estado editorial. O índice único nativo `locale_slug_idx` em `(locale, slug)` foi criado pela migração `20261030_024640_route_locale_slug_uniqueness`; não há uma segunda tabela de reservas. E1.5 não altera o schema físico nem necessita de migração vazia. As nove migrações existentes são aplicadas pelo harness real.

O hook `afterChange` do conteúdo executa antes do commit nativo e recebe o mesmo `PayloadRequest`/transactionID do conteúdo e do CAS. Consulta anterior fornece erro editorial cedo; o índice decide a corrida com outro case. O teste de transação não confirmada observa o INSERT concorrente bloqueado no PostgreSQL antes de confirmar o vencedor. O perdedor recebe `slug-conflict`/409, sem sufixo, e reverte conteúdo, revisão, versão e rotas.

A collection oculta nega CRUD pela API. Hooks também negam operações Local API com `overrideAccess: true`, inclusive alterações de proprietário/idioma/slug, regressão de `everPublished` e exclusão histórica. Somente o lifecycle abre uma capacidade privada em WeakMap, limitada ao request, transação, case, documento e idioma. Strings de `context`, parâmetros REST e flags de override não produzem essa capacidade. O adapter é utilizado diretamente apenas na fixture isolada que demonstra o índice físico, não por um endpoint administrativo.

`reserveCaseRoute({caseId, contentId, locale, slug}, req)` verifica identidade e salva explicitamente um rascunho. Revisão observada e lease vêm dos headers do chamador; a leitura do documento para conferir identidade não fornece uma revisão ou lease novos para autorizar conteúdo antigo. Os resultados de domínio ficam na feature; a enumeração de falhas técnicas genéricas não recebe `slug-conflict`.

## Ordem dos locks

Escritas editoriais exigem transação ativa. Para update, o CAS existente foi antecipado para `beforeOperation`, depois da validação de entrada e antes do native `checkDocumentLockStatus`. Esse código nativo remove o espelho de lock antes de `beforeChange`; manter o CAS somente nesse último hook causava uma inversão real com delete.

A confirmação transitória fica em WeakMap, vinculada a collection/id/transactionID, e é consumida uma vez em `beforeChange`. Leituras não a apagam; outra operação de escrita não pode reutilizá-la. A precedência da revisão explícita e do lease continua a mesma. Restore usa a revisão explicitamente fornecida pelo comando e cria rascunho pelo restore oficial; seu caminho nativo não executa a remoção antecipada do espelho.

Delete reivindica a revisão antes dos hooks da feature. A ordem é cabeça editorial → espelho nativo/recursos da feature, sem obter a cabeça depois de já bloquear uma rota ou espelho. Dois testes com barreiras reais reproduziram `40P01` antes da correção; o caso corrigido termina com delete confirmado e save obsoleto rejeitado como `stale-revision`, sem loop de retry.

## Transições

| Operação                                 | Reserva nunca pública                             | Endereço atual/histórico                                                 |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Criar/salvar rascunho sem slug           | Nenhuma                                           | Preserva o que já era público                                            |
| Aceitar slug válido livre                | Reserva para o documento/idioma                   | Não altera publicação                                                    |
| Trocar/limpar slug de rascunho           | Libera somente as reservas antigas nunca públicas | Preserva todos os endereços já públicos                                  |
| Preparar novo slug de case publicado     | Reserva o novo como privado                       | Mantém a URL atual e seu conteúdo público                                |
| Publicar novo slug                       | Promove o selecionado e marca `everPublished`     | O anterior torna-se histórico e permanece propriedade do case            |
| Voltar ao próprio histórico              | Permitido no rascunho, sem mudar publicação       | A publicação explícita torna-o atual e reorganiza os estados, sem cadeia |
| Restaurar versão antiga                  | Reserva o slug recuperado ou rejeita conflito     | Nunca muda a URL pública implicitamente                                  |
| Retirar publicação                       | Reservas já públicas permanecem                   | Resolve esses endereços como 410                                         |
| Excluir conteúdo nunca público           | Libera suas reservas no mesmo transactionID       | Sem histórico para perder                                                |
| Excluir conteúdo com endereço já público | Rejeita 409 e orienta retirar publicação          | Preserva a atribuição necessária para 308/410                            |

A promoção usa `doc._status` efetivamente salvo. Native create com `draft:true` permanece rascunho; native update com `draft:true` e `_status:'published'` efetivamente publica. Não há autorização por uma flag de draft presumida.

## Leitura pública coerente

`resolveCaseRoute(locale, slug)` sempre consulta idioma explícito e conteúdo com `draft:false`, `_status:'published'`, acesso público e seleção mínima. O registro privado é consultado privilegiadamente somente para classificar propriedade; seus metadados nunca são retornados.

A decisão de URL atual vem do único snapshot de conteúdo publicado, não do `route.state` lido anteriormente. Se uma publicação confirmar entre a consulta do registro e a do conteúdo, um antigo atual vira 308 diretamente ao slug confirmado; uma reserva privada que acabou de tornar-se atual vira 200. As duas interleavings usam hooks reais de leitura e publicação real, sem mock de consultas.

| Resolução                                                  | HTTP | Representação                                                              |
| ---------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| Slug do snapshot publicado                                 | 200  | Título/resumo públicos mínimos                                             |
| Endereço histórico do proprietário com publicação atual    | 308  | `Location` direto ao atual no mesmo idioma                                 |
| Inexistente ou somente reservado em rascunho               | 404  | Corpo e headers de classificação indistinguíveis                           |
| Já foi público e o conteúdo foi retirado                   | 410  | “Case indisponível”/“Case unavailable”, links de projetos/contato, noindex |
| Consulta de origem falhou, sem cache confirmado utilizável | 503  | Indisponível seguro, noindex e Retry-After: 60                             |

Históricos não armazenam destino para outro histórico: cada resolução usa o slug atual do proprietário. O mesmo slug em outro idioma tem registro independente. Falhas de consulta não são convertidas em ausência. Somente um identificador de correlação é registrado no catch público, sem URL do banco, rascunho ou credencial.

## HTTP mínimo e limites de cache

A Route Handler dinâmica em `/[locale]/cases/[slug]` retorna o status e HTML simples diretamente. 410/503 têm meta e `X-Robots-Tag: noindex, nofollow`, além dos links localizados de listagem e contato. GET e HEAD são reais. Headers de classificação enviados pelo visitante são ignorados; não existe seletor público que force estado.

Todas essas representações e os 308 usam `Cache-Control: no-store, max-age=0` nesta etapa. Um 308 antigo A→B não pode ficar armazenado quando o usuário publica novamente A e B passa a apontar a A. A jornada Chromium usa o mesmo contexto, sem desabilitar cache, e mede ambas as direções reais. Os handlers não emitem ETag: condicionais If-None-Match/If-Modified-Since não transformam 410/503 em 304.

O `withPayload` já emite Critical-CH/Accept-CH. Chromium pode expor sua negociação como 307 “Internal Redirect” para o mesmo URL antes do primeiro 308 do servidor. A evidência mantém os headers e distingue somente o par comprovado, sem ocultar redirecionamentos HTTP da aplicação.

`instrumentation.register` instala o factory de Payload no processo Node. O factory fica em `globalThis[Symbol.for(...)]` porque Turbopack cria grafos independentes para instrumentation, admin e Route Handler. Uma variável local ao módulo falhou no primeiro request público e só funcionou depois de abrir o admin. Somente o factory é compartilhado; não há conteúdo, usuário, request ou cache global. Nova composição/HMR substitui o factory. O harness testa o primeiro HTTP do processo novo no endereço desconhecido, antes do admin.

E1.8 ainda coordena cache público persistente, confirmação de propagação e retry editorial. Esta superfície intencionalmente não afirma preservação de conteúdo em cache durante falha, prazo de publicação distribuída, CDN ou tolerância à queda do processo/VPS. O teste503 interrompe realmente a relação consultada no PostgreSQL isolado por rename reversível em `finally`; não simula Payload/Postgres nem comprova falha de rede/processo.

A etapa 2 deverá integrar a resolução a App Pages, layout completo, links/prefetch/Flight, metadados e cache aprovados. A fixture anterior de Page/Proxy não substitui essa futura prova; o handler desta etapa não utiliza streaming/RSC e não representa a interface final do portfólio.
