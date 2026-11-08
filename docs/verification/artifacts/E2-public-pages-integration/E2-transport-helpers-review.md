# E2 — revisão independente dos helpers de transporte

30/10/2026. Etapa 2: **16,7% (1/6 concluída; E2.1)**. E2.2–E2.6 e A2 continuam em andamento. Revisão delimitada, somente leitura do app `E:/a-design-for-life`; nenhum teste, build, Next, banco, instalação ou comando Git foi executado. Este relatório é o único arquivo criado pela revisão.

## Resultado

**Um achado P2 no contrato de falhas do helper de imagens.** Não encontrei outro defeito acionável nos arquivos delimitados por inspeção. Isso não aprova a futura composição Proxy/RSC nem substitui a matriz HTTP integrada.

### [P2] Não converter cobertura pública ausente em 404

Arquivo: `E:/a-design-for-life/src/features/media-library/server/next-image-proxy.ts:106–113` (ponto principal:108).

`!manifest` retorna404 para toda raiz sintaticamente válida em que o ID não aparece. Entretanto, a raiz pode estar incompleta para um proprietário ainda comprovadamente público. A1 distingue esse caso da retirada confirmada: `docs/architecture/publicacao-e-falhas.md:63` exige503 para mídia com uso SQL `confirmed` sem cobertura do proprietário; a lista `media: []` de um proprietário coberto confirma revogação. `resolve-media-access.ts:39–61` já implementa essa distinção. O helper novo abandona a distinção e nem consulta uma capacidade de classificação quando não encontra o manifesto.

Cenário concreto: uma mídia tem uso `confirmed` em `case-content/X`; `current.json` continua JSON/schema válido, mas não contém `case-content/X` (ou seu valor não cobre `media`); a requisição canônica `/_next/image?url=%2Fmedia%2F<ID>%2Foriginal&w=64&q=75` recebe404 vazio imediatamente. A entrega original existente classificaria503; se a origem de classificação estiver indisponível, ela também conserva503. A falha de cobertura vira inexistência na nova entrada. Isso não concede bytes privados, mas quebra o contrato de indisponibilidade de A1 e a consistência entre as duas entradas do mesmo recurso.

Correção: separar ausência do manifesto dos casos positivamente recusáveis (por exemplo, manifesto de PDF). Na ausência, chamar uma capacidade pequena e preguiçosa da feature que classifique ausência/revogação versus cobertura faltante usando **a raiz já capturada**, sem reler `current.json` e sem permitir que SQL conceda bytes. Uma classificação saudável pode provar404; erro/inconclusão/cobertura pública faltante produz503. Evitar chamar o resolvedor de bytes inteiro só para classificar, pois isso acrescentaria leitura de objeto e poderia selecionar outra raiz. Se optar por uma política conservadora sem SQL, não afirmar404 onde a ausência não foi demonstrada; manter a retirada coberta com404 requer prova específica.

Regressões necessárias antes de compor: raiz válida sem proprietário + uso confirmado =>503; origem da classificação indisponível =>503; proprietário coberto com `media: []` + ACK SQL antigo =>404; recurso privado/nunca publicado com ausência saudável =>404; todos sem corpo, `private, no-store` e sem fetch do otimizador. Cobrir também a chamada interna autenticada. Não executei esses casos nesta revisão.

## Standards

Nenhuma violação acionável encontrada nas fronteiras inspecionadas. `render-snapshot` depende apenas de capacidades técnicas/helpers; reutiliza o schema exportado da raiz. A feature de mídia importa outro arquivo privado da própria feature e expõe `handleNextImage` por `server.ts`, que mantém `server-only`. Os handlers HTTP compõem as entradas públicas de `language-switcher` e helpers/configuração genéricos. Não foram criadas dependências runtime de cliente para servidor nos arquivos revistos.

## Spec e segurança inspecionadas

- Snapshot: a raiz é validada e serializada antes de `await`; o helper não escolhe a geração nem consulta CMS/current. O caminho combina UUID validado e diretório confiável. SHA256, schema e geração são conferidos na leitura. Temporário exclusivo, sync e link no mesmo diretório publicam bytes completos sem substituir o vencedor; a colisão concorrente exige os mesmos bytes. `finally` remove somente o temporário próprio. Não encontrei caminho de fallback para raiz antiga ou sobrescrita por outro candidato.
- Autoridade do snapshot: digest/pin não autenticam o cliente. A documentação atribui corretamente ao chamador a captura única de `current.json`, remoção de seletores do visitante, autenticação do handoff e uso do mesmo contexto em status/corpo/metadata. Essa autenticação ainda não está implementada nesses helpers; não é uma garantia obtida por este relatório.
- Imagens: query canônica estrita e fonte `/media/{UUID}/original` impedem URL remota/preview/derivados arbitrários; origem é loopback literal HTTP de configuração confiável, sem redirecionamento. HMAC vincula expiração, GET, query e Accept; assinatura é comparada em tempo constante e não aparece na resposta. Tanto chamada externa quanto interna revalidam a raiz atual. Só o GET interno autenticado retorna `null`, condição para passagem ao Next. Não encontrei bypass por assinatura forjada ou concessão por SQL no caminho positivo.
- Cache e falhas: a resposta externa é nova e `private, no-store`; condicionais/cookies/autorização/Host do visitante não vão ao fetch interno. Erros e timeout no corpo retornam resposta vazia antes de expor bytes parciais. O manifesto é imutável por MediaID no contrato A1, portanto reusar cache do Next para o mesmo ID não cria aqui uma troca de bytes por revisão. Hits ainda dependem da autorização externa/interna. A composição terá de preservar o matcher, as duas chamadas da guarda e o encapsulamento final.
- HTTP de idioma: `/` produz307 relativo, privado/no-store, sem gravar cookie; POST aceita somente objeto locale estrito, exige Origin configurada e deixa o writer existente definir os atributos e180dias. Não identifiquei redirecionamento aberto, preferência vinda de Host/query ou renovação por visita nesses handlers. UI, roteamento Next/HEAD/405 e comportamento de navegador continuam fora da prova direta dos handlers.

## Recursos e dívidas conhecidas

`next-image-proxy.ts:141` usa `arrayBuffer()` sem limite próprio de bytes e não impõe limite de requisições simultâneas. Timeout limita duração do fetch/consumo, não o pico de memória nem garante cancelar trabalho de transformação já iniciado no Next. A origem é o próprio otimizador e os uploads originais têm o contrato de limites de A1; isso não equivale a um orçamento de memória/concorrência do runtime. O relatório do helper já declara a limitação. Não a transformei em uma nova proibição de pixels/frames, nem em achado de segurança sem um impacto adicional demonstrado. O gate integrado deve conservar essa limitação explícita e não afirmar dimensionamento/produção aprovado.

`DEBT-RENDER-SNAPSHOT-RETENTION` já registra crescimento por geração fixada, temporários após crash e ausência de GC; o diretório é privado/confiável e não há promessa contra filesystem hostil. A dívida não contradiz o pin on read aprovado. Não a reportei como defeito novo nem recomendei TTL que possa apagar uma raiz ainda usada por render pausado. Windows não tem promessa de durabilidade contra queda de energia; Linux sincroniza o diretório no caminho de criação. A revisão não certifica perda de máquina.

## Fontes e limites

Lidos: AGENTS; contratos públicos/privacidade/P08 e idioma da spec; plano E2; execução atual; arquiteturas `fronteiras`, `midias-privadas`, `publicacao-e-falhas`, `render-snapshot`; política de mídia; helpers e testes adjacentes; `public-root`, `public-media`, `resolve-media-access`, `media-response` e schemas; handlers e testes de idioma; relatórios `render-snapshot-implementation`, `E2-next-image-helper`, `E2-next-image-contract`, `e2-rsc-status-architecture` e `stage2-briefs/E2.4-http-implementation-report`.

Os resultados RED/GREEN, probes Next reais e gates históricos são evidência **relatada pelos respectivos autores**, não execução repetida por esta revisão. Os testes de helper usam resposta HTTP sintética; só o probe separado relatado exercita Next real. Nenhuma evidência daqui demonstra integração App/Proxy/RSC, falha de handoff depois da escolha de status, publicação Native concorrente, PostgreSQL, revogação com ACK antigo no app, cache de navegador/CDN, implantação ou A2. A revisão foi solicitada sobre arquivos específicos em mudança; não é uma revisão de branch/diff completo.

### SHA256 dos arquivos de produção inspecionados

| Caminho relativo ao app | SHA256 |
| --- | --- |
| src/helpers/payload/render-snapshot.ts | ADAC47F319BFD35B5D084ABB6968E088AFEF70F49003218822A8A87DF36ED92E |
| src/helpers/payload/public-root.ts | 89A26AE2930257CBD35FE305B4F217C8CC2A39043574668D911F97D60956DEA0 |
| docs/architecture/render-snapshot.md | 93CE689C9A7E2AE60D35F64BBB15CD96A3F6517C6BC6B3AF37C9052466C9853A |
| src/features/media-library/server/next-image-proxy.ts | 95FEF7A1EE9AE0423DF3497E5A57EFEDEF8776797877B3D095D6E47B55C1D4D6 |
| src/features/media-library/server.ts | 5681B477465BFA9CA104E592B585B9588D370B39E0BD0862605A4BDF6E03F6A6 |
| src/app/(portfolio)/route.ts | 00C9D988C849575CDD6D887E0EB680B7787DF1689E3EDE4FBCFF2E781032A021 |
| src/app/(portfolio)/language-preference/route.ts | 5A080AE1C9EF6DDA8A5862BC5A5422302F01334BB87A630793F513CB1A81A22B |

Contagem: Standards0; Spec1 (P2, classificação indevida de cobertura ausente como404). Nenhuma conclusão de tarefa E2 é alterada pela revisão.

## Re-revisão da correção — P2 encerrado

30/10/2026. Etapa2 permanece **16,7% (1/6)**. Esta seção substitui o estado aberto do achado acima para as fontes identificadas abaixo; o texto original permanece como histórico. Re-revisão somente por leitura, sem novos testes, serviços, banco, Git ou alterações no app. A única escrita foi este acréscimo ao relatório em C:.

**P2 resolvido. Nenhum novo achado acionável nas mudanças delimitadas inspecionadas.**

`classify-missing-public-media.ts` extrai a mesma regra de A1 que existia em `resolveMediaAccess`: cria uma requisição Native fresca, lê metadados/usos, classifica503 quando um uso `confirmed` não tem proprietário coberto na raiz recebida e404 quando a ausência saudável ou a cobertura de retirada permite essa conclusão. Erros sobem para os chamadores e se tornam503 vazio/no-store. A função recebe a raiz já capturada; não lê `current.json`, não seleciona outra geração, não lê bytes de storage e não retorna manifesto ou autorização. SQL continua limitado à classificação negativa.

Os dois chamadores usam a capacidade somente em `!manifest`. O caminho positivo de `handleNextImage` continua dependente do manifesto confirmado e da assinatura interna, sem chamar/inicializar Native para autorizar a imagem conhecida. `resolveMediaAccess` conserva a leitura de objeto e a autorização de prévia. A ausência de provider no grafo do Proxy continua falhando em503; a prova do404 saudável no Proxy composto permanece necessária no gate do coordenador.

Li os novos testes de integração: eles publicam mídia Native real, removem ou deixam sem cobertura o proprietário e comparam503 nas entradas original e otimizador, inclusive com HMAC interno válido. Também retiram a publicação real, recolocam deliberadamente os usos SQL confirmados anteriores e exigem404 sem bytes; conferem a raiz recebida contra uma raiz de disco posteriormente alterada; e mantêm privado/nunca publicado e UUID desconhecido indistinguíveis como404 com origem saudável. Os unitários de provider indisponível esperam503. Essa cobertura atende ao cenário do achado original por inspeção de fonte; não executei os testes novamente.

### Evidência conferida nesta re-revisão

| Artefato em work/stage2-briefs | Resultado lido |
| --- | --- |
| E2-next-image-P2-fix.md | Explica extração, RED Native404 versus503 e limites de integração |
| image-probe/helper-coverage-green-unit.log | 3 arquivos,54/54 testes aprovados |
| E2-editorial-fields-native-green-final.log | 7 arquivos,25/25 testes aprovados |
| E2-editorial-fields-upgrade-final-verify.log | historicalIdsAndVersionsPreserved, canonicalContentPreserved, newNullableValuesOnly, privateDraftsNotCaptured e publicGetters iguais a true; operationCount6 |

Os resultados de execução pertencem aos autores/runner dos artefatos; esta revisão leu as evidências e não os reproduziu. A prova Next real MISS/HIT anterior não foi repetida aqui após a extração. Não se deriva aprovação HTTP/App/Proxy/E2E dos testes dos helpers.

### Compatibilidade Native histórica — inspeção adicional delimitada

Lidos `capture-legacy-publications.ts`, seus testes de integração, `publication-updates.ts`, `publication-enqueue.integration.test.ts`, adaptadores de publicação, trechos relevantes de `editorial-revision.ts`, coordenador e o `updateOne.js` instalado de `@payloadcms/drizzle3.92.1`; além de `E2-editorial-fields-report.md` e da saída final de verificação do upgrade histórico.

Os seletores explícitos de captura ficam restritos a campos existentes na migração de coordenação e selecionam grupos/arrays de forma aninhada, evitando incorporar as colunas futuras adicionadas pelo schema runtime. A leitura Native canônica evita o `afterRead` editorial que faria uma leitura completa do head. Para documentos versionados, `contentRevision` identifica o corpo selecionado e corresponde à revisão que o `afterRead` editorial expõe; não se usa a revisão de um rascunho mais novo para identificar o alvo publicado. A passagem JSON remove chaves futuras não selecionadas emitidas como undefined antes da validação do snapshot.

O enqueue continua na mesma `req`/transação que cria a intenção. A atualização por `id` com `select: {id:true}` altera somente `latestPublicationIntent`, `publicConfirmed` e o sentinel Native `updatedAt:null`, preservando o timestamp editorial conforme o teste de igualdade do head. Cabeça ausente falha503. O código instalado confirma que a ramificação de `where` atômico usa `returning()` irrestrito, enquanto o caminho por ID encaminha `select` ao `upsertRow`. Os CAS condicionais do coordenador continuam com `where`, `options.atomic:true` e comparação da intenção; não foram convertidos para atualização incondicional por ID. Não encontrei regressão concreta nessas mudanças delimitadas.

A saída histórica final confirma seis operações e preservação de corpos, IDs/versões e drafts; é evidência do harness executado pelo agente responsável, não execução delegada a esta revisão. Não revisei integralmente o harness, toda a migração ou todas as regras editoriais nesta inspeção adicional. O gate combinado do coordenador continua necessário.

### SHA256 das fontes atuais conferidas

| Caminho relativo ao app | SHA256 |
| --- | --- |
| src/features/media-library/server/classify-missing-public-media.ts | 9A22AAB09AB670A8AB8BF1A6AFF9BAC9A3ABC285CD123D407D124F3D52643B15 |
| src/features/media-library/server/resolve-media-access.ts | 4E7FFCFB82EB3D95C0DCD8389645E75AA70C6FB3D7B643113657699554E45D93 |
| src/features/media-library/server/next-image-proxy.ts | F9EE92F900FBF4924F22672F384214CF681ED632C3CF9E551EDECC24934F5429 |
| src/features/media-library/server/next-image-proxy.test.ts | 828F7D20A72D5B34A7ACE0B57112D87AC640E9E744DF0583250829EFF6C30693 |
| src/features/media-library/server/next-image-proxy.integration.test.ts | 4D5A7D97694B9B4B15B257823DF51BE9F309EC1B62CFF50EDDE14B783165DE8F |
| src/config/capture-legacy-publications.ts | B42DE423755E969FD6C90116087C9D6EA40E7CDFD3690D0C5A59596A26A0D409 |
| src/helpers/payload/publication-updates.ts | 10C0763853D5EFC10E5A55392CE6403F3E1472896F90D48879CC315EE3D6D006 |

Estado final desta revisão: **P2 original encerrado; zero achados novos acionáveis** no escopo delimitado. Limites de buffer/concorrência, retenção de snapshots e composição integrada descritos anteriormente permanecem explícitos. Nenhuma tarefa E2 ou aprovação A2 foi concluída por este relatório.
