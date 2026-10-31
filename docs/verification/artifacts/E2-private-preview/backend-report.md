# Transporte e modelo de prévia privada — handoff de fontes

30/10/2026. CLI de progresso --check executada novamente, somente leitura, exit0:
**56,7% (17/30 itens; 1/6 tarefas encerradas)**. Nenhum item foi fechado por este handoff.
A2 e gate global permanecem pendentes. DB55433 devolvido ao root após cleanup do último runner.

## Resultado e limites

Transporte: 20/20 testes unitários em2 arquivos e39/39 Native em5 arquivos. Modelo privado +
regressões: 50/50 Native em6 arquivos,22,54s. O segundo conjunto inclui o primeiro; não somar
39+50. Tipagem focada, ESLint e Prettier dos9 arquivos próprios: exit0.

pnpm typecheck completo solicitado pelo root: exit2, somente3 erros no arquivo root-owned
src/config/build-public-index.ts:55: TS2550 toSorted não está no lib atual; TS7006 a e b implícitos.
Não alterei esse arquivo. Logs E:.work/E2-private-preview-full-typecheck.txt/-result.json.

Depois do último50/50, a tipagem detectou select:{id:true} no fixture de isolamento: o tipo
CaseContentSelect não expõe id, que Native retorna implicitamente. Corrigi somente para
select:{locale:true}; tipagem/lint/format focados ficaram0. A regressão Native final desses
2 arquivos comseed1 está com o root, para o próximo batch SEO, após devolução do lease.
Isso é pendência de verificação explícita; o50/50 anterior não é apresentado como rerun dessa
última alteração de seletor de teste. As4 fontes de produção permanecem iguais às do50/50.

Nenhuma Page/layout, Proxy, Next config, SEO, UI, migration, writer, credencial ou ACL foi
alterada por esta frente. Os exports cases/server.ts foram acrescentados pelo root. Não fiz
build, Next, Git ou pnpm verify. Não há prova HTTP de HTML/Flight/cache/redirect/UI final neste
handoff; essa integração continua com o root.

## APIs finais

src/config/prepare-private-preview-request.ts, server-only:

```ts
type PrivatePreviewAuthorization =
  | { ok: true; value: { scope: PrivatePreviewScope; context: PreviewContext } }
  | { ok: false; response: Response };
authorizePrivatePreviewRequest(request, {origin}): Promise<PrivatePreviewAuthorization>
preparePrivatePreviewRequest(request, {origin}): Promise<Response | null>
```

A primeira API é somente para composição servidor e Page REAUTH independente. Native req,
payload e documento permanecem nesse contexto servidor. A segunda retorna somente negação
vazia ou null após autorização Native completa do próprio prefixo. Não é capability/cache;
não confiar no redirect anterior ou contexto público. Sessão é lida novamente a cada chamada.

Origin é configuração de origem HTTP(S) estrita, nunca Request.url/Host/forwarded. A Request
lógica /preview repassa cookies/Origin/Fetch Metadata reais sem fabricar metadados de browser.
Path/query/método inválidos só aparecem como400/405 após Native autenticar e validar origem;
sem sessão→401, autenticação com origem/permissão negada→403, fora da superfície→404,
configuração/exceção→503. Falhas: body vazio, private/no-store/noindex/nosniff/no-referrer;
405 inclui Allow GET,HEAD. GET/HEAD autorizados retornam null. Isso precede Next no adapter,
mas a Page precisa reautenticar e seus erros posteriores ainda exigem prova HTTP do root.

src/config/read-private-page-model.ts, server-only:

```ts
readPrivatePageModel(request, {origin}): Promise<
  {ok:true; value:PrivatePageModel} | {ok:false; response:Response}
>
// value: locale, kind, portfolio:PortfolioPresentation, detail? :CaseDetailDTO,
// targets:{home,cases,about}, navigation:PreviewNavigationPresentationDTO,
// routeContext:{locale,profile:ProfileDTO,routes:[{caseId,contentId,locale,path}],
//               pageScope:{collection:'professional-profiles'|'site-navigation',id}}
```

Não devolve callbacks, conta, Native account/req/payload/document, geração, sitemap ou canonical.
PortfolioPresentation é o recorte já definido pelo root; somente DTOs de features entram nele.
Profile/Nav primário preserva o ID autorizado. Case primário busca o ID único de Perfil no
mesmo locale com Native draft:true/depth0/select{id,locale}/overrideAccess:false e o mesmo ator;
nunca usa caseId como ID estrutural. Em seguida chama getPreviewProfile/Nav/Cases/Case públicos
nas features. Falta de estrutura/projeção secundária→Response503 privada. Targets vêm do builder
fechado; navegação usa resolvePreviewNavigation e PDF preview-media. Root cria o callback de
links contextuais no servidor com routeContext e resolvePreviewContextualLink.

Não promete snapshot transacional dos drafts entre consultas. Prova leitura fresca por chamada,
autorização real e independência da publicação; não transforma drafts em geração pública.

## Legado preservado e extensão mínima

preview-session.ts recusa duplicações controladas collection/id/locale/returnTo/view/page DEPOIS
da sessão/origem e ANTES de Object.fromEntries/findByID. Page opcional passa pelo builder fechado
(enum/matriz); vazio/incompatível falha400 para editor e401 para anônimo. Sem page mantém o
contrato legado. Native preview button agora emite page=case para case-content e page=home para
Perfil/Nav, sem slug/título/copy. /preview GET usa a mesma autorização e, com page validado,
retorna307 vazio para URL privada construída no origin configurado, copiando só returnTo seguro.
URLs antigas sem page mantêm307→view1→HTML escapado,401/403/400,headers e retorno seguro.

## TDD e isolamento — evidências preservadas

- Gate global original do root: .work/E2-public-reading-verify-final-attempt.txt/-result.json,
  exit1,970pass1fail2skip/124files; count esperado2/recebido84 no teste de prévia. Preservado.
- Reprodução inicial dos2 arquivos sem seed:9/9 passou porque prévia executou primeiro;
  .work/E2-preview-isolation-reproduce.*. Não é RED.
- RED real de isolamento: .work/E2-preview-isolation-red-seed1.*; legacy primeiro,8pass1fail,
  count2vs3 incluindo draft legado. Nenhuma alteração de produção.
- GREEN mesma ordem: .work/E2-preview-isolation-green-seed1.*,9/9,11,69s. Fixture captura IDs PT
  preexistentes sob ACL/sessão reais, verifica conjunto exato baseline+2, ordem relativa dos2
  próprios, featured próprio e exclusãoEN. Não apaga nem ignora outros drafts autorizados.
- Ordem determinística: --sequence.shuffle.files --sequence.seed=1; arquivos compartilham DB,
  fileParallelism:false. [Vitest oficial](https://vitest.dev/config/sequence.html) explica que o
  sequencer padrão usa cache/duração, e que seed fixa reproduz a ordem embaralhada.
- Unit RED NativeURL: .work/E2-private-transport-unit-red.*,3fail1pass/4; faltava page case/home.
- Native transporte RED: .work/E2-private-transport-native-red.*,22fail4pass/26. Setup, controle
  cookieCSRF none/sem metadados e A1 legado passaram; falharam status/hrefs/duplicações esperados.
- Transporte GREEN: .work/E2-private-transport-unit-green.*,20/20; -native-green.*,39/39.
- Modelo Native RED: .work/E2-private-page-model-native-red.*,9fail2pass/11. Controle Native de
  primário autorizado passou; stub503 falhou nas assertions de modelo/401. Não houve import/setup
  failure usado como RED. Modelo+regressão GREEN: .work/E2-private-page-model-native-green.*,
  50/50 em6files. Sessão revogada, locale cruzado, case sem slug, estrutura ausente, updates de
  Perfil/Case entre chamadas, DTOs anteriores intactos e raiz pública/drafts preservados.
- Checagem focada inicial falhou exclusivamente no select id do fixture; preservada em
  .work/E2-private-preview-focused-checks.*. Final9files0/0/0 em-focused-checks-final.*.
- Um primeiro comando de formatação recebeu os quatro paths como argumento único pelo wrapper
  PowerShell/pnpm e saiu1 semformatar. Foi corrigido com argumentos literais; não é RED de feature.

Todos os runners Native usaram migrations reais/PG17.11/tmpfs55433 e teardown nativo do projeto.
Nenhum mock de Payload/ACL/consulta ou elevação de acesso foi introduzido; os observadores de hook
apenas contam leituras reais. Guarda APP_ENV=test/DB adfl_test_* e fixtures existentes preservadas.

## Fontes congeladas

E2-private-preview-final-frozen/sha256.json registra9 fontes próprias com cópia exata em C.
O hash original do teste de isolamento era EA3FCCA004EF6DDAAD7F97C1282228A8F9D5DD8757A1D36B8D83724BB5F6D288.
A versão intermediária que passou9/9 e50/50 era05DEC33403C8F35D65F065356CA7305F48A88657B7B937917EA24D37FD59491D.
O seletor tipado final está no manifesto e aguarda a regressão Native do root descrita acima.
