# E2 — transporte público entregue

30/10/2026. **Etapa2:16,7% (1/6)**. Entrega delimitada para composição do coordenador, sem declarar Page/HTTP/E2E/A2 prontos. Fonte congelada em `E2-public-request-transport-frozen/`; `sha256.json` contém hashes dos12 arquivos e a cópia foi conferida contra a fonte atual.

## API para Pages

`src/config/public-render-context.ts` exporta:

```ts
PUBLIC_RENDER_CONTEXT_HEADER = 'x-portfolio-render-context';
readPublicRenderContext(headers, {publicationDirectory, secret}, expected?:{pathname,method?})
// Promise<{context:{v:1,method:'GET'|'HEAD',pathname,locale,status,pin},root:PublicRoot|null}>
```

O root cria uma função module-level React.cache no-args para Page e metadata/not-found. O leitor valida HMAC/schema/vinculação e lê só o pin recebido: nunca seleciona current, não faz fallback nem cache global. A assinatura usa domínio `portfolio-public-render-context-v1`, segredo existente, token limitado a2048 caracteres e sem corpus. Headers próprios e overrides correspondentes vindos do visitante são removidos antes do novo contexto. RSC/router e autenticação de imagem permanecem separados.

`preparePublicRenderRequest` seleciona current uma vez, usa APIs públicas com raiz explícita e pin on read. Home/list/About200 exigem composição e resolveNavigation válidos. Detalhe200 exige somente getPublishedCase da mesma raiz: A1 permite publicar case sem perfil/nav. Sua shell completa é opcional e a Page futura precisa tratar ausência/invalidade estrutural com a apresentação técnica autorizada. caseLinkLabel legado não foi tornado requisito200: o root omite apenas CTA ausente, mantendo título/link.

### Negativos de detalhe — decisão posterior ao plano

404/410/503 de detalhe retornam `{status,caseStateLocale}` antes de pin/assinatura. O Proxy chama o renderer puro existente reexportado por cases/server.ts, sem resolver novamente. HEAD remove somente o corpo. Não há token/slug serializado na representação;404/410/503 têm os mesmos headers A1, sem ETag, e503 conserva Retry-After60.410 continua410 mesmo com armazenamento de pin bloqueado.308 permanece resposta direta relativa/no-store. Home/list/About negativos continuam Next.next com contexto para estado de Page.

Essa exceção preserva o contrato A1 de HTML/classificação indistinguíveis para desconhecido/privado; o probe RSC anterior serializava segmentos da URL. Não se afirma que o estado técnico direto represente o aceite visual A2. O root poderá depois compor mensagens/nav confirmadas sem nova seleção. O Route Handler legado não foi removido nesta entrega; seu corpo200 ainda precisa ser substituído pela Page que consome o contexto antes de declarar integração completa.

## Ambiente e imagem

`INTERNAL_HTTP_ORIGIN` é opcional, validada como origem HTTP literal127.0.0.1/[::1], sem credenciais/caminho/query/hash. Exemplo de formato, cuja porta deve corresponder ao serviço real: `http://127.0.0.1:3000`. Não exige credencial nova nem alteração do ambiente local quando SITE_ORIGIN já é HTTP loopback.

Somente APP_ENV local/test deriva a origem ausente de SITE_ORIGIN HTTP loopback (localhost→127.0.0.1). Staging/produção sem origem interna explícita devolvem503 na imagem, sem impedir HTML. Nunca usa Host/forwarded ou origem pública HTTPS. `handleNextImage` recebe segredo derivado por domínio `portfolio-next-image-key-v1`, usa seu protocolo interno próprio e é retornado sem substituir o encapsulamento externo private/no-store; só null autenticado/autorizado libera Next.next. Otimização não foi ativada em NextConfig. A factory Payload é registrada lazy no próprio grafo Proxy; manifestos/raízes conhecidos não a chamam.

## A1 e evidência

O resolver agora aceita `generation?:PublicRoot|null`: só undefined seleciona current. A classificação Native permanece metadado de propriedade/cobertura, sem corpo. `publishedReadStatus` extrai o mesmo algoritmo A1 de contagem de intenções estruturais com requisição fresca; o wrapper Native mantém Result/headers e apenas reutiliza a função.

| Evidência em stage2-briefs | Resultado |
| --- | --- |
| E2-transport-env-status-red.txt |10 falhas/17 passes contra ausência/stubs |
| E2-transport-context-red.txt |29 falhas/1pass contra stub |
| E2-transport-shell-guard-red.txt |esperado503/recebido200 para label legada obrigatória faltante |
| E2-transport-case-isolation-red.txt |esperado200/recebido503 para case publicado independente da shell |
| E2-transport-negative-case-red.txt |4 falhas antes da resposta negativa direta |
| E2-transport-unit-final.txt |**73/73 em4 arquivos**, exit0 |
| E2-transport-lint-final.txt / format-final.txt |12 arquivos, exit0 |
| E2-transport-typecheck-final.txt |no-emit/sem incremental, raízes nos12 arquivos, exit0 |
| E2-render-captured-null-red.txt |Native real: esperado503/recebido200 antes do patch, exit1 |
| E2-render-captured-null-green.txt |Native real:1/1 após patch, exit0 |
| E2-public-render-native-green.txt |**Native real:4/4 em2 arquivos**, exit0,12 migrações/PG17.11/tmpfs55433 e cleanup |

Os runners Native foram executados exclusivamente pelo root. Este agente leu os logs/resultados e os copiou para C:; não executou outro lifecycle. Eles comprovam captured-null sem reeleição,404 estrutural nunca publicado saudável,503 com intenção conhecida sem cobertura, case independente200 e decisões privadas/desconhecidas igualmente404. Os testes do adaptador exercitam NextResponse/FS e um servidor HTTP sintético; não são prova HTTP do Next/optimizer. Root mantém o gate real MISS/HIT/retirada, metadata, SSR, condicionais e navegação.

Durante a implementação foram corrigidos: remoção em iterador vivo de Headers que pulava chaves; fixture sintética sem summary exigida pelo resolver A1; e tipo RequestInit do teste que permitia signal:null incompatível com NextRequest. Logs intermediários preservam essas falhas; não são escondidas nem contadas como GREEN.

## Limites e propriedade

Este agente não alterou Page/Layout/UI, writer/coordenador, snapshot helper, NextConfig ou infraestrutura. Não fez build/Next/fullverify/stage/commit. O reexport resolveContextualLink em cases/server.ts pertence ao root e foi preservado; esta tarefa acrescentou somente o renderer puro nesse arquivo compartilhado.

Falha/remoção do pin depois da escolha de status ainda é erro de render sem prova de conversão tardia para503; não há fallback de geração. DEBT-RENDER-SNAPSHOT-RETENTION permanece. Roots sem qualquer case/order continuam sendo agregado indisponível pelos getters atuais; esta camada não inventa lista vazia via contagem estrutural. Shell/caseLinkLabel legados seguem as decisões descritas. Domínio final não foi inventado e nenhuma garantia de produção/CDN/memória do optimizer é atribuída a estes testes.
