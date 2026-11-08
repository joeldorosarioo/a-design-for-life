import {
  capturePublishedReadRoot,
  publishedReadResponse,
} from '@/helpers/payload/published-read-response';
import { getPublishedNavigation } from '../../server/get-published-navigation';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { isDraftOperation, protectEditorialCollection } from '@/helpers/payload/editorial-revision';
import { validateNavigationPublication } from '../validate-publication';
import 'server-only';
import { APIError, type CollectionConfig } from 'payload';
import { navigationInputSchema } from '../../contracts/navigation.schema';
import { requiredIdentity, validatedWrite } from '@/helpers/payload/validate-input';
import { structuralIdentitySchema } from '../../contracts/identity.schema';
import { immutableFields } from '@/helpers/payload/immutable-fields';
export const SiteNavigation: CollectionConfig = protectEditorialCollection({
  slug: 'site-navigation',
  labels: { singular: 'Navegação', plural: 'Navegação' },
  admin: {
    description:
      'Edite os textos do cabeçalho, do rodapé, dos botões e dos avisos. Há um documento para português e outro para inglês.',
    components: {
      edit: { UnpublishButton: '/helpers/payload/editorial-actions#NoUnpublishAction' },
    },
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
        const result = await getPublishedNavigation(parsed.data, undefined, root);
        return publishedReadResponse(
          result,
          { collection: 'site-navigation', where: { locale: { equals: parsed.data } } },
          req,
          root,
        );
      },
    },
  ],
  hooks: {
    beforeOperation: [validatedWrite(navigationInputSchema)],
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
      validateNavigationPublication,
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
          'Escreva os textos no idioma deste documento. O idioma fica fixo após a criação.',
      },
    },
    {
      name: 'header',
      label: 'Menu do cabeçalho',
      type: 'group',
      admin: {
        description:
          'Edite o texto dos links no topo do site. Os destinos são definidos pelo site.',
      },
      fields: [
        {
          name: 'brandLabel',
          label: 'Nome ou marca',
          type: 'text',
          admin: {
            description:
              'Aparece no cabeçalho e na assinatura do rodapé. O link leva à página inicial.',
          },
        },
        {
          name: 'projectsLabel',
          label: 'Link de projetos',
          type: 'text',
          admin: {
            description: 'Abre a lista de projetos no idioma atual. Exemplo: Projetos.',
          },
        },
        {
          name: 'aboutLabel',
          label: 'Link da página Sobre',
          type: 'text',
          admin: {
            description: 'Abre a página de apresentação e trajetória. Exemplo: Sobre mim.',
          },
        },
        {
          name: 'resumeLabel',
          label: 'Link do currículo',
          type: 'text',
          admin: {
            description:
              'Abre em outra aba o PDF escolhido em Perfil profissional. Exemplo: Currículo.',
          },
        },
        {
          name: 'contactLabel',
          label: 'Link de contato',
          type: 'text',
          admin: {
            description: 'Leva ao rodapé da página atual. Exemplo: Vamos conversar.',
          },
        },
      ],
    },
    {
      name: 'footer',
      label: 'Rodapé e contatos',
      type: 'group',
      admin: {
        description:
          'Edite o convite para contato no fim das páginas. O e-mail, o LinkedIn e o arquivo do currículo vêm de Perfil profissional.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Chamada do rodapé',
          type: 'text',
          admin: {
            description:
              'Frase curta acima do título de contato. Exemplo: Vamos criar algo juntos.',
          },
        },
        {
          name: 'title',
          label: 'Título de contato',
          type: 'textarea',
          admin: {
            description: 'Convite em destaque no rodapé. Exemplo: Tem um projeto em mente?',
          },
        },
        {
          name: 'description',
          label: 'Texto de apoio do rodapé',
          type: 'textarea',
          admin: {
            description:
              'Aparece abaixo do título. Explique como entrar em contato ou que tipo de colaboração você procura.',
          },
        },
        {
          name: 'emailLabel',
          label: 'Botão de e-mail',
          type: 'text',
          admin: {
            description:
              'Use um rótulo como “Enviar e-mail”. O endereço é editado em Perfil profissional.',
          },
        },
        {
          name: 'linkedinLabel',
          label: 'Botão do LinkedIn',
          type: 'text',
          admin: {
            description:
              'Use um rótulo como “Meu LinkedIn”. O endereço é editado em Perfil profissional.',
          },
        },
        {
          name: 'resumeLabel',
          label: 'Botão de currículo',
          type: 'text',
          admin: {
            description: 'Abre o mesmo PDF do menu em outra aba. Exemplo: Ver currículo.',
          },
        },
        {
          name: 'copyright',
          label: 'Assinatura do rodapé',
          type: 'text',
          admin: {
            description:
              'Última linha do rodapé. Pode incluir os direitos autorais, como “© 2026 Eliana”.',
          },
        },
      ],
    },
    {
      name: 'controls',
      label: 'Botões e navegação dos projetos',
      type: 'group',
      admin: {
        description:
          'Edite os rótulos das ações do site no idioma deste documento. Use frases curtas.',
      },
      fields: [
        {
          name: 'caseLinkLabel',
          label: 'Link dos cartões de projeto',
          type: 'text',
          admin: {
            description:
              'Aparece nos cartões da página inicial e da listagem. Exemplo: Ver projeto.',
          },
        },
        {
          name: 'homeLabel',
          label: 'Link de volta à página inicial',
          type: 'text',
          admin: {
            description:
              'Usado na lista de projetos e quando o menu completo está indisponível. Exemplo: Início.',
          },
        },
        {
          name: 'casesLabel',
          label: 'Nome da lista de projetos',
          type: 'text',
          admin: {
            description:
              'Use o plural, como “Projetos”. O nome aparece na contagem e nos links da lista nas páginas de aviso.',
          },
        },
        {
          name: 'backToProjectsLabel',
          label: 'Link de volta aos projetos',
          type: 'text',
          admin: {
            description:
              'Aparece no início de cada projeto. Se ficar vazio, o site usa o rótulo padrão do idioma.',
          },
        },
        {
          name: 'contentsLabel',
          label: 'Título do sumário',
          type: 'text',
          admin: {
            description:
              'Aparece acima dos links para as seções do projeto. Exemplo: Neste projeto.',
          },
        },
        {
          name: 'previousSectionLabel',
          label: 'Link para a seção anterior',
          type: 'text',
          admin: {
            description: 'Reservado para um controle que ainda não aparece no site.',
          },
        },
        {
          name: 'nextSectionLabel',
          label: 'Link para a próxima seção',
          type: 'text',
          admin: {
            description: 'Reservado para um controle que ainda não aparece no site.',
          },
        },
        {
          name: 'openMenuLabel',
          label: 'Botão de abrir o menu',
          type: 'text',
          admin: {
            description: 'Aparece no cabeçalho em telas pequenas. Exemplo: Abrir menu.',
          },
        },
        {
          name: 'closeMenuLabel',
          label: 'Botão de fechar o menu',
          type: 'text',
          admin: {
            description: 'Aparece dentro do menu em telas pequenas. Exemplo: Fechar menu.',
          },
        },
        {
          name: 'languageLabel',
          label: 'Nome do seletor de idioma',
          type: 'text',
          admin: {
            description: 'Identifica o controle de troca de idioma. Exemplo: Idioma do site.',
          },
        },
        {
          name: 'newTabLabel',
          label: 'Aviso de nova aba',
          type: 'text',
          admin: {
            description:
              'Complementa o nome acessível de links como o currículo. Use uma frase curta, como “abre em nova aba”.',
          },
        },
        {
          name: 'roleLabel',
          label: 'Rótulo da atuação no projeto',
          type: 'text',
          admin: {
            description:
              'Identifica a contribuição da profissional na abertura do projeto. Edite a contribuição em Conteúdo dos projetos.',
          },
        },
        {
          name: 'scopeLabel',
          label: 'Rótulo do escopo do projeto',
          type: 'text',
          admin: {
            description:
              'Identifica as áreas ou entregas na abertura do projeto. Edite os detalhes em Conteúdo dos projetos.',
          },
        },
      ],
    },
    {
      name: 'messages',
      label: 'Avisos e estados das páginas',
      type: 'group',
      admin: {
        description:
          'Escreva mensagens para quando faltar uma tradução, uma página ou projetos publicados. Diga ao visitante como continuar.',
      },
      fields: [
        {
          name: 'translationUnavailable',
          label: 'Aviso de tradução indisponível',
          type: 'text',
          admin: {
            description:
              'Aparece ao trocar para um idioma em que o projeto ainda não foi publicado. O site abre a lista de projetos nesse idioma.',
          },
        },
        {
          name: 'readingPositionAdjusted',
          label: 'Aviso de ajuste na posição de leitura',
          type: 'text',
          admin: {
            description:
              'Aparece após a troca de idioma quando a tradução não tem uma seção correspondente.',
          },
        },
        {
          name: 'emptyCasesTitle',
          label: 'Título da lista vazia',
          type: 'text',
          admin: {
            description:
              'Aparece na lista ou nos destaques quando não há projetos publicados no idioma atual. Exemplo: Novos projetos em breve.',
          },
        },
        {
          name: 'emptyCasesDescription',
          label: 'Texto de apoio da lista vazia',
          type: 'text',
          admin: {
            description:
              'Aparece abaixo do título. Use uma frase para apresentar o que virá a seguir.',
          },
        },
        {
          name: 'caseUnavailableTitle',
          label: 'Título de projeto retirado do ar',
          type: 'text',
          admin: {
            description:
              'Aparece ao abrir um projeto que deixou de estar publicado. Exemplo: Projeto indisponível.',
          },
        },
        {
          name: 'caseUnavailableDescription',
          label: 'Texto de apoio de projeto retirado do ar',
          type: 'text',
          admin: {
            description:
              'Explique que o projeto foi retirado e convide o visitante a explorar os outros trabalhos.',
          },
        },
        {
          name: 'temporaryFailureTitle',
          label: 'Título de falha temporária',
          type: 'text',
          admin: {
            description:
              'Aparece quando o conteúdo não carrega. Exemplo: Conteúdo temporariamente indisponível.',
          },
        },
        {
          name: 'temporaryFailureDescription',
          label: 'Texto de apoio de falha temporária',
          type: 'text',
          admin: {
            description:
              'Orienta o visitante se o conteúdo ou a troca de idioma falhar. Exemplo: Tente novamente em instantes.',
          },
        },
        {
          name: 'retryLabel',
          label: 'Botão de tentar novamente',
          type: 'text',
          admin: {
            description: 'Reservado para um controle que ainda não aparece no site.',
          },
        },
        {
          name: 'notFoundTitle',
          label: 'Título de página não encontrada',
          type: 'text',
          admin: {
            description:
              'Aparece quando o endereço não corresponde a uma página disponível. Exemplo: Página não encontrada.',
          },
        },
        {
          name: 'notFoundDescription',
          label: 'Texto de apoio de página não encontrada',
          type: 'text',
          admin: {
            description: 'Oriente o visitante a voltar à página inicial ou explorar os projetos.',
          },
        },
      ],
    },
  ],
});
