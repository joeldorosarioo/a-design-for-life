# Contratos de conteúdo e integração do portfólio

Complemento da [spec principal](2026-10-29-portfolio-spec-v1.md), baseado no [inventário do Figma](2026-10-29-portfolio-inventario-figma.md).

Os contratos abaixo detalham as responsabilidades já aprovadas. São documentação de arquitetura e dados, não código de implementação. Os nomes técnicos podem ser ajustados no plano por uma razão concreta, mantendo um mapeamento explícito e sem alterar responsabilidades, identidade ou comportamento.

## Collections e responsabilidades

| Collection de referência | Dona no código | Responsabilidade |
|---|---|---|
| `cases` | `features/cases` | Identidade compartilhada, ordem e destaque |
| `case-content` | `features/cases` | Documento editorial de cada case/idioma, com rascunhos e publicação |
| `site-navigation` | `features/site-navigation` | Header/footer por idioma, com publicação independente |
| `professional-profiles` | `features/professional-profile` | Apresentação, Sobre, contatos e currículo por idioma |
| `media` | `features/media-library` | Arquivos, derivados e controle de suas referências/acesso |
| `case-routes` | `features/cases` | Reserva de endereços por idioma e identidade do case |
| `users` | Configuração de autenticação do Payload | Contas administrativas e recuperação nativa |

Cada feature mantém suas definições de conteúdo, contratos e operações. A configuração do Payload compõe essas definições. Interfaces, componentes e contratos compartilhados não importam arquivos internos de outra feature. Não criar um segundo domínio editorial em `helpers`.

## Identidade e estado editorial

### Case compartilhado

- ID permanente, gerado pela infraestrutura escolhida.
- Identificação interna para localizar o projeto no painel, distinta do título traduzido público.
- Ordem editorial e seleção de destaque.
- Não contém os textos públicos de uma tradução nem um status localizado beta.
- Atualizar metadados compartilhados não altera o status dos documentos editoriais.
- A seleção de destaque não torna uma tradução privada publicamente visível.

### Documento editorial de case

| Campo/contrato | Regra |
|---|---|
| Referência ao case | Relação obrigatória com a identidade compartilhada |
| Idioma | Enumeração fechada `pt` ou `en` |
| Identidade editorial | No máximo um documento por combinação case/idioma |
| Título | Texto simples; apresentação normal/ênfase segundo o componente do Figma |
| Resumo/introdução | Conteúdo do card e da abertura, com campos separados se a referência exigir textos distintos |
| Slug | Conforme P03; pode faltar no rascunho incompleto, é obrigatório na publicação |
| Capa | Relação com mídia validada, com descrição acessível no idioma do documento |
| Papel profissional | Conteúdo obrigatório para publicar |
| Escopo e nota de contexto | Campos editoriais observados na referência, sem inventar experiência ou métricas |
| Seções e blocos | Conteúdo estruturado e reordenável, conforme regras abaixo |
| Metadados de busca e compartilhamento | Título/descrição e imagem, por idioma; derivados explícitos dos campos públicos quando apropriado |
| Rascunhos, versões e publicação | Mecanismo do Payload por documento, sem publicar o outro idioma |

Campos derivados não devem ser duplicados por conveniência. Não guardar HTML renderizado ou documentos completos do Payload como contratos de componentes.

### Seções, sumário e leitura

- As seções organizam a narrativa e seus títulos; não são seis novos tipos de bloco.
- Blocos continuam limitados a texto formatado, imagem única e duas imagens lado a lado.
- Cada seção/bloco que participa da preservação de leitura precisa de uma identidade estável. Alterar um título ou reordenar um bloco não pode recriar essa identidade automaticamente.
- Traduções equivalentes reutilizam as correspondências de leitura; não associar trechos pela posição do array ou por tradução automática de texto.
- O sumário reflete os títulos e a ordem do artigo efetivamente publicado. Não manter uma lista manual independente que possa apontar para seções ausentes.
- A apresentação de navegação do case respeita o frame desktop/mobile, os controles por teclado e movimento reduzido.
- A composição antes/depois observada no Figma deve usar uma apresentação predefinida dos dados editoriais permitidos. Não criar um construtor de colunas nem liberar CSS no CMS. A decomposição em componentes e campos deve ser demonstrada na etapa de modelos/interface antes do aceite.
- A implementação documenta a resolução de correspondência durante a troca de idioma e prova o comportamento com textos e imagens de alturas diferentes, sem substituir o contrato por simples proporção de rolagem.

Texto formatado aceita parágrafos, listas, links e destaques aprovados. Não aceitar HTML arbitrário, scripts, estilos livres, embeds, vídeos ou carrosséis. Imagens informativas exigem texto alternativo; a classificação decorativa é explícita.

## Navegação por idioma

Um documento PT e um EN. Criados inicialmente como rascunhos, sem exclusão nem alteração de idioma. Após a primeira publicação válida, não podem ser retirados de publicação.

### Header

| Identidade fixa | Rótulo editável | Destino resolvido pelo código |
|---|---|---|
| Projetos | Por idioma | Listagem de cases do idioma atual |
| Sobre | Por idioma | Página Sobre do idioma atual |
| Currículo | Por idioma | PDF publicado em Perfil profissional, em nova aba |
| Contato | Por idioma | `#contact` no footer da página atual |

A ordem dos quatro itens é a aprovada na spec. A marca/retorno à Home usa o idioma atual. Textos são editáveis; finalidades e tipos dos destinos não são URLs livres. Não duplicar o PDF na configuração da navegação.

### Footer

Campos estruturados para identificação editorial, título, descrição e rótulos dos contatos, conforme o componente de referência. Dados de e-mail, LinkedIn e currículo vêm do Perfil profissional publicado do idioma atual. A lista de contatos recebe `id="contact"` e mantém navegação acessível.

O modelo não introduz formulário, captura de leads, newsletter, popup ou página nova de contato. Trechos de exemplo do footer permanecem em rascunho até revisão.

## Perfil profissional por idioma

Um documento PT e um EN, com as mesmas proteções estruturais e de publicação dos documentos de Navegação.

Agrupar campos por finalidade no painel, sem torná-los páginas editoriais independentes:

| Grupo | Conteúdo |
|---|---|
| Identificação | Nome profissional e apresentação/papel público |
| Apresentação da Home | Identificação editorial, partes do título, descrição, retrato e rótulo da ação |
| Sobre e trajetória na Home | Títulos, textos e itens estruturados previstos na referência |
| Abordagem | Título/descrição e cartões de método previstos no Figma |
| Página Sobre | Abertura, introdução/retrato, percurso, fotografias, ênfase editorial, abordagem, Em movimento e encerramento |
| Contatos | E-mail e endereço do LinkedIn, validados e usados pelos componentes globais |
| Currículo | Referência ao PDF do idioma do documento, até 5 MB |
| Metadados | Informações públicas de busca/compartilhamento do perfil e páginas correspondentes |

Preservar os arranjos fixos da referência. As imagens são referências de mídia; texto alternativo e legenda pertencem ao uso editorial no idioma correspondente, evitando impor uma descrição PT a uma imagem compartilhada no documento EN.

Revisar o conteúdo obrigatório dos grupos globais antes da publicação. Rascunhos incompletos não substituem o perfil ou a navegação já públicos. O lançamento depende de conteúdo final revisado nos dois idiomas, incluindo destinos e currículos necessários, sem converter modelos em fatos.

## Registro de mídias

Metadados técnicos incluem identificador, tipo validado, tamanho, dimensões quando aplicáveis, referência de armazenamento e derivados. A descrição editorial depende do contexto e idioma do uso. Não confiar na extensão do nome para determinar o tipo real.

- JPEG/PNG/WebP/AVIF: até 10 MB. PDF de currículo: até 5 MB. SVG é permanentemente rejeitado no CMS.
- Apenas código do servidor acessa credenciais e endereços privados de armazenamento.
- Todas as versões derivadas obedecem ao mesmo controle de acesso do arquivo de origem; um thumbnail ou endpoint de otimização não pode expor mídia de rascunho.
- Registrar referências de uso suficientes para impedir exclusão de arquivos publicados em uso e resolver compartilhamento entre documentos/idiomas.
- Uma mídia já pública reutilizada em um rascunho não volta a ser secreta apenas por esse novo uso; a aplicação não pode prometer essa garantia.
- A publicação de um documento não torna públicos outros arquivos privados não aprovados.
- Prévias exigem autenticação e não usam cache público.
- O desenho de entrega, cache e revogação deve ser documentado e testado junto de P07/P08. URLs difíceis de adivinhar não substituem controle de acesso.
- Exclusões do conteúdo corrente respeitam as oito semanas de recuperação dos backups aprovados.

O inventário identifica retrato, fotografias editoriais e capas/imagens dos cases. A exportação dos originais e sua conferência são tarefas da implementação, sem criação de imagens substitutas por iniciativa do agente.

## Registro de endereços

Tratar a reserva de endereços como um contrato único de unicidade, incluindo conteúdo atual, rascunhos e histórico. Collections separadas com índices independentes não podem permitir colisões entre essas categorias.

Dados necessários: idioma, slug normalizado, case proprietário e informação suficiente para saber se o endereço já foi público. Associar também o documento editorial responsável quando necessário ao controle de reservas.

- A identidade reservada é a combinação idioma/slug.
- Reservas pertencem ao case, não ao texto do título ou à posição editorial.
- Um rascunho pode não ter slug. Ao aceitar um slug válido, reservar atomicamente ou informar conflito.
- Ao trocar um slug nunca publicado, liberar apenas a reserva anterior que não continua sendo endereço público ou histórico.
- Uma mudança em rascunho não modifica o destino público atual.
- Na publicação, o novo endereço vira o atual; os anteriores permanecem reservados e resolvem diretamente para o atual.
- Permitir retomar um endereço histórico do próprio case mediante publicação explícita. Não criar A → B → A nem encadear todos os endereços intermediários.
- Restaurar uma versão de conteúdo não ignora as reservas nem muda a URL pública automaticamente.
- Para um case retirado de publicação, aplicar o comportamento de indisponibilidade aprovado, sem revelar rascunhos.

O schema físico e o mecanismo de transação são detalhados no plano para a versão validada do Payload/PostgreSQL. As restrições de identidade, unicidade e propriedade não podem depender somente de uma consulta anterior à gravação, sujeita a corrida.

## Fronteiras e contratos dos componentes

Contratos de apresentação são mapeados dentro da feature, separados dos documentos do CMS. Exemplos de dados mínimos:

| Contrato | Conteúdo público necessário |
|---|---|
| Card de case | Identidade, título, resumo, imagem com descrição/dimensões e destino resolvido |
| Detalhe de case | Abertura, metadados públicos, seções/blocos e sumário derivado |
| Header | Marca, idioma e quatro itens com destinos resolvidos |
| Footer | Textos editoriais e contatos publicados |
| Perfil | Apresentação e seções estruturadas do idioma solicitado |
| Imagem editorial | Recurso permitido, descrição, legenda, dimensões e variantes permitidas |
| Evento de Analytics | Nome do evento aprovado, idioma e contexto público mínimo; sem identificadores pessoais |

Zod valida entradas e fronteiras necessárias. Gerar tipos a partir dos schemas que forem sua fonte; os tipos do Payload continuam sendo gerados a partir das collections. Validar os dois contratos em seus respectivos limites, sem copiar os modelos manualmente ou validar o mesmo dado em cada componente.

Para links, usar alternativas fechadas de destino: página interna, recurso de currículo, âncora de contato e campos específicos de contato externo. Esquemas inválidos, JavaScript em URLs e mudança da finalidade fixa do header são rejeitados.

## Publicação e consistência

Separar a gravação editorial, a disponibilização de mídias e a atualização do cache. Banco e R2 não são presumidos como uma transação distribuída única.

1. Validar usuário, bloqueio de edição, identidade, entradas e requisitos de publicação.
2. Verificar as referências de mídia e o idioma do documento.
3. Gravar conteúdo/estado/rotas com as garantias transacionais aplicáveis.
4. Atualizar apenas as dependências públicas afetadas, incluindo listagem, destaques, detalhe, metadados e mapas de idioma.
5. Informar se o conteúdo foi salvo e a atualização pública ficou pendente. Permitir nova tentativa segura.

Repetir uma tentativa não pode duplicar documentos, reservas ou versões públicas indevidas. Uma operação antiga não deve sobrescrever o resultado de uma publicação mais recente. Persistir o contexto necessário para diagnóstico e recuperação, aproveitando a stack existente, sem introduzir um serviço externo de filas por iniciativa própria.

Reordenação e alteração de destaque também atualizam listagem/Home. Publicar Navegação PT não publica Perfil PT nem Navegação EN. Recuperar versão sempre produz rascunho para revisão. Edições concorrentes precisam respeitar o bloqueio e rejeitar sessões desatualizadas no servidor.

As operações locais do Payload não devem ignorar controles de acesso ou bloqueios por conveniência. Consultas públicas aplicam as regras de publicação e idioma explicitamente. Operações internas privilegiadas exigem contexto, finalidade e escopo documentados; não expor um caminho administrativo a partir de entrada pública.

## Erros e provas exigidas

Falhas esperadas têm contratos tipados: entrada inválida, conflito de slug, edição desatualizada, documento bloqueado, sem autorização, conteúdo indisponível e atualização pública pendente. Falhas inesperadas são registradas com identificador de correlação, sem credenciais, tokens ou rascunhos no retorno público.

Provas mínimas na etapa de CMS:

- Duas tentativas simultâneas não criam a mesma tradução nem reservam o mesmo endereço para cases diferentes.
- Draft/publicação/retirada PT não altera EN; o mesmo vale para Navegação e Perfil profissional.
- Os quatro documentos estruturais são provisionados sem duplicação, permanecem editáveis e têm exclusão/alteração de idioma bloqueadas.
- Navegação e Perfil já publicados não podem ser retirados de publicação.
- Restauração não publica; gravação de sessão desatualizada não sobrescreve conteúdo recente.
- Consulta pública e acesso direto às mídias/derivados não expõem rascunhos.
- Falhas de atualização são visíveis no CMS e a repetição respeita a publicação mais recente.
- A recuperação nativa de senha por e-mail aceita link válido e rejeita token inválido/expirado.

Essas provas são executadas durante a implementação com TDD e verificação antes de concluir. A ausência de código neste momento não reabre os requisitos da entrevista.
