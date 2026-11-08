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
      'Edite a apresentação, a biografia, os contatos e o currículo da Eliana. Cada idioma tem seu próprio perfil e sua própria publicação.',
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
          'Escreva os textos e as descrições de imagem neste idioma. O idioma fica fixo após salvar.',
      },
    },
    {
      name: 'identity',
      label: 'Identificação profissional',
      type: 'group',
      admin: {
        description: 'Dados de referência sobre a profissional apresentada no portfólio.',
      },
      fields: [
        {
          name: 'name',
          label: 'Nome profissional',
          type: 'text',
          admin: {
            description: 'Informe o nome pelo qual a Eliana se apresenta profissionalmente.',
          },
        },
        {
          name: 'role',
          label: 'Área de atuação',
          type: 'text',
          admin: {
            description: 'Informe o cargo ou a especialidade, como designer de produto.',
          },
        },
      ],
    },
    {
      name: 'home',
      label: 'Início — abertura',
      type: 'group',
      admin: {
        description: 'Primeira seção da página inicial, com título, retrato e botão de projetos.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Chamada acima do título',
          type: 'text',
          admin: {
            description: 'Uma frase curta que prepara a leitura do título.',
          },
        },
        {
          name: 'title',
          label: 'Título de abertura',
          type: 'text',
          admin: { description: 'Comece com a mensagem principal da apresentação.' },
        },
        {
          name: 'titleEmphasis',
          label: 'Trecho em destaque',
          type: 'textarea',
          admin: {
            description:
              'Aparece em destaque abaixo da primeira parte do título. Pode ficar vazio.',
          },
        },
        {
          name: 'description',
          label: 'Apresentação breve',
          type: 'textarea',
          admin: {
            description: 'Apresente a Eliana e seu trabalho no texto abaixo do título.',
          },
        },
        imageUseField('portrait', 'Retrato da abertura'),
        {
          name: 'projectsLabel',
          label: 'Texto do botão de projetos',
          type: 'text',
          admin: {
            description:
              'Escreva o que aparece no botão, como “Veja meus projetos”. Ele abre a lista de projetos.',
          },
        },
      ],
    },
    {
      name: 'homeProjects',
      label: 'Início — projetos em destaque',
      type: 'group',
      admin: { description: 'Apresentação da seleção de projetos da página inicial.' },
      fields: [
        {
          name: 'eyebrow',
          label: 'Chamada acima do título',
          type: 'text',
          admin: {
            description: 'Uma frase curta para introduzir os projetos em destaque.',
          },
        },
        {
          name: 'title',
          label: 'Título da seleção',
          type: 'text',
          admin: { description: 'Aparece acima dos cartões na página inicial.' },
        },
        {
          name: 'description',
          label: 'Texto sobre a seleção',
          type: 'textarea',
          admin: {
            description: 'Dê contexto aos projetos escolhidos para a página inicial.',
          },
        },
      ],
    },
    {
      name: 'listing',
      label: 'Página de projetos',
      type: 'group',
      admin: {
        description: 'Abertura da página que reúne todos os projetos publicados neste idioma.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Chamada acima do título',
          type: 'text',
          admin: { description: 'Uma frase curta para introduzir a lista completa.' },
        },
        {
          name: 'title',
          label: 'Título da página de projetos',
          type: 'text',
          admin: {
            description: 'É o título principal da lista completa.',
          },
        },
        {
          name: 'description',
          label: 'Introdução da lista',
          type: 'textarea',
          admin: { description: 'Conte o que a pessoa encontra nesta página.' },
        },
      ],
    },
    {
      name: 'homeAbout',
      label: 'Início — sobre e trajetória',
      type: 'group',
      admin: {
        description: 'Resumo da biografia e da trajetória na página inicial.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Chamada acima do título',
          type: 'text',
          admin: {
            description: 'Uma frase curta para introduzir a seção sobre a Eliana.',
          },
        },
        {
          name: 'title',
          label: 'Título do resumo',
          type: 'textarea',
          admin: { description: 'Aparece acima do resumo da biografia na página inicial.' },
        },
        {
          name: 'description',
          label: 'Resumo da biografia',
          type: 'textarea',
          admin: {
            description: 'Apresente a Eliana em poucas frases, antes do link para a página Sobre.',
          },
        },
        {
          name: 'trajectory',
          label: 'Etapas da trajetória',
          type: 'array',
          labels: { singular: 'Etapa da trajetória', plural: 'Etapas da trajetória' },
          admin: {
            description:
              'Adicione ao menos uma etapa antes de publicar. A lista segue a ordem deste formulário.',
          },
          fields: [
            {
              name: 'readingKey',
              label: 'Código de leitura',
              type: 'text',
              admin: {
                description:
                  'Gerado ao salvar. Reuse o código da etapa correspondente na tradução para manter a posição de leitura. Códigos salvos são fixos.',
              },
            },
            {
              name: 'period',
              label: 'Período',
              type: 'text',
              admin: {
                description: 'Informe uma data ou intervalo, como “2020–2023”.',
              },
            },
            {
              name: 'title',
              label: 'Título da etapa',
              type: 'text',
              admin: { description: 'Dê nome à experiência, formação ou marco profissional.' },
            },
            {
              name: 'description',
              label: 'Descrição da etapa',
              type: 'textarea',
              admin: {
                description: 'Conte o que aconteceu nesta etapa e por que foi importante.',
              },
            },
          ],
        },
        {
          name: 'aboutLabel',
          label: 'Texto do link para Sobre',
          type: 'text',
          admin: {
            description: 'Escreva o que aparece no link que abre a biografia completa.',
          },
        },
      ],
    },
    {
      name: 'approach',
      label: 'Início — como trabalho',
      type: 'group',
      admin: {
        description: 'Princípios de trabalho e cartões de método da página inicial.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Chamada acima do título',
          type: 'text',
          admin: {
            description: 'Uma frase curta para introduzir os métodos.',
          },
        },
        {
          name: 'title',
          label: 'Título da seção de métodos',
          type: 'text',
          admin: { description: 'Aparece acima da introdução e dos cartões de método.' },
        },
        {
          name: 'description',
          label: 'Introdução aos métodos',
          type: 'textarea',
          admin: {
            description: 'Resuma os princípios que orientam o trabalho.',
          },
        },
        {
          name: 'methods',
          label: 'Métodos de trabalho',
          type: 'array',
          labels: { singular: 'Método de trabalho', plural: 'Métodos de trabalho' },
          admin: {
            description:
              'Adicione ao menos um método antes de publicar. Os cartões seguem a ordem deste formulário.',
          },
          fields: [
            {
              name: 'readingKey',
              label: 'Código de leitura',
              type: 'text',
              admin: {
                description:
                  'Gerado ao salvar. Reuse o código do método correspondente na tradução para manter a posição de leitura. Códigos salvos são fixos.',
              },
            },
            {
              name: 'title',
              label: 'Nome do método',
              type: 'text',
              admin: {
                description: 'É o título do cartão.',
              },
            },
            {
              name: 'description',
              label: 'Descrição do método',
              type: 'textarea',
              admin: {
                description: 'Explique como o método é usado e o que ele ajuda a resolver.',
              },
            },
            {
              name: 'keywords',
              label: 'Palavras-chave',
              type: 'text',
              admin: {
                description:
                  'Aparecem no fim do cartão. Você pode usar “Pesquisa · Escuta · Experimentação”.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'about',
      label: 'Página Sobre',
      type: 'group',
      admin: {
        description: 'Biografia completa, na ordem em que as seções aparecem no site.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Chamada da abertura',
          type: 'text',
          admin: {
            description: 'Aparece acima do título principal da página Sobre.',
          },
        },
        {
          name: 'title',
          label: 'Título da página Sobre',
          type: 'textarea',
          admin: { description: 'É o primeiro título da biografia.' },
        },
        {
          name: 'description',
          label: 'Resumo da abertura',
          type: 'textarea',
          admin: {
            description: 'Aparece abaixo do título principal da página Sobre.',
          },
        },
        {
          name: 'introductionHeading',
          label: 'Título acessível da introdução',
          type: 'text',
          admin: {
            description: 'Identifica a seção para leitores de tela e fica oculto visualmente.',
          },
        },
        {
          name: 'introduction',
          label: 'Introdução da biografia',
          type: 'textarea',
          admin: {
            description:
              'Apresente a Eliana no texto junto ao retrato. Separe os parágrafos com uma linha em branco.',
          },
        },
        imageUseField('portrait', 'Retrato da biografia'),
        {
          name: 'journeyHeading',
          label: 'Título da trajetória',
          type: 'text',
          admin: { description: 'Apresenta o percurso pessoal e profissional.' },
        },
        {
          name: 'journeyEyebrow',
          label: 'Chamada da trajetória',
          type: 'text',
          admin: {
            description: 'Aparece acima do título da trajetória. Pode ficar vazia.',
          },
        },
        {
          name: 'journey',
          label: 'Texto da trajetória',
          type: 'textarea',
          admin: {
            description:
              'Conte os momentos que marcaram esse percurso. Separe os parágrafos com uma linha em branco.',
          },
        },
        imageUseField('deskPhotograph', 'Foto do ambiente de trabalho'),
        {
          name: 'editorialEmphasis',
          label: 'Frase em destaque',
          type: 'textarea',
          admin: {
            description: 'Aparece após a foto do ambiente de trabalho, em destaque na página.',
          },
        },
        {
          name: 'approachHeading',
          label: 'Título da abordagem',
          type: 'text',
          admin: { description: 'Apresenta a seção sobre a forma de trabalhar.' },
        },
        {
          name: 'approachEyebrow',
          label: 'Chamada da abordagem',
          type: 'text',
          admin: {
            description: 'Aparece acima do título da abordagem. Pode ficar vazia.',
          },
        },
        {
          name: 'approach',
          label: 'Texto da abordagem',
          type: 'textarea',
          admin: {
            description:
              'Explique como a Eliana trabalha. Separe os parágrafos com uma linha em branco.',
          },
        },
        imageUseField('architecturePhotograph', 'Foto de arquitetura'),
        {
          name: 'inMotionHeading',
          label: 'Título de Em movimento',
          type: 'text',
          admin: {
            description: 'Apresenta a seção de interesses e aprendizados atuais.',
          },
        },
        {
          name: 'inMotionEyebrow',
          label: 'Chamada de Em movimento',
          type: 'text',
          admin: { description: 'Aparece acima do título de Em movimento. Pode ficar vazia.' },
        },
        {
          name: 'inMotion',
          label: 'Texto de Em movimento',
          type: 'textarea',
          admin: {
            description:
              'Conte o que a Eliana está explorando ou aprendendo. Separe os parágrafos com uma linha em branco.',
          },
        },
        {
          name: 'closingHeading',
          label: 'Título acessível do encerramento',
          type: 'text',
          admin: {
            description: 'Identifica a seção para leitores de tela e fica oculto visualmente.',
          },
        },
        {
          name: 'closing',
          label: 'Encerramento da biografia',
          type: 'textarea',
          admin: { description: 'Último texto da página Sobre, antes do link para os projetos.' },
        },
        {
          name: 'projectsLabel',
          label: 'Texto do link para projetos',
          type: 'text',
          admin: {
            description:
              'Escreva o que aparece no link ao fim da biografia. Ele abre a lista de projetos.',
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
          'Informe os destinos dos links do rodapé. Edite os textos dos links em Navegação.',
      },
      fields: [
        {
          name: 'email',
          label: 'E-mail de contato',
          type: 'email',
          admin: {
            description: 'Informe apenas o endereço de e-mail. Ele será público no portfólio.',
          },
        },
        {
          name: 'linkedin',
          label: 'Link do LinkedIn',
          type: 'text',
          admin: {
            description: 'Cole o endereço HTTPS completo do perfil profissional no LinkedIn.',
          },
        },
      ],
    },
    {
      name: 'resume',
      label: 'Currículo em PDF',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Selecione ou envie o PDF deste idioma, de até 5 MB. Os links de currículo desta versão usam o mesmo arquivo.',
      },
    },
    {
      name: 'seo',
      label: 'Busca e compartilhamento',
      type: 'group',
      admin: {
        description:
          'Edite os títulos da aba do navegador e as informações que podem aparecer em buscas e prévias de links.',
      },
      fields: [
        {
          name: 'homeTitle',
          label: 'Início — título para busca',
          type: 'text',
          admin: {
            description:
              'Se ficar vazio, o site usa o título de abertura, incluindo o trecho em destaque.',
          },
        },
        {
          name: 'homeDescription',
          label: 'Início — resumo para busca',
          type: 'textarea',
          admin: {
            description: 'Se ficar vazio, o site usa a apresentação breve da página inicial.',
          },
        },
        {
          name: 'listingTitle',
          label: 'Projetos — título para busca',
          type: 'text',
          admin: {
            description: 'Se ficar vazio, o site usa o título da página de projetos.',
          },
        },
        {
          name: 'listingDescription',
          label: 'Projetos — resumo para busca',
          type: 'textarea',
          admin: { description: 'Se ficar vazio, o site usa a introdução da lista de projetos.' },
        },
        {
          name: 'aboutTitle',
          label: 'Sobre — título para busca',
          type: 'text',
          admin: {
            description: 'Se ficar vazio, o site usa o título da página Sobre.',
          },
        },
        {
          name: 'aboutDescription',
          label: 'Sobre — resumo para busca',
          type: 'textarea',
          admin: {
            description: 'Se ficar vazio, o site usa o resumo de abertura da página Sobre.',
          },
        },
        imageUseField('image', 'Imagem de compartilhamento'),
      ],
    },
  ],
});
