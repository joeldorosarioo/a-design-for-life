# Verificação visual — candidata 008 / V9

A comparação visual e a responsividade atuais estão concluídas. O pacote de revisão V1 foi conferido e entregue; o estado formal é **96,7%, 29/30**, com E2.1–E2.5 inteiramente encerradas e leitor formal interrompido pelo usuário. A etapa 3 continua aguardando aprovação expressa de A2.

## Identidade atual

BuildID `XCwWNaSVVZ2kr6jeLy4Aa`; fonte local de 500 arquivos, SHA-256 `f49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784`; fixture privada V5 restaurada após os gates 003. Os wrappers V9 verificaram build/fonte antes e depois. O coordenador vinculou o único Next 3100 à compilação 008 após o restore real.

São 18 alvos: Home, Sobre e listagem PT/EN, Case 01 PT/EN e Case 02 somente EN, em 1440×900 e 390×844, DPR 2. Os modelos continuam rascunhos; não há case PT inventado para o segundo modelo. As cinco imagens originais canônicas, capturas históricas, checkpoints e dados foram preservados.

## Capturas e comparação

As **18 PNGs V9 foram capturadas novamente na candidata 008**. Nomes, hashes, dimensões e DPR foram conferidos no manifesto atual `visual-qa-v9/final18-visual-qa-manifest.json`, com os recibos de execução. Todas são byte-idênticas às 18 PNGs 007 já revisadas por componentes; essa igualdade exata permite reutilizar a inspeção visual anterior explicitamente. Nenhum arquivo 007 foi renomeado como uma captura 008.

A comparação não se baseou em limiar arbitrário de diferença. A identidade atual foi validada e o manifesto registra a relação com a revisão 007. As revisões 003–006, inclusive falhas, continuam históricas e não recebem outro BuildID. Integridade de imagem não prova banco/auth: esses pontos têm os recibos Native/restore e smoke separados.

A geometria atual passou **982/982 verificações em 18 alvos**, incluindo fluxo das seções, divisórias, comparações, cards e seis regressões reais do sumário. O mínimo de 400×266 dos métodos desktop foi confirmado, permitindo crescimento com texto editado. Não se força uma altura total de página para esconder diferenças aprovadas.

## Responsividade

**81 cenários**, nas larguras 320, 390, 640, 768, 820, 1024, 1280, 1440 e 1536 px: 0 falhas, 0 erros de página e 0 overflow normal. Foram examinadas 27 condições de texto a 200%, 27 de texto longo temporário, 27 de forced-colors e 18 menus, com movimento reduzido. Emulação de mídia e redimensionamento de texto não são zoom real do navegador.

O percurso manual atual008 usou Chrome a 200% real: reflow para menu, foco, Escape/retorno, Sobre PT, contato no mesmo pathname abaixo do header e CTA final. Voltou a 100% e encerrou a janela própria, exit 0. Limites e prova estão em `manual-ui-observations-candidate008.json`; não se atribui essa observação ao 006/007.

## Decisões e correções preservadas

Uma única fonte original por imagem, recortes/dimensões por CSS, Next.Image público e transporte privado autenticado. Header sticky, destinos fixos, menu móvel e três contatos aprovados permanecem. Textos editoriais e rótulos são editáveis em apresentações fechadas; LF autoral é preservado pelo painel Native. Cards mantêm os campos opcionais aprovados e fallback independente. O sumário mantém âncoras estáveis e deriva os títulos reais.

As correções verificadas incluem tipografia de narrativa/descrições/pullquotes, espaçamentos de Home, grid/altura dos métodos, slots do footer, capa clara do Case 02, comparação móvel, fluxo dos aprendizados, divisórias e CTA final de Sobre. Os recortes já coincidentes não foram substituídos. Tokens e medidas vieram de propriedades/bytes das referências; não foram criados ativos ou conteúdo profissional.

## Duas diferenças menores nomeadas

- Primeiro parágrafo Percurso/Sobre PT móvel: 9 linhas na referência e 8 na pilha atual. A fonte 18/28 e a largura 342 px foram confirmadas; não há prova de LF autoral. Preservar a pilha aprovada e os parágrafos EN coincidentes.
- Descrição Home EN desktop: uma palavra muda de linha por limiar de métricas. Preservar largura 736 px, pilha e texto; não inserir LF nem reduzir a coluna para forçar uma quebra.

São diferenças de quebra documentadas, não uma declaração de identidade integral com o Figma. A identidade das 18 PNGs refere-se ao par 008 atual versus 007 revisado, mantendo explicitamente esses resíduos e as diferenças de produto já aprovadas.

## Gates e limites da entrega

Gates 003 locais: verify exit 0, 1.164 passes/2 skips Windows/144 arquivos, mais 2 testes de CSS; E2E exit 0, 113/113. CI do commit `c9be4dc23c12f45fadd27cafc05a599b8b3a0c44`, run 41655739795, Ubuntu 24.04: SUCCESS, 1.166 passes/0 skips/144 arquivos, 2 testes de CSS e 113 E2E. O CI vincula o commit exato; o digest local é registrado separadamente.

Restore real 003: 10 rascunhos, 7 mídias Native, Root nulo, 0 operações públicas, 28 objetos e SQL de dados coincidente. Smoke008/004 passou 18 HTML/5 mídias/9 menus/2 capas claras, sem escritas. Falhas 001–003 do smoke eram precondições do helper, não RED da aplicação.

O primeiro snapshot revisado é `A2-review-c9be4dc-v2`, com QA real aprovada. A entrega final usará `outputs/A2` depois de documentos B/CI; o SHA e a prova exata ficam no recibo externo `outputs/A2-entrega.json`. Não afirmar existência desses destinos finais antes da geração real. Sem publicação de produção, analytics, contratação ou etapa 3. Nenhum resultado visual substitui leitor de tela ou conformidade WCAG.
