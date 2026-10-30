# Inventário de referência do portfólio

29 de outubro de 2026. Complemento da [spec principal](2026-10-29-portfolio-spec-v1.md).

Este inventário registra os frames, componentes e valores documentados no Figma. Não é uma exportação dos ativos nem comprova as propriedades internas de todos os nós. Exportação de originais, vínculos de variáveis e comparação visual pertencem à preparação e validação da implementação.

## Fonte e interpretação

- Arquivo: `PXUcVZFdLuOzHQZkD5PU4b`.
- Layout aprovado: página `03 · Layout proposto`, node `123:179`.
- Referências auxiliares: `01 · Tokens`, node `123:177`, e `02 · Componentes`, node `123:178`.
- Páginas Referência, Eliana · Proposta 02 e Eliana · Design + motion não substituem a página aprovada.
- Os valores abaixo foram lidos da documentação visível e da árvore de camadas pelo navegador. Nomes das camadas podem permanecer em português em frames ingleses; não são transcrição garantida dos textos renderizados.
- As cores e medidas documentadas são referência do projeto. O nome do frame de tokens menciona Tailwind CSS v4.1.18; isso não substitui a política de validar as versões das dependências antes de implementar.
- As variantes inventariadas são claras. Não criar outro tema por inferência.

Para abrir uma referência, usar `https://www.figma.com/design/PXUcVZFdLuOzHQZkD5PU4b/Untitled?node-id=ID`, substituindo `:` por `-` no ID abaixo.

## Frames de layout

| Página | PT desktop | PT mobile | EN desktop | EN mobile |
|---|---|---|---|---|
| Home | `123:574` | `123:705` | `125:3765` | `125:4026` |
| Listagem de cases | `125:2472` | `125:2595` | `125:4291` | `125:4490` |
| Detalhe de case | `123:838` | `123:954` | `125:4693` | `125:4961` |
| Sobre | `134:13116` | `134:13205` | `134:13298` | `134:13435` |

Há um segundo exemplo de case em inglês: desktop `126:8101` e mobile `126:8293`. Ele é uma referência adicional de conteúdo/apresentação, não uma nova rota ou novo tipo de página. A árvore inspecionada não apresentou uma variante PT correspondente desse segundo exemplo.

## Estrutura das páginas

### Home

Navegação; apresentação principal com retrato; projetos; Sobre e trajetória; abordagem; footer. A apresentação usa identificação profissional, título com dois tratamentos tipográficos, descrição e ação para projetos. Projetos usam os mesmos dados editoriais dos cases destacados, sem uma cópia independente dos cards no CMS.

### Listagem

Navegação; abertura da página; lista de cases; footer. A abertura inspecionada contém retorno à Home, identificação editorial, título, descrição e contagem. A contagem deriva dos cases publicados no idioma atual, não de um campo manual. A composição é de duas colunas no desktop de referência e leitura vertical no mobile.

### Detalhe de case

Navegação; abertura; narrativa/sumário; footer. A abertura contém retorno à listagem, identificação do estudo, título, descrição, capa e nota de contexto. A narrativa inclui contexto, papel/escopo, desafio, processo, proposta/comparação e aprendizados. O desktop apresenta sumário junto ao artigo; no mobile há um grupo próprio de navegação do case antes da narrativa. Referência dos metadados papel/escopo: `125:4710`.

Títulos, ordem e entradas do sumário devem refletir o conteúdo efetivo. Identificadores de leitura precisam ser estáveis para atender à troca de idioma já aprovada. O sumário é apresentação/navegação do artigo, não autoriza um construtor livre de layouts.

### Sobre

Navegação; artigo editorial; footer. A estrutura inspecionada inclui abertura, introdução com retrato, percurso, fotografia de mesa, pausa editorial, abordagem com fotografia de arquitetura, seção Em movimento, encerramento e acesso aos cases. Os nomes dessas seções orientam campos estruturados em Perfil profissional; não representam novas páginas.

### Elementos globais e alterações aprovadas

- Header final: Projetos, Sobre, Currículo e Contato, nessa ordem, nos dois idiomas e no menu mobile.
- Abordagem sai do header; a seção da Home permanece.
- Contato aponta para `#contact` no footer da página atual. A lista usa e-mail e LinkedIn conforme aprovado; não criar formulário.
- Currículo abre o PDF publicado do idioma atual em nova aba, com indicação acessível.
- A edição do CMS não pode fornecer CSS nem alterar a finalidade desses destinos.
- Os trechos demonstrativos, instruções de preenchimento e rótulos como Sample template ficam em rascunho até revisão do conteúdo final.

## Catálogo de componentes

| Componente no Figma | Node | Responsabilidade no site |
|---|---|---|
| Consolidado / Button | `123:286` | Ações e links com aparência de botão |
| Consolidado / Navigation | `123:332` | Header e controles de navegação |
| Consolidado / Project card | `123:433` | Apresentação de case em listagens/destaques |
| Consolidado / Section heading | `123:485` | Identificação, título e descrição de seção |
| Consolidado / Method card | `123:494` | Conteúdo estruturado da abordagem |
| Consolidado / Trajectory item | `123:519` | Item de trajetória |
| Consolidado / Footer | `123:553` | Encerramento e acesso aos contatos |
| Consolidado / LanguageToggle | `125:1870` | Seletor de idioma |
| Consolidado / Portrait | `125:2085` | Retrato e sua apresentação responsiva |
| Consolidado / Case contents item | `134:12782` | Entrada do sumário de case |
| Consolidado / Case contents | `134:12845` | Navegação interna do case |
| Consolidado / Editorial paragraph | `138:13666` | Texto editorial |
| Consolidado / Editorial photograph | `138:13671` | Fotografias editoriais |
| Consolidado / Editorial emphasis | `138:13672` | Ênfase editorial predefinida |

Documentação visual geral: `123:264`. Antes de criar cada componente, verificar o projeto e o catálogo atual do shadcn/ui. Esse mapeamento identifica responsabilidades; não exige criar quatorze abstrações nem reproduzir literalmente a organização interna do Figma.

## Tokens documentados

Frame de documentação: `123:1155`.

### Paleta Cherry Cola

| Token | Valor |
|---|---|
| `cherry-cola-950` | `#16030A` |
| `cherry-cola-900` | `#4E0B1C` |
| `cherry-cola-700` | `#A3122F` |
| `cherry-cola-500` | `#F0476A` |
| `cherry-cola-100` | `#FFC9D4` |

Aliases do tema claro:

| Uso | Valor de referência |
|---|---|
| `bg/page`, `bg/surface` | White |
| `bg/subtle`, `action/soft`, `accent/editorial` | `cherry-cola-100` |
| `text/primary` | `cherry-cola-950` |
| `text/secondary`, `accent/text` | `cherry-cola-900` |
| `border/default` | `cherry-cola-100` |
| `border/control`, `accent/border`, `focus/ring` | `cherry-cola-700` |
| `action/default`, `action/background` | `cherry-cola-700` |
| `action/hover` | `cherry-cola-900` |
| `action/on-background`, `text/inverse` | White |
| `bg/inverse` | `cherry-cola-900` |

Mapear os aliases para os tokens semânticos usados pelos componentes shadcn. Validar contraste no uso concreto: a existência de um token na referência não comprova conformidade de todas as combinações. Mudanças visuais relevantes continuam sujeitas ao processo aprovado.

### Tipografia

A documentação identifica `font-sans` como uma stack de sistema, representada por Segoe UI no Windows, e `font-serif` como stack serifada com Georgia para a ênfase editorial. Preservar o contrato CSS de famílias da referência; não substituir por fontes externas por iniciativa do agente. As conversões abaixo assumem raiz de 16 px; preservar unidades relativas e zoom do usuário.

| Escala | Tamanho de referência | Entrelinha |
|---|---|---|
| `text-xs` | 12 px | 16 px |
| `text-sm` | 14 px | 20 px |
| `text-base` | 16 px | 24 px |
| `text-lg` | 18 px | 28 px |
| `text-xl` | 20 px | 28 px |
| `text-2xl` | 24 px | 32 px |
| `text-3xl` | 30 px | 36 px |
| `text-4xl` | 36 px | 40 px |
| `text-5xl` | 48 px | 48 px |
| `text-6xl` | 60 px | 60 px |
| `text-7xl` | 72 px | 72 px |

Aplicar os tamanhos aos papéis e variantes que o layout usa, sem tornar a escala inteira selecionável no CMS. O espécime documenta peso normal; demais pesos usados por um componente precisam ser conferidos na referência durante sua implementação.

### Espaçamento, raios e responsividade

- Unidade de espaçamento: `0.25rem`, equivalente a 4 px com raiz de 16 px.
- Escala central documentada: 4, 8, 12, 16, 24, 32, 48, 64, 80 e 96 px.
- Raios: sm 4 px; md 6 px; lg 8 px; xl 12 px; 2xl 16 px. `rounded-full` é reservado às apresentações circulares previstas.
- Breakpoints mínimos documentados: sm 640 px; md 768 px; lg 1024 px; xl 1280 px; 2xl 1536 px.
- Desktop de referência: viewport 1440 px, conteúdo máximo 1280 px, margens resultantes de 80 px, intervalo entre colunas de 32 px e espaçamento de seções de 64 px.
- Mobile de referência: viewport 390 px, padding lateral 24 px, largura útil 342 px, leitura em uma coluna.
- Esses frames não autorizam larguras fixas que quebrem em telas intermediárias. Verificar tablet, zoom e conteúdo longo, preservando as regras responsivas aprovadas.

## Estados e ativos na implementação

Estados exigidos pelos contratos do produto: teclado/foco, hover e pressão onde aplicáveis; menu mobile aberto/fechado; troca de idioma; toast de tradução ausente; ausência de cases publicados; case indisponível; falha temporária; prévia autenticada; rascunho/alterado/publicado no CMS; erro de publicação; recuperação de senha. A lista é um contrato funcional, não a afirmação de que todos esses estados foram desenhados no Figma.

Usar os componentes nativos e os tokens aprovados para estados convencionais. Documentar estados sem desenho específico durante a implementação, sem criar novas páginas, animações ou conteúdo profissional fictício.

Ativos identificados: retrato; fotografias editoriais de mesa e arquitetura; capas e imagens de projetos; ícones/vetores de interface e indicação de idioma. Exportar e conferir os originais a partir das referências, preservando proporção, qualidade, finalidade e acesso. SVG continua proibido como upload no CMS; vetores aprovados usados pelo código seguem a regra separada da spec.

O inventário não inclui PDFs finais, arquivos exportados, métricas de desempenho ou prova de equivalência pixel a pixel. Essas entregas têm seus próprios critérios de aceite e não exigem repetir decisões já aprovadas.
