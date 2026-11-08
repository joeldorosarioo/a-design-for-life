# E2 — transporte público de request para App Pages

30/10/2026. **Etapa2:16,7% (1/6 concluída)**. Plano somente por leitura durante o gate do coordenador. Nenhuma fonte E: foi escrita e nenhum runner/DB/Next/build foi executado nesta preparação. A implementação depende da liberação explícita do freeze e aprovação deste plano pelo root. Não inclui Page/Layout/UI, remoção do Case Route Handler, ativação de images.unoptimized:false ou alteração do writer/coordenador.

## 1. Escopo e fronteiras

Arquivos previstos, após liberação:

- `src/config/public-render-context.ts` e teste adjacente: decisão pública, contexto assinado e leitura do pin.
- `src/proxy.ts` e teste adjacente: adaptador fino Next, composição de runtime/factory e ramo de imagem.
- `src/config/server-env.ts` e testes: somente `INTERNAL_HTTP_ORIGIN` opcional validada, necessária à composição do helper de imagem já entregue.
- Extensão mínima autorizada pelo root: `features/cases/server/resolve-case-route.ts` e regressão/integração adjacentes para aceitar explicitamente `PublicRoot|null` sem nova seleção.
- Extração autorizada do algoritmo existente de `helpers/payload/published-read-response.ts` em função de classificação de status reutilizável, mantendo o wrapper Native e sua resposta inalterados; teste/regressão do helper e Native pelo runner exclusivo do coordenador.

Importações de conteúdo passam pelas entradas públicas `features/*/server`. `readPublishedPortfolio(locale,root)` é a composição existente de DTOs. Helpers de transporte são infraestrutura/composição, não passam a conceder conteúdo via SQL. Reutilizar `pinPublicRoot`/`readPinnedPublicRoot`; não alterar seus arquivos, protocolo de publicação ou política de retenção.

## 2. Interfaces mínimas

Nomes finais podem acompanhar a revisão, mantendo este tamanho de interface:

```ts
type PublicRenderContext = {
  v: 1;
  method: 'GET' | 'HEAD';
  pathname: string; // caminho normalizado, sem origem/query/hash
  locale: 'pt' | 'en';
  status: 200 | 404 | 410 | 503;
  pin: PublicRootPin | null;
};

preparePublicRenderRequest(
  request: Request,
  options: { publicationDirectory: string; secret: string },
): Promise<
  | { status: 308; location: string }
  | { status: 200 | 404 | 410 | 503; requestHeaders: Headers }
  | null // fora da superfície pública deste adaptador
>;

readPublicRenderContext(
  headers: Headers,
  options: { publicationDirectory: string; secret: string },
  expected?: { pathname: string; method?: 'GET' | 'HEAD' },
): Promise<{ context: PublicRenderContext; root: PublicRoot | null }>;
```

O verificador/leitor não usa React.cache internamente e não lê `current.json`. A composição Page futura criará **uma** função module-level `cache(async () => readPublicRenderContext(await headers(), ...))`, compartilhada por Page, metadata normal e metadata de not-found. Não criar funções cacheadas independentes em cada consumidor; não passar objetos recriados como chaves de memoização. A Page pode conferir adicionalmente o caminho esperado derivado de params; metadata de not-found sem props pode usar os campos já assinados/validados. O wrapper no-args de request evita capturas diferentes entre esses consumidores.

O contexto contém apenas versão, método, rota, locale, status e pin/digest; nunca corpus, DTO completo, credencial, mensagem SQL ou estado privado. `status200` exige pin. `pin:null` permite resposta segura de indisponibilidade ou ausência já classificada, sem consultar corpo ou tentar recuperar uma geração antiga.308 termina antes de qualquer render e não precisa de contexto/pin.

### Assinatura e remoção de entrada

Usar um único header, por exemplo `x-portfolio-render-context`, com payload JSON estrito codificado em base64url e HMAC SHA256. A assinatura tem domínio fixo exclusivo `portfolio-public-render-context-v1` e usa segredo servidor já existente (`PAYLOAD_SECRET`, diretamente com domínio ou chave derivada por domínio); não criar nova credencial. Comparação constante após validar formato/comprimento. Validar schema estrito, versão, método, tamanho máximo do token e rota/locale coerentes; não aceitar campos extras ou `200+pin:null`.

Clonar request.headers e apagar **todos** os headers do namespace próprio de contexto recebidos do visitante, inclusive formas antigas/duplicadas e variantes de override correspondentes, antes de definir o valor novo. Nunca ler geração/status/pin de query, cookie ou headers do visitante. Não ecoar token, digest ou assinatura no response/log. Preservar headers reais de RSC/router para o Next. A assinatura atesta método+rota efetivamente observados no Proxy; `expected` permite verificar a vinculação no consumidor normal.

Não acrescentar TTL ao contexto do render: um processo pausado pode retomar um request legítimo. A proteção contra seleção/replay por visitante é sobrescrever a entrada em toda a superfície coberta, não expor o token e validar a vinculação de rota/método. Qualquer rota que consuma contexto precisa estar coberta pelo Proxy; ausência/assinatura inválida é erro fechado, nunca acesso direto a pin antigo. Rotação de segredo invalida contextos em trânsito e precisa ser tratada como limite de operação. O HMAC de imagem mantém seu protocolo independente de30s, já implementado no helper.

## 3. Seleção e status

O fluxo de uma requisição HTML/Flight válida é: classificar rota → ler `current.json` uma única vez → resolver usando explicitamente essa raiz → fixar a raiz capturada quando houver conteúdo/contexto utilizável → assinar a decisão → `NextResponse.next({status,request:{headers}})`.

`readPublicRoot(publicRootDirectory(readServerEnv(...)))` é a única seleção. Pin on read transporta a mesma raiz, sem escolher outro arquivo. Não instalar/cachear raízes em globals; não confiar no provider que instrumentation teria instalado em outro grafo. Getters públicos recebem o objeto explícito, inclusive `null` onde suportado. Nenhum getter do render poderá reler current ou reclassificar um404/410/503 com origem alterada depois do Proxy.

| Situação | Decisão prevista |
| --- | --- |
| Home/Cases/About, projeções necessárias válidas da raiz |200 + pin exato |
| Detalhe atual e agregados necessários válidos |200 + pin exato; corpo posterior somente do DTO público da mesma raiz |
| Histórico confirmado |308 direto ao atual do mesmo idioma; no-store |
| Retirada confirmada |410 + pin; representação segura/localizada, sem corpo retirado |
| Slug inexistente/privado, origem saudável prova ausência |404, indistinguível; nunca preencher corpo do CMS |
| Origem indisponível sem cobertura utilizável |503; Retry-After60; noindex |
| Raiz ilegível/corrompida |503; não buscar snapshot anterior |
| Falha ao criar/validar pin antes de devolver next |503 + contexto sem pin; não manter200 sem transporte utilizável |
| Alias cruzado `/pt/about`, `/en/sobre` ou forma de rota inválida |404 fixo/noindex; sem negociação ou tradução para outro endereço |
| Configuração/segredo inválido, impossibilitando assinar |503 vazio/no-store/noindex; não permitir Page com contexto não autenticado |

Para308 e estados negativos do detalhe, preservar a classificação A1 sem mascarar410/404 por falha de um agregado opcional da shell. Sua UI futura usa partes confirmadas da mesma raiz quando válidas e links seguros estáticos quando necessário. Para200, validar antes as projeções que a Page realmente usará, incluindo a composição `readPublishedPortfolio` se esse for o contrato da Page. Falha de composição não pode virar lista vazia ou gerar200 seguido de outro estado escolhido no render.

### Patch capturado-null do resolver

Hoje `resolveCaseRoute(..., generation?:PublicRoot)` usa `generation ?? readPublicRoot(...)`. Isso permite uma segunda seleção quando não existe raiz capturada. O root autorizou o patch futuro:

```ts
generation?: PublicRoot | null;
const root = generation === undefined ? await readPublicRoot(...) : generation;
```

A classificação de Native e os status permanecem iguais. RED Native exigido: publicar rotaA no banco/raiz reais; chamar com `capturedRoot:null`; antes do patch recebe200 pela releitura e deve falhar esperando503 para histórico público sem cobertura; depois recebe503. Cobertura explícitaA e chamada sem parâmetro mantêm os contratos anteriores. SQL continua classificando propriedade/cobertura, nunca devolvendo corpo público. Essa prova será executada somente na janela DB liberada pelo coordenador.

### Ausência estrutural

`getPublishedProfile`/`getPublishedNavigation` recebem `root|null` e devolvem `unavailable` quando falta cobertura. A distinção A1 de404 saudável/503 existe em `publishedReadResponse`: uma requisição Native fresca conta apenas documentos estruturais por locale com `latestPublicationIntent exists`; zero prova nunca público, qualquer intenção ou falha conserva503.

Extrair esse mesmo algoritmo para `publishedReadStatus(result, subject, payload):Promise<200|404|503>`. `publishedReadResponse` chama essa função e continua serializando exatamente seu Result com os mesmos headers. O transporte chama a função **somente se** faltar uma projeção estrutural necessária, após obter o Payload de forma lazy; não consultar SQL no caminho de raiz conhecida válida. Não duplicar contagem nem transformar `_status`/consulta Native em concessão de DTO.

Para Home/list/About, a validação da composição pode falhar por agregados além de perfil/nav. Classificar especificamente os componentes estruturais ausentes; combinar requisitos ausentes de modo que qualquer503 mantenha503. Se perfil/nav estão válidos, mas o agregado de cases/SEO é inválido, conservar503: uma contagem estrutural não prova lista vazia ou ausência do agregado. A decisão de permitir um corpus sem nenhuma ordem/case é contrato dos getters e não será inventada nesta camada.

## 4. Composição de runtime e Next

`src/proxy.ts` será um adaptador fino: ler ambiente validado/diretório, garantir factory lazy de Payload no **próprio** grafo, chamar a preparação e converter resultado em next/redirect/resposta segura. O provider existente guarda somente uma factory; não adicionar cache de documentos, requests ou gerações.

A factory pode importar `payload.config` e `getPayload` dinamicamente quando chamada. Sua instalação não carrega config nem inicializa banco; rotas conhecidas e manifestos válidos não precisam dela. Isso suporta o fallback de classificação de `resolveCaseRoute`, do status estrutural e do helper de imagem sem presumir composição de instrumentation. Não instalar `runtimePublication` só para ler/pinar: o diretório é composto explicitamente e os getters recebem a raiz. Se alguma dependência tentar consultá-lo, isso é um bug de seleção a corrigir, não motivo para reler current.

Headers públicos HTML/Flight/redirect: `Cache-Control:no-store,max-age=0`; `X-Robots-Tag:noindex,nofollow` para404/410/503; `Retry-After:60` em503; nosniff. Não definir Content-Type do Proxy para Pages, nem copiar metadados internos na resposta, nem destruir o Vary de RSC. O controle de ETag/config final pertence ao root: o probe usou generateEtags:false, portanto não se afirma proteção condicional do build completo até a prova integrada. Não usar rewrite, server customizado ou wrapper HTTP para HTML.

Matcher deve cobrir somente Home explícita PT/EN, Cases e seus caminhos de detalhe, About correta e os dois aliases cruzados404, mais `/_next/image`. Proposta estática: `/pt`, `/en`, `/pt/cases/:path*`, `/en/cases/:path*`, `/pt/sobre`, `/en/about`, `/pt/about`, `/en/sobre`, `/_next/image`. Dentro da preparação, conferir a allowlist novamente; caminhos extras de case recebem404, não recebem outro papel. Não interceptar `/`, painel, Payload/API, preview, media/original, language-preference ou assets. URLs com locale não aprovado ficam no404 padrão, sem redirecionamento para idioma suportado. Se o root criar depois uma catch-all localizada que consuma o contexto, o matcher terá de ser ampliado explicitamente com teste.

Normalização de path deve acompanhar os params do Next: decodificar segmentos de forma controlada, validar caracteres/estrutura do domínio, recusar slash/backslash/controle embutido e codificação inválida, sem interpretar uma string como URL de destino. Query (incluindo `_rsc`) fica intacta no request original, mas nunca seleciona locale/geração/status. O contexto assina o caminho normalizado que a Page pode reconstruir de params. O cookie de idioma é ignorado em toda URL localizada; a negociação307 de `/` continua no handler existente.

## 5. Ramo do otimizador

No caminho exato `/_next/image`, chamar **o helper atual** `handleNextImage` pela entrada pública da feature. `null` só permite `NextResponse.next()` para a chamada interna autenticada e autorizada pelo root atual. Qualquer `Response` externa é retornada integralmente, preservando o encapsulamento `private,no-store`; não trocá-la por next ou tentar acrescentar headers depois do otimizador. Não apagar o header próprio de autenticação de imagem antes do helper: isso quebraria o protocolo de chamada interna. Contexto de render e autorização de imagem são namespaces diferentes.

Não ler/pinar a raiz HTML no ramo de imagem. O helper já captura a raiz uma vez em cada request externo/interno e reautoriza antes do optimizer. O fallback P2 atual usa metadados Native somente quando falta manifesto; um provider lazy funcional é necessário para distinguir404 saudável de503. Ler raiz atual de novo na chamada interna é deliberado: são dois requests, e uma revogação entre eles deve negar os bytes.

Adicionar `INTERNAL_HTTP_ORIGIN` opcional a `readServerEnv`, restrita a origem HTTP de loopback literal127.0.0.1/[::1], sem userinfo/path/query/hash. Quando omitida, somente APP_ENV local/test pode derivar de SITE_ORIGIN HTTP de loopback; normalizar localhost para127.0.0.1 e preservar porta. Staging/produção sem configuração interna confiável retornam503 nessa superfície até E3 configurar topologia. Ausência não impede startup de HTML nem bloqueia desenvolvimento local. Nunca derivar de Host, forwarded headers, origem pública HTTPS ou informação da URL enviada pelo visitante.

Segredo vem de PAYLOAD_SECRET com separação de domínio; widths/qualities refletem os defaults efetivos do Next ou as allowlists explícitas do root. Não alterar NextConfig/images.unoptimized/localPatterns nesta entrega. O root ativa a otimização somente após a prova real da guarda composta. PNG sintético do probe continua a única mídia de experimento; não baixar assets.

## 6. Testes e limites de aceite

Após liberação, TDD focado com Node atual e FS real: pin deA, troca paraB, tokenA carrega somenteA; próximo preparo escolheB; tokens forjados/trocados/truncados/extra fields/método/path divergente falham fechados; headers internos de entrada são substituídos; token tem tamanho pequeno constante sem corpus; ausência/corrupção de pin nunca lê current. Testar locale explícito versus cookie, aliases cruzados, normalização/encoded path, query ignorada, status/no-store/HEAD e308 direto. Testar que positivo conhecido não chama provider que deliberadamente falha, identificando isso como prova de caminho sem dependência, não como simulação de Native saudável.

Testes do adaptador Next podem observar NextResponse/request override como unidade; não serão anunciados como HTTP real. Classificações saudáveis e captured-null exigem Native real no banco isolado do coordenador, sem runner concorrente. O ramo de imagem conserva os testes/probe atuais e precisa de teste da composição da origem confiável, da passagem interna/null e da resposta externa/no-store. Se uma duplicação de helper for necessária apenas para teste, revisar a interface em vez de adicionar um framework.

O root mantém a prova integrada final: build com configuração real, HTTP GET/HEAD/RSC/condicionais, headers especiais de Next forjados, publicação Native concorrente,404 metadata de not-found, histórico reversível308 com cache normal, imagens MISS/HIT/revogação com ACK antigo e SSR sem JS. Nenhuma suíte global/DB/Next será iniciada por este agente sem janela explícita.

**Limitações explícitas:** os pins imutáveis sem GC evitam desaparecimento normal da geração entre seleção e render, mas remoção/corrupção/falha de disco posterior à decisão pode falhar no render. Não há prova de converter essa falha tardia em503 real usando App Page; não prometer isso. O leitor falha fechado e não seleciona current/outra raiz. O router Next observado inicia navegação de documento após Flight não-2xx; ambos têm snapshots próprios e podem capturar gerações diferentes se ocorrer publicação entre requests.

O Route Handler legado de case permanece por exigência de escopo e ainda relê current independentemente. A entrega do transporte, isoladamente, não assegura o contrato de mesma geração no seu corpo legado; essa alegação só existe após o root substituí-lo por App Page que consome o contexto assinado e repete as provas reais. Layout publicado também precisa ser composto no segmento que rerenderiza para não conservar navA junto de páginaB.

Fontes: helper atual `next-image-proxy`, correção `E2-next-image-P2-fix.md`, `published-read-response`, `resolve-case-route`, getters/export públicos e `readPublishedPortfolio`, configuração/instrumentation/providers, `server-env`, arquitetura de publicação/pins; e o probe empírico Next16.4.3 de `e2-rsc-status-architecture.md`. O helper de imagem já foi compilado em Proxy real pelo agente responsável; não é necessário adivinhar suporte a server-only nem executar novo probe durante o gate.
