# E2.1 — mapeamento da referência Figma

Etapa 2 em 0% (0/6); fundação em revisão. Fonte normativa: [inventário aprovado](../specs/2026-10-29-portfolio-inventario-figma.md), arquivo `PXUcVZFdLuOzHQZkD5PU4b`, página `03 · Layout proposto` (`123:179`). Nenhuma página alternativa redefine o visual.

## Tokens e aliases

`src/stylesheets/tokens.css` traduz o frame `123:1155`: Cherry Cola 950/900/700/500/100 = `#16030A/#4E0B1C/#A3122F/#F0476A/#FFC9D4`; branco = `#FFF`. O tema Tailwind é reiniciado com `--*: initial` para não adotar a paleta, tipografia ou animações padrão do shadcn. Não há tema escuro inferido.

| Aliases da referência                      | Tokens semânticos de consumo                     |
| ------------------------------------------ | ------------------------------------------------ |
| bg/page, text/primary                      | background, foreground                           |
| bg/surface, text/primary                   | card/popover, card-foreground/popover-foreground |
| action/background, action/on-background    | primary, primary-foreground                      |
| action/soft, text/secondary                | secondary, secondary-foreground                  |
| bg/subtle, text/secondary                  | muted, muted-foreground                          |
| accent/editorial, accent/text              | accent, accent-foreground                        |
| border/default, border/control, focus/ring | border, input, ring                              |

Os aliases completos do inventário permanecem em `:root`, inclusive bg/inverse, text/inverse, accent/border e action/hover. Não se inventou um token destructive sem referência. Stacks locais: sistema (`system-ui`, fallbacks de plataforma, Segoe UI no Windows) e Georgia com fallbacks serifados; o contrato de famílias é documentado, mas a sequência literal de fallbacks do Figma ainda não foi extraída. Sem fonte externa.

A escala tipográfica inteira usa rem: 12/16, 14/20, 16/24, 18/28, 20/28, 24/32, 30/36, 36/40, 48/48, 60/60 e 72/72 px na raiz16. Peso400 documentado, peso600 comprovado para Button no contexto oficial. Espaçamento0,25rem e escala4/8/12/16/24/32/48/64/80/96px; raios4/6/8/12/16px; full reservado às apresentações circulares previstas. Breakpoints640/768/1024/1280/1536px. Contêiner fluido máximo1280px, laterais24px e margem resultante80px em1440; gap32px e seções64px centralizados. Não há alturas de página fixas.

## Conferência e decisão de composição

Não existiam `src/components/ui`, tokens públicos ou primitivas reutilizáveis no repositório base `4f72388`. O catálogo atual [Button do shadcn](https://ui.shadcn.com/docs/components/base/button) e [CVA variants](https://cva.style/docs/getting-started/variants) foi consultado em30/10/2026. O Button da referência é um controle nativo simples; adotar Base UI/Slot, seis variantes e tamanhos padrão introduziria dependências e valores não necessários. A composição própria mantém o padrão CVA de variantes fechadas e props nativas; `buttonVariants` permite estilizar links preservando sua semântica. Não há `asChild`, schema CMS ou biblioteca de animação em Button.

| Componente               | Origem comprovada                                                     | Implementação e limite                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button Secondary/Default | catálogo `123:286`, instância `123:274` no contexto oficial do casePT | Branco, borda100, texto700, Segoe60016/24, gap8, padding24×12, raio8. Largura208 pertence ao exemplar; a primitiva dimensiona pelo conteúdo, sem impor largura fixa. Altura50px deriva de linha24+padding24+borda2.                                                                                                                                                                                       |
| Button hover/focus       | conferência normal do Figma em30/10, `123:286`                        | Secondary hover usa fundo100; foco visível700. Foco 2px/offset 2px segue a medida documentada; a anotação legada violeta é descartada em favor do alias aprovado focus/ring700. O exemplar Secondary Focus tem altura48, enquanto Default/Hover têm50; manter a base50 e usar outline preserva o layout durante o foco. Pressão/disabled são estados nativos do produto, sem alegar variantes desenhadas. |
| Demais composições       | catálogo documentado no inventário                                    | Navigation, cards, section heading, footer, seletor, retrato e editorial serão compostos quando usados nas jornadas. Este marco não cria14abstrações nem variantes não extraídas.                                                                                                                                                                                                                         |
| Movimento                | contrato E2.1 e motion-foundations                                    | Presets fechados button/menu/toast; início visível; feedback e saída somente transform/opacity. Valores de engenharia centralizados, sem alegar keyframes extraídos do Figma.                                                                                                                                                                                                                             |

## Proveniência e ativos

A pesquisa de referência preservou `work/stage2-reference/README.md`, `official-case-pt-desktop-context.txt` e `assets-manifest.json` no workspace do chat, com origem/node, dimensões, bytes e hashes. A consulta oficial nova foi recusada pela quota Starter; não houve upgrade nem API interna. O contexto oficial anterior do casePT foi reutilizado e os18frames do inventário foram vistos pela interface normal. Renders do editor e screenshots de páginas são referência visual, nunca assets de implementação.

Lacunas concretas, registradas **antes de qualquer uso afetado**: retrato original e crops; fotos originais de mesa/arquitetura; capa do projeto02; bandeiraEN/variantes vetoriais; exportação de todos os originais e vínculos internos dos componentes. A capa PNG disponível foi devolvida pelo contexto oficial, sem prova de ser o upload bruto original. Cinco ativos exatos do contexto anterior foram preservados pela pesquisa; nenhum foi incorporado à aplicação ou enviado ao CMS nesta fundação. O manifesto de referência permite continuar a conferência sem apresentar uma lacuna como concluída.

A implementação E2.1 usa somente tokens e Button comprovados; não depende desses ativos. O aceite de exportação integral e comparação de telas permanece pendente para o gate coordenado. SVG aprovado de código segue regra separada de upload: uploadSVG no CMS permanece permanentemente proibido. PDFs e conteúdo demonstrativo não se tornam públicos.
