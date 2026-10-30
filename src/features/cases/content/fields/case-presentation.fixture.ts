import type { CaseInput } from '../../contracts/case.schema';
import type { RichText } from '../../contracts/rich-text.schema';

const element = { version: 1 as const, direction: null, format: '' as const, indent: 0 as const };
const leaf = (text: string) => ({
  type: 'text' as const,
  version: 1 as const,
  text,
  detail: 0 as const,
  format: 0,
  mode: 'normal' as const,
  style: '' as const,
});
export function editorialText(paragraph: string, bullets: string[] = []): RichText {
  return {
    root: {
      ...element,
      type: 'root',
      children: [
        { ...element, type: 'paragraph', children: [leaf(paragraph)] },
        ...(bullets.length
          ? [
              {
                ...element,
                type: 'list' as const,
                listType: 'bullet' as const,
                tag: 'ul' as const,
                start: 1,
                children: bullets.map((text, index) => ({
                  ...element,
                  type: 'listitem' as const,
                  value: index + 1,
                  children: [leaf(text)],
                })),
              },
            ]
          : []),
      ],
    },
  };
}
// Read-only reference 123:838. This fixture is always a private, illustrative draft.
// UUIDs identify editorial correspondence, never Figma nodes or array positions.
export function illustrativeCaseDraft(): CaseInput {
  return {
    _status: 'draft',
    locale: 'pt',
    eyebrow: 'CASE ILUSTRATIVO · PROJETO MODELO 01',
    title: 'Uma jornada',
    titleEmphasis: 'mais simples.',
    introduction:
      'Uma proposta para organizar um fluxo em etapas, esclarecer escolhas e dar continuidade à experiência.',
    contextNote:
      'Case ilustrativo. Cenário, comparação e processo servem como estrutura editorial; valide e substitua pelo conteúdo do seu projeto.',
    role: 'Preencha sua atuação e diferencie sua contribuição do trabalho da equipe.',
    scope: 'Estrutura do fluxo, hierarquia do conteúdo e proposta de interface.',
    sections: [
      {
        readingKey: 'd1d2e0f6-c7dd-46f3-b600-a38904464ca1',
        presentation: 'narrative',
        eyebrow: 'CONTEXTO',
        heading: 'O projeto em perspectiva',
        description:
          'O cenário proposto é uma jornada digital com informações distribuídas entre várias etapas. O exercício explora como apresentar o necessário em cada momento sem perder a visão do conjunto.',
        blocks: [],
      },
      {
        readingKey: '91659d3f-281e-473d-8b72-93963555a6bd',
        presentation: 'narrative',
        eyebrow: 'DESAFIO',
        heading: 'Como tornar a próxima ação evidente?',
        description:
          'A hipótese deste exemplo é que uma sequência clara, com orientações próximas às decisões, pode reduzir dúvidas durante o percurso.',
        blocks: [
          {
            readingKey: '3935fc88-53a6-44b9-a892-160039b022d0',
            blockType: 'text',
            content: editorialText('', [
              'O que a pessoa precisa saber para avançar?',
              'Quais informações podem aparecer em outro momento?',
              'Como manter contexto e permitir revisão?',
            ]),
          },
        ],
      },
      {
        readingKey: '50201f81-7491-4812-9321-f73a289324c4',
        presentation: 'process',
        eyebrow: 'PROCESSO',
        heading: 'Da leitura do fluxo à proposta de interface.',
        blocks: [
          {
            readingKey: 'e2c4809a-e4b2-4a7c-b07c-70e68f3caf3e',
            blockType: 'text',
            heading: 'Mapear o percurso',
            content: editorialText(
              'Organizar etapas, conteúdo e decisões. Separar problemas observados de hipóteses que ainda precisam de validação.',
            ),
            note: 'Artefato sugerido: Mapa do fluxo com pontos de atenção.',
          },
          {
            readingKey: 'bb72532f-4581-41cd-b15b-39b4c2a35dfa',
            blockType: 'text',
            heading: 'Explorar alternativas',
            content: editorialText(
              'Comparar formas de agrupar informações e orientar ações. Explicar os critérios usados para escolher uma direção.',
            ),
            note: 'Artefato sugerido: Esboços e comparação entre caminhos.',
          },
          {
            readingKey: '6856ca7e-7981-482e-b14f-94023d71762c',
            blockType: 'text',
            heading: 'Detalhar e avaliar',
            content: editorialText(
              'Refinar hierarquia, conteúdo e estados da interface. Definir como a proposta será avaliada antes de afirmar seus efeitos.',
            ),
            note: 'Artefato sugerido: Protótipo e perguntas de avaliação.',
          },
        ],
      },
      {
        readingKey: 'fffb7adb-c07c-4fa9-a497-66119d8165c3',
        presentation: 'comparison',
        eyebrow: 'COMPARAÇÃO ILUSTRATIVA',
        heading: 'Uma mudança na ordem de leitura.',
        description: 'O conteúdo necessário permanece. A hierarquia passa a orientar o percurso.',
        note: 'Exemplo visual, sem resultados de teste ou métricas associados.',
        blocks: [
          {
            readingKey: '3a0cb6b9-6b38-4e6f-b95a-754c14f4cd8a',
            blockType: 'text',
            eyebrow: 'ANTES · CENÁRIO INICIAL',
            heading: 'Informações competem por atenção',
            content: editorialText(
              'Conteúdo de várias etapas aparece ao mesmo tempo, com ações de peso semelhante.',
              [
                'Instruções separadas dos campos',
                'Próxima ação com pouca distinção',
                'Progresso sem indicação clara',
              ],
            ),
          },
          {
            readingKey: '76ece55e-646d-420a-bf74-d0b5d5198b7f',
            blockType: 'text',
            eyebrow: 'DEPOIS · PROPOSTA',
            heading: 'Cada etapa tem uma prioridade',
            content: editorialText(
              'O conteúdo é agrupado por decisão, com orientação próxima ao ponto de uso e uma ação principal evidente.',
              [
                'Orientações junto aos campos',
                'Ação principal com hierarquia',
                'Etapa atual e revisão visíveis',
              ],
            ),
          },
        ],
      },
      {
        readingKey: 'b5e2a90a-0881-492e-9e28-3db17c6163b8',
        presentation: 'learnings',
        eyebrow: 'APRENDIZADOS E PRÓXIMOS PASSOS',
        heading: 'O que observar na avaliação.',
        description:
          'Substitua estas perguntas pelos aprendizados e pelas limitações do projeto real.',
        blocks: [
          {
            readingKey: 'f5e9506b-2943-4aa6-b365-0822f830994a',
            blockType: 'text',
            heading: 'Clareza da ação',
            content: editorialText(
              'As pessoas identificam o próximo passo sem orientação externa?',
            ),
          },
          {
            readingKey: '943191f4-e6a4-4144-a52a-12cd2ff33452',
            blockType: 'text',
            heading: 'Continuidade do percurso',
            content: editorialText(
              'A divisão em etapas ajuda a avançar e permite revisar escolhas sem perder o contexto?',
            ),
          },
          {
            readingKey: '2b2d83ba-3547-454c-8515-ff5890b17651',
            blockType: 'text',
            heading: 'Qualidade em diferentes condições',
            content: editorialText(
              'Conteúdo, foco e mensagens permanecem compreensíveis em telas menores e na navegação por teclado?',
            ),
          },
        ],
      },
    ],
  };
}
