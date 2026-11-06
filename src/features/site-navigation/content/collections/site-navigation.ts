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
      'Textos do menu, do rodapé, dos botões e dos avisos do site. Há um documento por idioma: preencha os textos em português no documento pt e em inglês no documento en.',
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
      label: 'Idioma dos textos do site',
      type: 'select',
      required: true,
      options: [
        { label: 'Português', value: 'pt' },
        { label: 'Inglês', value: 'en' },
      ],
      admin: {
        description:
          'pt corresponde a português e en a inglês. Preencha todos os textos abaixo nesse idioma. O idioma deste documento não pode ser alterado.',
      },
    },
    {
      name: 'header',
      label: 'Menu no topo do site',
      type: 'group',
      admin: {
        description:
          'Textos dos links no cabeçalho. Os destinos já estão definidos: altere apenas o texto que o visitante vê.',
      },
      fields: [
        {
          name: 'brandLabel',
          label: 'Nome ou marca que leva à página inicial',
          type: 'text',
          admin: {
            description:
              'Texto no canto superior do site e na assinatura do rodapé. Ao clicar, o visitante volta à página inicial. Ex.: Eliana.',
          },
        },
        {
          name: 'projectsLabel',
          label: 'Texto do link de projetos',
          type: 'text',
          admin: {
            description:
              'Link do menu que abre a lista de projetos no idioma atual. Ex.: Projetos.',
          },
        },
        {
          name: 'aboutLabel',
          label: 'Texto do link sobre a profissional',
          type: 'text',
          admin: {
            description:
              'Link do menu que abre a página de apresentação e trajetória. Ex.: Sobre mim.',
          },
        },
        {
          name: 'resumeLabel',
          label: 'Texto do link para o currículo',
          type: 'text',
          admin: {
            description:
              'Link do menu que abre o currículo em PDF em uma nova aba. Ex.: Currículo. O arquivo é escolhido em Perfil profissional.',
          },
        },
        {
          name: 'contactLabel',
          label: 'Texto do link para contato',
          type: 'text',
          admin: {
            description:
              'Link do menu que leva aos contatos no rodapé da página atual. Ex.: Vamos conversar.',
          },
        },
      ],
    },
    {
      name: 'footer',
      label: 'Rodapé e convite para contato',
      type: 'group',
      admin: {
        description:
          'Conteúdo exibido no fim das páginas. O e-mail, o endereço do LinkedIn e o PDF do currículo vêm de Perfil profissional.',
      },
      fields: [
        {
          name: 'eyebrow',
          label: 'Texto curto acima do título do rodapé',
          type: 'text',
          admin: {
            description:
              'Pequena chamada que apresenta a área de contato. Ex.: Vamos criar algo juntos.',
          },
        },
        {
          name: 'title',
          label: 'Título do convite para contato',
          type: 'textarea',
          admin: {
            description:
              'Frase em destaque no rodapé que convida o visitante a conversar. Ex.: Tem um projeto em mente?',
          },
        },
        {
          name: 'description',
          label: 'Texto de apoio do convite para contato',
          type: 'textarea',
          admin: {
            description:
              'Complemento exibido abaixo do título do rodapé. Explique brevemente como entrar em contato ou que tipo de colaboração procura.',
          },
        },
        {
          name: 'emailLabel',
          label: 'Texto do botão de e-mail',
          type: 'text',
          admin: {
            description:
              'Texto clicável que abre uma mensagem para o e-mail do Perfil profissional. Ex.: Enviar e-mail. Preencha o texto do botão, não o endereço de e-mail.',
          },
        },
        {
          name: 'linkedinLabel',
          label: 'Texto do botão do LinkedIn',
          type: 'text',
          admin: {
            description:
              'Texto clicável que abre o LinkedIn informado em Perfil profissional. Ex.: Meu LinkedIn. O endereço do perfil é preenchido naquela coleção.',
          },
        },
        {
          name: 'resumeLabel',
          label: 'Texto do botão de currículo no rodapé',
          type: 'text',
          admin: {
            description:
              'Texto clicável que abre o PDF do currículo em uma nova aba. Ex.: Ver currículo. O arquivo é escolhido em Perfil profissional.',
          },
        },
        {
          name: 'copyright',
          label: 'Texto final do rodapé',
          type: 'text',
          admin: {
            description:
              'Linha de assinatura ou direitos autorais exibida no fim do site. Ex.: © 2026 Eliana.',
          },
        },
      ],
    },
    {
      name: 'controls',
      label: 'Textos dos botões e da navegação dos projetos',
      type: 'group',
      admin: {
        description:
          'Nomes das ações e dos elementos de apoio do site. Use frases curtas no idioma deste documento; estes campos não recebem endereços de links.',
      },
      fields: [
        {
          name: 'caseLinkLabel',
          label: 'Texto para abrir um projeto',
          type: 'text',
          admin: {
            description:
              'Ação exibida nos cartões de projetos da página inicial e da listagem. Ex.: Ver projeto.',
          },
        },
        {
          name: 'homeLabel',
          label: 'Texto para voltar à página inicial',
          type: 'text',
          admin: {
            description:
              'Link de retorno à página inicial, usado na listagem e quando o menu completo não está disponível. Ex.: Início.',
          },
        },
        {
          name: 'casesLabel',
          label: 'Nome dos projetos na contagem e nos links',
          type: 'text',
          admin: {
            description:
              'Palavra que acompanha a quantidade na listagem e identifica o link para projetos nas mensagens do site. Ex.: Projetos.',
          },
        },
        {
          name: 'backToProjectsLabel',
          label: 'Texto para voltar à lista de projetos (opcional)',
          type: 'text',
          admin: {
            description:
              'Link no início da página de um projeto. Ex.: Voltar aos projetos. Se ficar vazio, o site usa o texto padrão do idioma.',
          },
        },
        {
          name: 'contentsLabel',
          label: 'Título do sumário do projeto',
          type: 'text',
          admin: {
            description:
              'Título acima da lista de seções que permite navegar pelo projeto. Ex.: Neste projeto.',
          },
        },
        {
          name: 'previousSectionLabel',
          label: 'Texto da ação de seção anterior',
          type: 'text',
          admin: {
            description:
              'Rótulo reservado para voltar à seção anterior de um projeto. Ex.: Seção anterior. Não aparece no layout atual.',
          },
        },
        {
          name: 'nextSectionLabel',
          label: 'Texto da ação de próxima seção',
          type: 'text',
          admin: {
            description:
              'Rótulo reservado para avançar à próxima seção de um projeto. Ex.: Próxima seção. Não aparece no layout atual.',
          },
        },
        {
          name: 'openMenuLabel',
          label: 'Texto do botão de abrir o menu',
          type: 'text',
          admin: {
            description:
              'Botão que abre a navegação em telas menores, como celulares. Ex.: Abrir menu.',
          },
        },
        {
          name: 'closeMenuLabel',
          label: 'Texto do botão de fechar o menu',
          type: 'text',
          admin: {
            description:
              'Botão exibido dentro do menu para fechá-lo em telas menores. Ex.: Fechar menu.',
          },
        },
        {
          name: 'languageLabel',
          label: 'Nome acessível do seletor de idioma',
          type: 'text',
          admin: {
            description:
              'Nome do controle de troca de idioma, usado também por leitores de tela. Ex.: Idioma do site.',
          },
        },
        {
          name: 'newTabLabel',
          label: 'Aviso de link que abre em outra aba',
          type: 'text',
          admin: {
            description:
              'Complemento acessível dos links que abrem outra aba, como o currículo. Ex.: abre em nova aba.',
          },
        },
        {
          name: 'roleLabel',
          label: 'Rótulo da atuação no projeto',
          type: 'text',
          admin: {
            description:
              'Título que acompanha a contribuição profissional na abertura de cada projeto. Ex.: Minha atuação. A atuação de cada projeto é preenchida em Conteúdo dos projetos.',
          },
        },
        {
          name: 'scopeLabel',
          label: 'Rótulo do escopo do projeto',
          type: 'text',
          admin: {
            description:
              'Título que acompanha as áreas ou entregas na abertura de cada projeto. Ex.: Escopo. Os detalhes de cada projeto são preenchidos em Conteúdo dos projetos.',
          },
        },
      ],
    },
    {
      name: 'messages',
      label: 'Mensagens de aviso, lista vazia e páginas indisponíveis',
      type: 'group',
      admin: {
        description:
          'Textos exibidos quando uma tradução, página ou lista não está disponível. Oriente o visitante com mensagens claras no idioma deste documento.',
      },
      fields: [
        {
          name: 'translationUnavailable',
          label: 'Aviso de projeto sem tradução publicada',
          type: 'text',
          admin: {
            description:
              'Aviso ao trocar para um idioma em que o projeto ainda não está publicado. O visitante é levado à lista nesse idioma. Ex.: Este projeto ainda não está disponível em português.',
          },
        },
        {
          name: 'readingPositionAdjusted',
          label: 'Aviso de posição de leitura ajustada',
          type: 'text',
          admin: {
            description:
              'Aviso após a troca de idioma quando o site precisa ajustar a posição de leitura por falta de uma seção correspondente. Ex.: Ajustamos sua posição de leitura nesta tradução.',
          },
        },
        {
          name: 'emptyCasesTitle',
          label: 'Lista sem projetos: título',
          type: 'text',
          admin: {
            description:
              'Título mostrado quando não há projetos publicados para a lista ou área de destaques no idioma atual. Ex.: Novos projetos em breve.',
          },
        },
        {
          name: 'emptyCasesDescription',
          label: 'Lista sem projetos: explicação',
          type: 'text',
          admin: {
            description:
              'Texto de apoio exibido abaixo do título de lista vazia. Ex.: Estou preparando os próximos projetos para compartilhar aqui.',
          },
        },
        {
          name: 'caseUnavailableTitle',
          label: 'Projeto retirado de publicação: título',
          type: 'text',
          admin: {
            description:
              'Título mostrado ao acessar um projeto que deixou de estar publicado. Ex.: Projeto indisponível.',
          },
        },
        {
          name: 'caseUnavailableDescription',
          label: 'Projeto retirado de publicação: explicação',
          type: 'text',
          admin: {
            description:
              'Texto que orienta o visitante quando um projeto foi retirado de publicação. Ex.: Este projeto não está mais disponível. Conheça os outros trabalhos.',
          },
        },
        {
          name: 'temporaryFailureTitle',
          label: 'Falha temporária: título',
          type: 'text',
          admin: {
            description:
              'Título mostrado quando o site não consegue carregar o conteúdo naquele momento. Ex.: Conteúdo temporariamente indisponível.',
          },
        },
        {
          name: 'temporaryFailureDescription',
          label: 'Falha temporária: orientação ao visitante',
          type: 'text',
          admin: {
            description:
              'Explicação para uma falha temporária de carregamento ou de troca de idioma. Ex.: Não foi possível carregar o conteúdo. Tente novamente em instantes.',
          },
        },
        {
          name: 'retryLabel',
          label: 'Texto da ação de tentar novamente',
          type: 'text',
          admin: {
            description:
              'Rótulo reservado para repetir uma ação após falha. Ex.: Tentar novamente. Não aparece no layout atual.',
          },
        },
        {
          name: 'notFoundTitle',
          label: 'Página não encontrada: título',
          type: 'text',
          admin: {
            description:
              'Título mostrado para um endereço que não corresponde a uma página disponível. Ex.: Página não encontrada.',
          },
        },
        {
          name: 'notFoundDescription',
          label: 'Página não encontrada: orientação ao visitante',
          type: 'text',
          admin: {
            description:
              'Texto que orienta o visitante a continuar navegando após acessar um endereço inexistente. Ex.: Confira os projetos ou volte à página inicial.',
          },
        },
      ],
    },
  ],
});
