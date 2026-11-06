import {
  capturePublishedReadRoot,
  publishedReadResponse,
} from '@/helpers/payload/published-read-response';
import { synchronizeProfileMedia } from '../profile-media-usage';
import { getPublishedProfile } from '../../server/get-published-profile';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { isDraftOperation, protectEditorialCollection } from '@/helpers/payload/editorial-revision';
import { validateProfilePublication } from '../validate-publication';
import { stableProfileReadingKeys } from '../stable-profile-reading-keys';
import 'server-only';
import { APIError, type CollectionConfig } from 'payload';
import { profileInputSchema } from '../../contracts/profile.schema';
import { requiredIdentity, validatedWrite } from '@/helpers/payload/validate-input';
import { structuralIdentitySchema } from '../../contracts/identity.schema';
import { immutableFields } from '@/helpers/payload/immutable-fields';
import { imageUseField } from '@/features/media-library/server';
export const ProfessionalProfiles: CollectionConfig = protectEditorialCollection({
  slug: 'professional-profiles',
  dbName: 'profiles',
  labels: { singular: 'Perfil profissional', plural: 'Perfil profissional' },
  admin: {
    components: {
      edit: { UnpublishButton: '/helpers/payload/editorial-actions#NoUnpublishAction' },
    },
    description:
      'Textos, imagens, contatos e currículo da Eliana. Há um perfil por idioma; preencha os campos no idioma do documento e publique cada versão separadamente.',
    useAsTitle: 'locale',
    defaultColumns: ['locale', '_status'],
  },
  custom: { editorialBootstrap: true },
  versions: { drafts: true },
  endpoints: [
    {
      path: '/published/:locale',
      method: 'get',
      handler: async (req) => {
        const parsed = localeSchema.safeParse(req.routeParams?.locale);
        if (!parsed.success)
          return Response.json(
            {
              ok: false,
              error: { code: 'unavailable', message: 'Published content unavailable.' },
            },
            { status: 404 },
          );
        const root = await capturePublishedReadRoot();
        const result = await getPublishedProfile(parsed.data, undefined, root);
        return publishedReadResponse(
          result,
          { collection: 'professional-profiles', where: { locale: { equals: parsed.data } } },
          req,
          root,
        );
      },
    },
  ],
  hooks: {
    afterChange: [synchronizeProfileMedia],
    beforeOperation: [validatedWrite(profileInputSchema)],
    beforeChange: [
      async ({ data, originalDoc, req, collection }) => {
        if (
          data._status === 'draft' &&
          !isDraftOperation(req) &&
          !req.context.isRestoringVersion &&
          originalDoc?.id
        ) {
          const current = await req.payload.db.findOne({
            collection: collection.slug,
            req,
            where: { id: { equals: originalDoc.id } },
          });
          if ((current as { _status?: string } | null)?._status === 'published')
            throw new APIError(
              'Publicado: este documento estrutural não pode ser retirado de publicação.',
              400,
            );
        }
        return data;
      },
      stableProfileReadingKeys,
      validateProfilePublication,
      requiredIdentity(structuralIdentitySchema),
      immutableFields({ locale: 'Idioma não pode ser alterado.' }),
    ],
    beforeDelete: [
      () => {
        throw new APIError('Documento estrutural não pode ser excluído.', 403);
      },
    ],
  },
  access: {
    create: ({ req }) => Boolean(req.user) || req.context.trustedStructuralProvisioning === true,
    read: ({ req }) =>
      req.user || req.context.trustedStructuralProvisioning === true
        ? true
        : { _status: { equals: 'published' } },
    readVersions: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: () => false,
  },
  fields: [
    {
      name: 'locale',
      unique: true,
      label: 'Idioma do conteúdo',
      type: 'select',
      required: true,
      options: [
        { label: 'Português', value: 'pt' },
        { label: 'Inglês', value: 'en' },
      ],
      admin: {
        description:
          'Idioma desta versão do perfil. Preencha todos os textos neste idioma; ele não pode ser alterado depois.',
      },
    },
    {
      name: 'identity',
      label: 'Nome e atuação profissional',
      type: 'group',
      admin: {
        description:
          'Identificação pública da Eliana, usada para apresentar a profissional no site.',
      },
      fields: [
        {
          name: 'name',
          label: 'Nome profissional',
          type: 'text',
          admin: { description: 'Nome que será apresentado no portfólio. Exemplo: Eliana.' },
        },
        {
          name: 'role',
          label: 'Cargo ou área de atuação',
          type: 'text',
          admin: {
            description:
              'Como a profissional se apresenta ao público. Exemplo: Designer de produto.',
          },
        },
      ],
    },
    {
      name: 'home',
      label: 'Página inicial — apresentação principal',
      type: 'group',
      admin: {
        description:
          'Primeira seção da página inicial: apresentação, título em destaque, retrato e acesso aos projetos.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Texto curto acima do título',
          type: 'text',
          admin: {
            description:
              'Pequena chamada que identifica a apresentação antes do título principal. Exemplo: Design com propósito.',
          },
        },
        {
          name: 'title',
          label: 'Título principal da apresentação',
          type: 'text',
          admin: { description: 'Primeira parte do título de abertura da página inicial.' },
        },
        {
          name: 'titleEmphasis',
          label: 'Trecho em destaque no título',
          type: 'textarea',
          admin: {
            description:
              'Parte do título que recebe destaque visual e complementa o título principal.',
          },
        },
        {
          name: 'description',
          label: 'Texto de apresentação',
          type: 'textarea',
          admin: {
            description:
              'Parágrafo que explica quem é a Eliana e o que ela faz, exibido na abertura da página inicial.',
          },
        },
        imageUseField('portrait', 'Retrato da apresentação'),
        {
          name: 'projectsLabel',
          label: 'Texto do link para os projetos',
          type: 'text',
          admin: {
            description:
              'Texto exibido na ação que leva à lista de projetos. Exemplo: Conheça meus projetos. O destino é definido pelo site.',
          },
        },
      ],
    },
    {
      name: 'homeProjects',
      label: 'Página inicial — chamada para os projetos',
      type: 'group',
      admin: { description: 'Textos que apresentam a seleção de projetos na página inicial.' },
      fields: [
        {
          name: 'eyebrow',
          label: 'Texto curto acima do título',
          type: 'text',
          admin: {
            description: 'Chamada curta da seção de projetos. Exemplo: Projetos selecionados.',
          },
        },
        {
          name: 'title',
          label: 'Título da seção de projetos',
          type: 'text',
          admin: { description: 'Título que apresenta os projetos destacados na página inicial.' },
        },
        {
          name: 'description',
          label: 'Apresentação dos projetos',
          type: 'textarea',
          admin: {
            description: 'Breve texto de apoio ao título da seção de projetos na página inicial.',
          },
        },
      ],
    },
    {
      name: 'listing',
      label: 'Página de projetos — abertura',
      type: 'group',
      admin: {
        description:
          'Textos de abertura da página que reúne todos os projetos disponíveis neste idioma.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Texto curto acima do título',
          type: 'text',
          admin: { description: 'Chamada curta exibida antes do título da lista de projetos.' },
        },
        {
          name: 'title',
          label: 'Título da página de projetos',
          type: 'text',
          admin: {
            description: 'Título principal da página que lista os projetos. Exemplo: Projetos.',
          },
        },
        {
          name: 'description',
          label: 'Apresentação da lista de projetos',
          type: 'textarea',
          admin: { description: 'Texto de apoio exibido na abertura da página de projetos.' },
        },
      ],
    },
    {
      name: 'homeAbout',
      label: 'Página inicial — sobre e trajetória',
      type: 'group',
      admin: {
        description:
          'Resumo sobre a Eliana e os principais momentos da trajetória profissional, exibidos na página inicial.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Texto curto acima do título',
          type: 'text',
          admin: {
            description:
              'Chamada curta que apresenta a seção sobre a profissional. Exemplo: Um pouco sobre mim.',
          },
        },
        {
          name: 'title',
          label: 'Título da apresentação pessoal',
          type: 'textarea',
          admin: { description: 'Título da seção sobre a Eliana na página inicial.' },
        },
        {
          name: 'description',
          label: 'Resumo sobre a profissional',
          type: 'textarea',
          admin: {
            description: 'Apresentação resumida que acompanha a trajetória na página inicial.',
          },
        },
        {
          name: 'trajectory',
          label: 'Etapas da trajetória profissional',
          type: 'array',
          labels: { singular: 'Etapa da trajetória', plural: 'Etapas da trajetória' },
          admin: {
            description:
              'Adicione os momentos da trajetória na ordem em que devem aparecer no site.',
          },
          fields: [
            {
              name: 'readingKey',
              label: 'Código de correspondência entre idiomas',
              type: 'text',
              admin: {
                description:
                  'Gerado ao salvar. Na tradução, use o mesmo código da etapa correspondente para manter a posição de leitura. Não altere um código já salvo.',
              },
            },
            {
              name: 'period',
              label: 'Período da etapa',
              type: 'text',
              admin: {
                description: 'Data ou intervalo exibido junto desta etapa. Exemplo: 2020–2023.',
              },
            },
            {
              name: 'title',
              label: 'Título da etapa',
              type: 'text',
              admin: { description: 'Nome da experiência, formação ou momento profissional.' },
            },
            {
              name: 'description',
              label: 'Descrição da etapa',
              type: 'textarea',
              admin: {
                description:
                  'Breve explicação sobre a experiência e sua importância na trajetória.',
              },
            },
          ],
        },
        {
          name: 'aboutLabel',
          label: 'Texto do link para a página Sobre',
          type: 'text',
          admin: {
            description:
              'Texto da ação que abre a biografia completa. Exemplo: Saiba mais sobre mim. O destino é definido pelo site.',
          },
        },
      ],
    },
    {
      name: 'approach',
      label: 'Página inicial — forma de trabalhar',
      type: 'group',
      admin: {
        description:
          'Apresenta a abordagem de trabalho da Eliana e os cartões que explicam seus métodos.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Texto curto acima do título',
          type: 'text',
          admin: {
            description:
              'Chamada curta que identifica a seção de abordagem. Exemplo: Como trabalho.',
          },
        },
        {
          name: 'title',
          label: 'Título da seção de abordagem',
          type: 'text',
          admin: { description: 'Título que apresenta a forma de trabalhar na página inicial.' },
        },
        {
          name: 'description',
          label: 'Apresentação da abordagem',
          type: 'textarea',
          admin: {
            description: 'Texto que resume os princípios e a forma de conduzir o trabalho.',
          },
        },
        {
          name: 'methods',
          label: 'Cartões dos métodos de trabalho',
          type: 'array',
          labels: { singular: 'Método de trabalho', plural: 'Métodos de trabalho' },
          admin: {
            description:
              'Adicione cada método na ordem em que os cartões devem aparecer na página inicial.',
          },
          fields: [
            {
              name: 'readingKey',
              label: 'Código de correspondência entre idiomas',
              type: 'text',
              admin: {
                description:
                  'Gerado ao salvar. Na tradução, use o mesmo código do método correspondente para manter a posição de leitura. Não altere um código já salvo.',
              },
            },
            {
              name: 'title',
              label: 'Nome do método',
              type: 'text',
              admin: {
                description: 'Título do cartão que identifica esta etapa ou método de trabalho.',
              },
            },
            {
              name: 'description',
              label: 'Explicação do método',
              type: 'textarea',
              admin: {
                description:
                  'Texto do cartão que explica como este método contribui para o trabalho.',
              },
            },
            {
              name: 'keywords',
              label: 'Palavras-chave exibidas no cartão',
              type: 'text',
              admin: {
                description:
                  'Linha curta de termos que complementa o método. Exemplo: Pesquisa · Escuta · Experimentação.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'about',
      label: 'Página Sobre — biografia completa',
      type: 'group',
      admin: {
        description:
          'Conteúdo da página Sobre, organizado na sequência de seções que aparece no site.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Texto curto acima do título de abertura',
          type: 'text',
          admin: {
            description: 'Chamada que identifica a página Sobre antes do título principal.',
          },
        },
        {
          name: 'title',
          label: 'Título principal da página Sobre',
          type: 'textarea',
          admin: { description: 'Título de abertura da biografia completa.' },
        },
        {
          name: 'description',
          label: 'Resumo de abertura da página Sobre',
          type: 'textarea',
          admin: {
            description:
              'Texto introdutório apresentado junto ao título principal da página Sobre.',
          },
        },
        {
          name: 'introductionHeading',
          label: 'Título da introdução para leitores de tela',
          type: 'text',
          admin: {
            description:
              'Identifica a introdução para quem usa leitores de tela. Este título não aparece visualmente no site.',
          },
        },
        {
          name: 'introduction',
          label: 'Texto de apresentação pessoal',
          type: 'textarea',
          admin: {
            description:
              'Apresentação mais detalhada sobre a Eliana. Separe os parágrafos com uma linha em branco.',
          },
        },
        imageUseField('portrait', 'Retrato da página Sobre'),
        {
          name: 'journeyHeading',
          label: 'Título da seção de trajetória',
          type: 'text',
          admin: { description: 'Título que apresenta o percurso pessoal e profissional.' },
        },
        {
          name: 'journeyEyebrow',
          label: 'Texto curto acima do título da trajetória',
          type: 'text',
          admin: {
            description: 'Chamada curta que identifica a seção de trajetória na página Sobre.',
          },
        },
        {
          name: 'journey',
          label: 'Texto da trajetória',
          type: 'textarea',
          admin: {
            description:
              'Relato do percurso pessoal e profissional. Separe os parágrafos com uma linha em branco.',
          },
        },
        imageUseField('deskPhotograph', 'Fotografia de mesa ou ambiente de trabalho'),
        {
          name: 'editorialEmphasis',
          label: 'Frase em destaque entre as seções',
          type: 'textarea',
          admin: {
            description:
              'Frase de destaque exibida após a fotografia de mesa, criando uma pausa na leitura.',
          },
        },
        {
          name: 'approachHeading',
          label: 'Título da seção sobre a forma de trabalhar',
          type: 'text',
          admin: { description: 'Título da seção de abordagem na página Sobre.' },
        },
        {
          name: 'approachEyebrow',
          label: 'Texto curto acima do título da abordagem',
          type: 'text',
          admin: {
            description: 'Chamada curta que identifica a seção sobre a forma de trabalhar.',
          },
        },
        {
          name: 'approach',
          label: 'Texto sobre a forma de trabalhar',
          type: 'textarea',
          admin: {
            description:
              'Explicação detalhada da abordagem profissional. Separe os parágrafos com uma linha em branco.',
          },
        },
        imageUseField('architecturePhotograph', 'Fotografia de arquitetura'),
        {
          name: 'inMotionHeading',
          label: 'Título da seção Em movimento',
          type: 'text',
          admin: {
            description:
              'Título da seção sobre interesses, atividades e aprendizados em andamento.',
          },
        },
        {
          name: 'inMotionEyebrow',
          label: 'Texto curto acima do título de Em movimento',
          type: 'text',
          admin: { description: 'Chamada curta que identifica a seção Em movimento.' },
        },
        {
          name: 'inMotion',
          label: 'Texto da seção Em movimento',
          type: 'textarea',
          admin: {
            description:
              'Conte o que mantém a Eliana em movimento, como interesses e aprendizados atuais. Separe os parágrafos com uma linha em branco.',
          },
        },
        {
          name: 'closingHeading',
          label: 'Título do encerramento para leitores de tela',
          type: 'text',
          admin: {
            description:
              'Identifica o encerramento para quem usa leitores de tela. Este título não aparece visualmente no site.',
          },
        },
        {
          name: 'closing',
          label: 'Texto de encerramento da biografia',
          type: 'textarea',
          admin: { description: 'Mensagem final da página Sobre, antes do acesso aos projetos.' },
        },
        {
          name: 'projectsLabel',
          label: 'Texto do link para os projetos',
          type: 'text',
          admin: {
            description:
              'Texto da ação exibida ao final da página Sobre. Exemplo: Veja meus projetos. O destino é definido pelo site.',
          },
        },
      ],
    },
    {
      name: 'contacts',
      label: 'Contatos públicos',
      type: 'group',
      admin: {
        description:
          'Endereços de contato usados pelo site, inclusive nos links do rodapé. Os textos desses links são definidos em Navegação.',
      },
      fields: [
        {
          name: 'email',
          label: 'E-mail de contato',
          type: 'email',
          admin: {
            description:
              'Endereço público que recebe os contatos do portfólio. Informe apenas o e-mail, sem o prefixo mailto:.',
          },
        },
        {
          name: 'linkedin',
          label: 'Endereço do perfil no LinkedIn',
          type: 'text',
          admin: {
            description:
              'URL completa e segura do perfil profissional. Exemplo: https://www.linkedin.com/in/seu-perfil/.',
          },
        },
      ],
    },
    {
      name: 'resume',
      label: 'Arquivo do currículo neste idioma',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Selecione ou envie o currículo em PDF, com até 5 MB, no idioma deste documento. O mesmo arquivo é usado pelos links de currículo do site.',
      },
    },
    {
      name: 'seo',
      label: 'Títulos, descrições e imagem para busca e compartilhamento',
      type: 'group',
      admin: {
        description:
          'Informações usadas nas abas do navegador, resultados de busca e prévias de links. Preencha textos específicos para cada página neste idioma.',
      },
      fields: [
        {
          name: 'homeTitle',
          label: 'Título da página inicial nos resultados de busca',
          type: 'text',
          admin: {
            description:
              'Título da página inicial usado na aba do navegador e nos metadados de busca e compartilhamento.',
          },
        },
        {
          name: 'homeDescription',
          label: 'Resumo da página inicial para busca e compartilhamento',
          type: 'textarea',
          admin: {
            description:
              'Resumo da apresentação da Eliana que pode aparecer em resultados de busca e prévias de links.',
          },
        },
        {
          name: 'listingTitle',
          label: 'Título da página de projetos nos resultados de busca',
          type: 'text',
          admin: {
            description:
              'Título específico da lista de projetos, usado na aba do navegador e nos metadados. Exemplo: Projetos | Eliana.',
          },
        },
        {
          name: 'listingDescription',
          label: 'Resumo da página de projetos para busca e compartilhamento',
          type: 'textarea',
          admin: { description: 'Resumo do conteúdo encontrado na página que reúne os projetos.' },
        },
        {
          name: 'aboutTitle',
          label: 'Título da página Sobre nos resultados de busca',
          type: 'text',
          admin: {
            description:
              'Título específico da biografia, usado na aba do navegador e nos metadados. Exemplo: Sobre | Eliana.',
          },
        },
        {
          name: 'aboutDescription',
          label: 'Resumo da página Sobre para busca e compartilhamento',
          type: 'textarea',
          admin: {
            description:
              'Resumo da biografia que pode aparecer em resultados de busca e prévias de links.',
          },
        },
        imageUseField('image', 'Imagem para prévias de compartilhamento'),
      ],
    },
  ],
});
