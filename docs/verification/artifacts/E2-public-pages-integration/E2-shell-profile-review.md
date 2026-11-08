# E2 — revisão de Home/Sobre e shell

30/10/2026. Etapa2: **16,7% (1/6; E2.1 concluída)**. Revisão inicialmente somente por leitura. O coordenador aceitou o achado abaixo e autorizou corrigir exclusivamente `profile-image.tsx` e seu teste adjacente, com RED/GREEN focado. Nenhum outro arquivo do app foi alterado por esta revisão; não executei Git, DB, Next, instalação, build ou runner global.

## Achado e correção

### [P2 — corrigido] Prévia de imagem de rascunho usava a rota pública

Local: `E:/a-design-for-life/src/features/professional-profile/components/profile-image.tsx:25` (seleção de origem) e34 (modo sem otimizador). Regressão: `src/features/professional-profile/components/profile-image.test.tsx:31–39`.

Antes, `mediaMode="preview"` somente definia `unoptimized=true`, mas o `src` continuava `/media/{id}/original`. Essa rota concede bytes pela raiz pública confirmada, mesmo para um editor autenticado. Assim, um retrato ou uma fotografia de mesa/arquitetura usado somente no rascunho não aparecia na prévia autenticada: o navegador pedia a entrada pública e recebia404. Desabilitar o otimizador não muda a política de autorização da rota. O teste adjacente incorporava a mesma expectativa incorreta.

A correção mínima seleciona `/preview-media/{id}/original` somente em modo preview e conserva `/media/{id}/original` em published. `unoptimized={mediaMode === 'preview'}` permanece, mantendo a origem autenticada fora do otimizador anônimo. Não foi criado outro arquivo ou variante de imagem, URL de storage, novo endpoint ou alteração de grants. HomeContent/AboutContent já encaminham `mediaMode` ao componente.

**Teste observado:** alterei primeiro somente a expectativa da prévia para a rota autenticada. RED real:1 falha/3 passes, esperado `/preview-media/.../original`, recebido `/media/.../original`. Após a alteração mínima do src:GREEN4/4. O primeiro teste conserva a expectativa independente de `/media/.../original` para published; o teste da prévia também exige ausência de srcset. O Next Image real é renderizado no teste, sem mock de sua URL.

| Comando executado com Node portátil24.22.2, no app | Resultado e log em work/stage2-briefs |
| --- | --- |
| node node_modules/vitest/vitest.mjs run --project unit src/features/professional-profile/components/profile-image.test.tsx, antes do fix | exit1,1 falha/3 passes; E2-profile-preview-route-red.log |
| Mesmo comando, depois do fix | exit0,4/4; E2-profile-preview-route-green.log |
| node node_modules/eslint/bin/eslint.js, somente os dois arquivos | exit0, sem saída; E2-profile-preview-route-lint.log |
| node node_modules/prettier/bin/prettier.cjs --check, somente os dois arquivos | exit0; E2-profile-preview-route-format.log |

Um guard inicial de edição procurou quebras CRLF, não encontrou o bloco e abortou sem escrever; a edição seguinte preservou as quebras existentes e mudou somente a expectativa autorizada. Isso não é RED comportamental. Os testes acima não iniciaram DB/Next. O gate global anterior informado pelo coordenador permanece histórico para esta correção; um gate posterior do estado combinado continua com ele.

**Teste integrado sugerido para o gate posterior:** mídia real usada somente no rascunho de Perfil, fora da raiz pública; prévia autenticada de Home/Sobre deve pedir `/preview-media/{id}/original` diretamente e receber200/no-store com alt/caption do uso editorial. A mesma URL sem sessão deve negar acesso, a entrada `/media/...` deve continuar404 e não deve haver pedido `/_next/image` para essa imagem privada. Conferir também que o modo publicado usa a origem pública e a guarda de otimização composta. Esse HTTP/browser não foi executado aqui.

Não encontrei outros achados acionáveis na inspeção delimitada do shell e dos componentes de Perfil.

## Limites e fontes da revisão

Revistos: HomeContent, AboutContent, ProfileImage e testes adjacentes; os dois stylesheets de Perfil; suas entradas `ui.ts` e `index.ts`; SiteHeader, SiteFooter, MobileMenu e testes adjacentes; stylesheet da navegação; suas entradas `ui.ts` e `index.ts`; Sheet/Radix e seu stylesheet; Button/CVA e globals; schemas de DTO/contatos/navegação resolvida e resolvedor para rastrear os valores consumidos. A inspeção considerou escaping de texto, origem dos hrefs, caminho runtime servidor/cliente, composição Radix, teclado/foco, contato na página atual, currículo em nova aba, proporções/sizes e responsividade pelo CSS. Nenhum defeito adicional foi demonstrado nesses pontos. As entradas compartilháveis de schemas permanecem separadas das entradas UI; não encontrei caminho dessas entradas para providers/servidor na cadeia inspecionada.

Referências lidas: AGENTS e execução atual; spec/inventário Figma e requisitos de privacidade/idioma/acessibilidade; `docs/architecture/fronteiras.md`, `mapeamento-figma.md` e `midias-privadas.md`; `work/stage2-reference/home-about-layout-brief.md`, `home-about-layout.json` e `mobile-shell-reference.json`; handoffs E2.2 de shell/navegação. Foram vistos os PNGs já arquivados `baselines/home-pt-desktop-123-574.png` e `baselines/about-en-mobile-134-13435.png`, com redimensionamento apenas de exibição pela ferramenta. Não houve nova exportação, screenshot ou transformação de ativo.

As referências registram medidas parciais: por exemplo, tipografia/gaps do hero e várias colunas ainda não foram medidos. O CSS já identifica esses valores como provisórios. Sem uma renderização integrada atual, não os converti em supostos desvios Figma nem declarei equivalência visual. O layout móvel de Sobre preserva a sequência textual/fotográfica observada no baseline; a substituição do antigo header de três links por menu com quatro finalidades é uma diferença funcional explicitamente aprovada.

A revisão não executou navegador, axe, viewport/texto ampliado, leitor de tela, contraste computado ou medição de performance. Não demonstra o foco/scroll real após contato, mudança de breakpoint com dialog aberto, restauração de foco em todos os navegadores, hidratação, zero overflow sob conteúdo longo, LCP, imagem otimizada na configuração final ou fidelidade de pixels. Testes de interação adjacentes foram lidos, não repetidos aqui. O componente fixado foi verificado somente pelo teste focado acima.

O coordenador informou gate anterior729 testes+2skips/build e33 regressões de navegador; esses resultados não foram executados por esta revisão, não cobrem automaticamente o fix posterior e não comprovam Home/Sobre localizadas ainda sem integração. Mesma geração de status/corpo/nav/metadata, o handoff Proxy/RSC, provider de prévia, autorização da mídia e o controle de idioma continuam dependentes da composição. Nenhum aceite visual, conclusão E2.2/E2.6 ou aprovação A2 decorre deste relatório.

## Identidade dos arquivos corrigidos

| Caminho relativo ao app | SHA256 após GREEN/lint/formato |
| --- | --- |
| src/features/professional-profile/components/profile-image.tsx | 42DD3D48AE0537BC5B9944715846D59FB8B6AB926827CF8F271543D4FCB19564 |
| src/features/professional-profile/components/profile-image.test.tsx | DDF0DE9028DD5294377A5B246E076D908F0D609EA9FAC3504E74C9DCDAC09635 |

Estado desta revisão: **um P2 identificado e corrigido no recorte autorizado; nenhum outro achado acionável aberto**. O fix e sua evidência focada estão prontos para o gate combinado posterior do coordenador.
