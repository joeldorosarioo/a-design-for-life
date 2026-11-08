# E2.5 — matriz pública, recursos lentos e contato

Em 30/10/2026, o lote público autorizado terminou com **63/63 passes, exit 0**, em 1,1 min. BuildID `eW1hAx7oCWrO98E-xBAyT`, Node **24.22.2**, Next **16.4.3**, produção Turbopack. A fonte ficou congelada durante o run. O primeiro E2E original continuou com a mesma posição fonte e tolerância de **±2 CSS px**, sem alteração.

CLI consultado ao fechar esta frente: etapa 2 em **66,7% (20/30 itens)** e **1/6 tarefas integralmente fechadas**. Este relatório não atribui novas tarefas encerradas. O coordenador recebeu a janela de volta e executará o gate integral fresco antes de avaliar E2.4.5/E2.5.5 e commits. A2 permanece pendente.

## Resultado real combinado

Comando executado, sem grep, retry ou skip:

```powershell
pnpm test:e2e reading-position.e2e.test.ts reading-position-expanded.e2e.test.ts public-pages.e2e.test.ts page.e2e.test.ts not-found.e2e.test.ts public-image.e2e.test.ts
```

| Grupo                       | Passes | O que a evidência demonstra                                                                                                                 |
| --------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Matriz                      |      8 | Home/About/lista/detalhe, desktop/mobile, cada uma PT→EN→PT; mesma chave e top±2 px; ida precisa compensar altura, com scrollY diferente    |
| Equivalência                |      9 | Case inteiro ausente, bloco→ancestral DOM, seção→topo do mesmo case, card→lista/Home ancestral; avisos PT/EN distintos do idioma de destino |
| Lifecycle                   |      6 | Back/Forward, entrada direta/refresh, teclado sem autofocus novo, duplo clique, Back durante POST e rolagem durante Flight                  |
| Recursos                    |      4 | Imagem Next real retida, cancelamento durante carregamento, FontFace real retida e deadline com ausência de correção programática tardia    |
| Âncoras                     |      2 | Contato/TOC e hash inicial desktop/mobile abaixo do Header medido                                                                           |
| Contato completo            |     16 | Quatro páginas × dois idiomas × dois viewports; mesmo pathname; contato.top−Header.bottom≥0; mobile fecha diálogo e foca #contact           |
| Primeiro percurso original  |      1 | Home PT→EN, POST204, cookie180dias, mesma seção±2 px e deslocamento absoluto diferente                                                      |
| Páginas públicas existentes |      6 | SSR sem JavaScript, conteúdo/ordem/filtro por locale e menu mobile                                                                          |
| Transporte/cookie           |      8 | Negociação, preferência manual, prazo/renovação/expiração/remoção, URLs explícitas e rejeições                                              |
| 404 localizado              |      2 | HTML/HEAD e Flight com canonicalização `_rsc`, locale explícito, no-store e ausência de cookie/ETag/headers internos                        |
| Imagem pública existente    |      1 | Next optimizer sobre um original, MISS/HIT e HEAD, retirada com404 e zero bytes                                                             |
| **Total**                   | **63** | **exit 0**                                                                                                                                  |

O contato não é certificado apenas por estar na viewport: a diferença entre seu top e o bottom do Header real é medida na mesma leitura DOM e precisa ser não negativa. O teste começa após scroll real para exercitar o Header sticky. Confirma também que Contato pertence à página atual, sem retornar à Home. Nos oito cenários mobile, o diálogo precisa estar fechado e o elemento #contact efetivamente focado.

O teclado ativa o controle com Enter e verifica geometria, ausência de foco forçado no artigo/toast e próximo Tab em controle visível. Não foi imposta restauração automática de foco no botão equivalente, nem alterado comportamento de foco de produção.

## Instalação e fixture

O pacote foi preparado em C:, conferido estaticamente e instalado somente após lease explícito do coordenador. Foram acrescentados três arquivos: `testing/fixtures/reading-portfolio.ts`, `reading-position.browser-support.ts` e `reading-position-expanded.e2e.test.ts`. O hashguard recusava sobrescrita, conferia 18 fontes de referência e os três destinos ausentes. A API e fonte de `createPublicPortfolioFixture` permaneceram intactas.

O wrapper opt-in usa requests Native autenticados, leases e coordinator já existentes. Confere o namespace dos quatro singletonIDs próprios, publica grupos editoriais sem reenviar campos internos e preserva outros cases. Acrescenta avisos distintos PT/EN, outro mediaID EN, alturas diferentes antes da leitura e casos privados de uma tradução. Ordena somente seus cases antes do menor sortOrder existente; não presume DB vazio. O card compartilhado passa da segunda linha PT à primeira EN. O combinado efetivamente o executou depois das outras fixtures públicas, preservadas no mesmo DB serial.

Todos os dados adicionais são sintéticos. Nenhum documento, Root, capability ou progresso foi passado ao cliente do produto. Progresso não é gravado em cookie/localStorage/sessionStorage; o endpoint de preferência recebe somente a escolha manual de locale. O factory usa exclusivamente o DB e namespace de teste autorizados.

## Falha real de produção e diagnóstico antes do fix

A matriz inicial passou de primeira em8/8; isso foi registrado como comportamento existente, sem inventar RED. O primeiro lote restante teve13 passes e um timeout por uma suposição inválida do teste: aguardava `requestfailed` de uma resposta interceptada já obtida por `route.fetch()` durante Back de documento completo. O trace mostrava About carregada. Essa falha não foi contada como RED de produção. O teste passou a observar a garantia externa: Back compromete About, resposta tardia é liberada/finalizada, URL/H1 permanecem e Forward não reexecuta a escolha. O cleanup também evita `unroute` se a página já estiver fechada. A repetição restante passou24/24.

O primeiro combinado completo terminou com62 passes e uma falha real no cenário de imagem: o controle estava habilitado enquanto a resposta da imagem pertinente ainda permanecia retida. O mesmo problema reapareceu no caminho mobile de conclusão. A precondição `pending-disabled` foi mantida; posição e tolerância não foram alteradas.

Separação da evidência Source / mídia / eventos nativos:

1. **Captura real:** o helper de produção, compilado em memória e executado dentro de um IIFE local somente de teste, retornou `{key:"about-approach",top:199.875,ancestors:[]}`. Não foi uma reprodução manual do algoritmo e não expôs hook/global de captura no produto.
2. **Mídia pertinente real:** a imagem do alvo estava visível, top199,875/bottom655,875, `complete:false`, `loading:"lazy"`. O mediaID real era `b5b36c58-3d36-4252-8628-76034a8b56be`. A requisição Next/Native real retida retornara status200 para `/media/<id>/original`, candidata `w=384`.
3. **Candidatas e `decode()` nativo:** aos758,2ms, o código chamou decode na candidata inicial `w=3840`; aos759,9ms o browser rejeitou `EncodingError: The source image cannot be decoded`, ainda com `complete:false`. A escolha responsiva havia mudado para384px. O `catch` antigo tratava essa rejeição como prontidão. A candidata real só carregou depois da liberação do gate, cerca de5813ms; não era expiração do deadline8s.
4. **Instrumentação restrita ao teste:** o wrapper de observação encaminhava `HTMLImageElement.decode` nativo sem alterar argumentos ou resultados. A captura e os logs temporários foram removidos antes do GREEN; os dois arquivos E2E voltaram ao hash exato das asserções que falharam no combinado.

Evidência preservada em `reading-image-decode-evidence/`: `trace.zip`, `actual-source-capture.json`, `destination-images.json`, `actual-image-decode-events.json`, `reading-response-gate.json`, `run.log` e `result.json`. O combinado anterior está em `reading-combined-image-failure/`. Uma tentativa de diagnóstico parou por import incorreto no próprio teste; esse build interrompido está preservado e não é contado como RED.

## Fix TDD e escopo de produção

Dois REDs unitários reais antecederam a correção: `timedOut` foi false quando deveria ser true para imagem ainda carregando e um frame final foi enfileirado prematuramente. O log mostra **2 falhas/6 passes**, sem falha de import/setup.

Único arquivo de produção alterado neste ciclo: `src/features/language-switcher/helpers/reading-position.ts`. `imageReady` espera eventos nativos load/error e a decodificação da candidata carregada. Se decode rejeita com a imagem ainda incompleta, continua esperando sua substituta. Um AbortController local encerra os listeners e promessas de imagem em cancelamento/deadline. Mantém a seleção de imagens pertinentes, limite8s, cancelamento da transação, correção±2 px e autoridade server existentes.

| SHA256 do helper                     | Hash                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| Antes, fonte do combinado que falhou | `9AD2913983EA53BFBAA811EFF4C86890EF3EEA8B71C781489F729CC5860A9223` |
| Depois, fonte do GREEN final         | `E770ABB075A84EABC6B7AE8354AA40BE0EBC96352AF077BE202201774CD917D2` |

Os testes de controller no jsdom passaram a representar a flag estática como já carregada, pois esse ambiente não tem loader de recursos. A imagem incompleta permanece no unit específico e nos browsers reais; não foi substituída por um mock no E2E. O GREEN focado foi16/16 em três arquivos. Os dois caminhos reais de imagem, com as asserções originais e sem diagnóstico, passaram em três repetições cada:6/6,41,2s, BuildID `xmxI9njBKSKP_IyVNkV16`. O lote final63/63 veio depois disso, não como retry mascarado.

## Logs e identidade final

| Artefato em work/stage2-briefs                              | Resultado                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `E2-reading-expanded-install.log`                           | Três adições instaladas após hashguard; primeiro E2E intacto   |
| `E2-reading-matrix-first.log/result.json`                   | 8/8 existentes, exit0                                          |
| `reading-edges-first-failure/`                              | 13 passes; suposição de evento do teste, não RED de produção   |
| `E2-reading-edges-observation-repeat.log/result.json`       | 24/24, exit0                                                   |
| `reading-combined-image-failure/`                           | 62 passes/1 falha real de prontidão da imagem                  |
| `reading-image-decode-evidence/`                            | Captura, mídia real, candidatas e rejeição nativa antes do fix |
| `E2-reading-responsive-image-unit-red.log`                  | 2 falhas/6 passes antes de produção                            |
| `E2-reading-responsive-image-unit-green.log`                | 16/16 após fix                                                 |
| `E2-reading-responsive-image-green.log/result.json`         | 6/6 imagem repetida sem diagnóstico                            |
| `E2-reading-responsive-image-{types,lint,format}-final.log` | exit0; sem warnings                                            |
| `E2-reading-public-final.log/result.json`                   | **63/63, exit0**,22:48:31.5904075Z–22:49:37.8792455Z           |
| `E2-reading-public-final-closure.json`                      | Source freeze e serviços encerrados                            |

Manifest final `E2-reading-public-final-source-hashes.json`: **446 arquivos de src/testing/configs selecionados**, SHA256 **`C48148B97963E89197487B9ED21C91BBED820F0C5948395E930926DAF8A5B545`**. Conferência pósrun: **zero mudanças**. Esse escopo é explicitamente menor que o snapshot geral do coordenador; não os confundir. `E2-reading-public-final-owned-hashes.json` e `E2-reading-final-owned-source/` guardam as seis fontes próprias finais.

Primeiro E2E original: SHA256 **`76DDFC23303EFA8B11E271115F1FA6377A157F9FD11D9DA8DD8D68A8E6FFA09A`**, igual à instalação. Não foram executados os E2Es A1 antigos que sobrescrevem PNGs imutáveis. Não houve install/dependência/lockfile, migração/modelo novo, Git, Native legacy/typed/seed ou mudança de Root/server authority neste ciclo.

## Janela e limites

O harness encerrou Next e removeu somente `postgres-test`/tmpfs próprio ao final de cada invocação. A checagem final mostrou3100/55433 livres; o container preexistente `postgres-local` em5432 permaneceu intacto e55432 não foi iniciado. Variáveis de teste foram limitadas aos processos filhos; nenhum arquivo .env foi editado. O lease exclusivo foi devolvido ao coordenador após registrar o63/63 e a limpeza, antes deste fechamento C-only.

A fonte de estresse é uma TTF local existente, servida somente por rota interceptada do Playwright, sem adicioná-la ao aplicativo/build/dependências. O site real segue com fontes do sistema. A prova mostra FontFace nativa loading→loaded/deadline, não uma webfont de produto. No deadline, o teste observa ausência de chamadas programáticas tardias; não confunde scroll anchoring nativo após mudança de métricas com ação do controller.

Não se alega comparação visual Figma, auditoria a11y/leitor de tela completa, desempenho de produção, deploy, conclusão do gate integral ou A2. O coordenador continua responsável pelo gate fresco e pelos demais critérios. A frente fica congelada, sem novas escritas em E: depois da devolução do lease.
