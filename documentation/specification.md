# Especificação do portfólio

Este documento reúne os contratos de produto, navegação e conteúdo. As decisões explícitas mais recentes do usuário prevalecem. A [arquitetura](architecture.md) descreve a implementação, o [guia de operação](operations.md) reúne os procedimentos e o [estado atual](current-status.md) registra verificações, exceções e condições de lançamento.

## Objetivo e escopo

O portfólio apresenta o trabalho de uma profissional de Product Design e UX e facilita contatos de empregadores para emprego fixo. Freelances são uma oportunidade secundária. O visitante deve conseguir conhecer o perfil, avaliar cases, abrir o currículo e entrar em contato em português ou inglês.

O produto inclui Home, listagem de cases, detalhe de case e Sobre, com layouts para celular, tablet e desktop. O contato principal usa e-mail e o LinkedIn oferece uma alternativa. Cada idioma possui seu currículo em PDF. O Payload permite editar cases, apresentação, Sobre, navegação, textos globais e contatos, com ordenação manual e destaques na Home.

Duas contas individuais possuem as mesmas permissões editoriais. A edição segue diretamente de rascunho para prévia autenticada e publicação. Blog, busca interna, formulário de contato, loja, comentários, cadastro público e aprovação entre editores dependem de ampliação expressa do escopo.

## Referência visual e conteúdo

O Figma define cores, fontes, composição, componentes, ativos e apresentações editoriais. A referência é a página **03 · Layout proposto**, com 18 frames de layout e 14 componentes catalogados. Adaptações responsivas e de acessibilidade acompanham essa referência. Mudanças visuais relevantes exigem aprovação. [Figma do projeto](https://www.figma.com/design/PXUcVZFdLuOzHQZkD5PU4b/Untitled?node-id=123-179).

Os IDs abaixo permitem reencontrar os frames no arquivo `PXUcVZFdLuOzHQZkD5PU4b`.

| Página   | PT desktop  | PT celular  | EN desktop  | EN celular  |
| -------- | ----------- | ----------- | ----------- | ----------- |
| Home     | `123:574`   | `123:705`   | `125:3765`  | `125:4026`  |
| Listagem | `125:2472`  | `125:2595`  | `125:4291`  | `125:4490`  |
| Detalhe  | `123:838`   | `123:954`   | `125:4693`  | `125:4961`  |
| Sobre    | `134:13116` | `134:13205` | `134:13298` | `134:13435` |

O segundo exemplo de case EN usa `126:8101` no desktop e `126:8293` no celular, como variação da mesma composição. Os campos de papel e escopo aparecem em `125:4710`. A página de componentes é `123:178`, e a documentação de tokens é `123:1155`, na página `123:177`.

A referência usa tema claro, Cherry Cola, fontes do sistema e Georgia. Os valores mantidos pela implementação estão em [tokens.css](../src/stylesheets/tokens.css). O desktop de referência tem 1.440 px, conteúdo de 1.280 px, margens de 80 px, grid de 32 px e intervalo de seção de 64 px. O celular de referência tem 390 px, padding de 24 px e conteúdo de 342 px. Larguras intermediárias e zoom precisam preservar leitura e navegação.

| Página   | Estrutura de conteúdo                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Home     | Navegação, hero com apresentação e retrato, projetos, Sobre e trajetória, Abordagem e footer                                               |
| Sobre    | Abertura editorial, introdução e retrato, percurso, fotografias, pausa editorial, abordagem, Em movimento, encerramento e acesso aos cases |
| Listagem | Abertura e cards dos cases publicados no idioma, ordenados editorialmente                                                                  |
| Case     | Retorno aos projetos, identificação editorial, título, introdução, capa, papel e escopo, nota de contexto, sumário, narrativa e footer     |

Os modelos demonstrativos permanecem em rascunho até a revisão final. Cases reais ou conceituais de autoria da profissional podem ser publicados após revisão e identificação adequada. Resultados, métricas, depoimentos e experiências precisam corresponder ao conteúdo aprovado.

O header usa Projetos, Sobre, Currículo e Contato, conforme a decisão posterior ao Figma. A seção Abordagem continua na Home. As imagens editoriais utilizam os originais aprovados e seus derivados. A implementação centraliza os tokens visuais no código.

## Idiomas e rotas

| Página  | Português          | Inglês             |
| ------- | ------------------ | ------------------ |
| Home    | `/pt`              | `/en`              |
| Cases   | `/pt/cases`        | `/en/cases`        |
| Detalhe | `/pt/cases/[slug]` | `/en/cases/[slug]` |
| Sobre   | `/pt/sobre`        | `/en/about`        |

Uma URL com idioma explícito prevalece sobre cookie e navegador. A entrada em `/` usa HTTP `307` e `Cache-Control: private, no-store`, segundo esta ordem.

1. Escolha manual anterior válida, salva no cookie funcional.
2. Preferência compatível do navegador entre português e inglês.
3. Inglês.

O cookie funcional `portfolio_locale` contém somente `pt` ou `en` e vale 180 dias desde a última escolha manual no seletor. Uma nova escolha renova a preferência e o prazo. Visitas comuns preservam a expiração existente. Depois de expirar ou ser apagado, a entrada volta à negociação pelo navegador e ao fallback inglês. Valores inválidos são descartados. Esse cookie atende à preferência de idioma e permanece separado do Analytics.

Ao trocar de idioma, a página equivalente publicada mantém o mesmo trecho de leitura e sua posição na tela, compensando diferenças de texto, imagens e fontes. Cases equivalentes são relacionados pela identidade permanente. Seções e blocos equivalentes usam identidades estáveis, preservadas ao renomear ou reordenar. A implementação considera também o histórico do navegador.

Se o case estiver sem tradução publicada no idioma escolhido, a navegação abre a listagem desse idioma no topo e apresenta um aviso acessível no idioma de destino. Traduções privadas ficam ausentes da listagem e dos destaques públicos.

## Navegação, contatos e currículo

O header e o menu de celular oferecem os mesmos quatro itens, na ordem abaixo. A marca retorna à Home no idioma atual.

| Item PT / EN        | Destino                                              |
| ------------------- | ---------------------------------------------------- |
| Projetos / Projects | Listagem de cases do idioma atual                    |
| Sobre / About       | Página Sobre do idioma atual                         |
| Currículo / Resume  | PDF publicado no Perfil profissional do idioma atual |
| Contato / Contact   | `#contact` no footer da página atual                 |

O currículo abre em nova aba, com indicação acessível, preservando a aba do portfólio. Contato mantém página e idioma, funciona por teclado e respeita movimento reduzido. O header considera a posição de chegada para deixar o destino visível.

Rótulos são editáveis por idioma. Destinos internos usam alternativas tipadas que o sistema resolve para página, currículo ou âncora. A finalidade fixa dos itens permanece vinculada à sua identidade. E-mail e LinkedIn usam campos próprios validados no Perfil profissional publicado. Footer e header consomem esses dados e a mesma referência de currículo.

## Modelo editorial

| Collection              | Responsabilidade                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `cases`                 | Identidade permanente, identificação interna do projeto, ordem e destaque compartilhados |
| `case-content`          | Documento editorial de cada case e idioma, com rascunhos, versões e publicação próprios  |
| `site-navigation`       | Header, footer, rótulos e destinos por idioma                                            |
| `professional-profiles` | Apresentação, Sobre, contatos, currículo e metadados por idioma                          |
| `media`                 | Arquivos, metadados técnicos, derivados e referências de uso/acesso                      |
| `case-routes`           | Reserva de endereços por idioma e identidade do case                                     |
| `users`                 | Contas administrativas e recuperação nativa do Payload                                   |

Cada case possui no máximo um documento editorial por idioma. Pode existir somente uma tradução. Ordem e destaque são compartilhados, enquanto conteúdo e publicação são independentes. Alterar os metadados compartilhados preserva o estado editorial de cada tradução. Selecionar um destaque exibe apenas as traduções publicadas.

Navegação e Perfil profissional possuem exatamente um documento PT e um EN cada. Os quatro documentos estruturais são provisionados como rascunhos, permanecem editáveis e têm exclusão e alteração de idioma bloqueadas no servidor. Depois da primeira publicação válida, cada documento também impede retirada de publicação. Novos rascunhos preservam sua versão pública até uma publicação explícita e válida.

Unicidade editorial e de rotas é garantida no servidor e no PostgreSQL, inclusive em gravações concorrentes. O histórico de versões pertence ao documento e preserva essas identidades.

### Conteúdo do case

Cada documento editorial contém referência obrigatória ao case, idioma `pt` ou `en`, título, resumo/introdução, slug, capa, papel profissional, escopo, nota de contexto, seções, blocos e metadados públicos de busca/compartilhamento. Campos separados podem representar textos distintos de card e abertura previstos na referência. Valores derivados utilizam a fonte editorial correspondente.

Publicar exige título, resumo, slug válido, capa, papel profissional e pelo menos um bloco. A validação informa os campos que impedem a publicação. O CMS oferece texto formatado com parágrafos, listas, links e destaques, imagem única e dupla de imagens. No celular, a dupla empilha preservando a ordem editorial.

As seções organizam a narrativa e seus títulos. O sumário deriva dos títulos e da ordem efetivamente publicados. Comparações antes/depois utilizam uma apresentação predefinida dos dados permitidos. Títulos, header, footer e rótulos usam texto simples. HTML arbitrário, scripts, estilos livres, vídeos, carrosséis, embeds e construtor livre de páginas ficam fora dos formatos editoriais aprovados.

### Perfil profissional e Navegação

O Perfil reúne identificação profissional, hero da Home, retrato, Sobre e trajetória da Home, cartões de Abordagem, página Sobre, fotografias, seção Em movimento, encerramento, contatos, currículo e metadados. Os campos seguem os arranjos da referência visual.

Navegação reúne a marca, rótulos e destinos do header e a identificação, títulos, descrição e rótulos do footer. A lista de contatos recebe a âncora estável `contact`. E-mail, LinkedIn e currículo vêm do Perfil profissional publicado no mesmo idioma.

A publicação de cada grupo valida seu conteúdo obrigatório. Conteúdo final, metadados, contatos e currículos PT/EN passam pela revisão editorial antes da abertura pública.

## Publicação, recuperação e concorrência

Publicar, editar ou retirar PT preserva a publicação EN, e vice-versa. Publicar Navegação PT preserva Perfil PT e Navegação EN. Rascunhos incompletos mantêm a última versão pública válida.

Recuperar uma versão anterior de case, Navegação ou Perfil gera um rascunho para revisão no documento e idioma escolhidos, preservando identidade e relacionamentos. A versão pública só muda depois da publicação explícita, com as validações normais.

Um bloqueio temporário permite uma pessoa editando cada documento. Outra pessoa pode consultá-lo em leitura. Documentos distintos, inclusive as traduções de um case, permitem edição simultânea. A saída da edição ou inatividade libera o bloqueio conforme a configuração técnica. Sessões desatualizadas recebem conflito e precisam atualizar antes de gravar novamente.

O servidor verifica sessão, permissão, bloqueio, revisão, identidade, entradas e referências de mídia, incluindo operações diretas da API e do Payload. Gravação editorial, disponibilização de mídia e atualização pública possuem fronteiras de falha próprias. As transações aplicáveis protegem conteúdo, estado e rotas. Operações internas privilegiadas usam contexto e finalidade delimitados.

A atualização pública abrange os detalhes, listagens, destaques, rotas, metadados e destinos de idioma afetados. Reordenar ou alterar destaque também atualiza listagem e Home. Se a gravação terminar e a confirmação pública falhar, o CMS mostra o resultado parcial e permite repetição segura. Uma tentativa antiga respeita a publicação mais recente. A [arquitetura](architecture.md) descreve a geração pública confirmada e sua recuperação.

## Slugs e histórico de endereços

O CMS sugere o slug pelo título. O campo permanece editável e alterações posteriores do título preservam o slug escolhido. O formato aceita letras minúsculas sem acentos, números e hífens, até 80 caracteres. Rascunho incompleto pode ficar sem slug. Publicação exige slug válido.

A combinação idioma/slug pertence a um case e é única entre endereços atuais, reservados por rascunhos e históricos. O mesmo slug pode existir em PT e EN. Ao aceitar um slug, o sistema reserva atomicamente ou informa conflito para escolha de outro, preservando reservas de terceiros. Palavras reservadas correspondem a conflitos reais do roteamento.

| Operação                                | Efeito sobre os endereços                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Trocar slug de rascunho nunca publicado | Libera a reserva anterior elegível                                                       |
| Preparar novo slug de case publicado    | Reserva o novo e mantém o endereço público atual                                         |
| Publicar mudança                        | O novo vira atual e os antigos continuam reservados, redirecionando diretamente para ele |
| Retomar histórico do próprio case       | Exige publicação explícita e reorganiza os destinos sem ciclos ou cadeias                |
| Recuperar versão                        | Respeita as reservas e mantém a URL pública até a publicação explícita                   |
| Retirar case de publicação              | Torna a versão e seus endereços indisponíveis, preservando a outra tradução publicada    |

Uma reserva que já foi pública continua protegida ao voltar o conteúdo a rascunho. Endereços atuais publicados respondem `200`; os históricos usam `308`, permanecem no idioma de cada endereço e chegam ao destino atual em um salto.

## Mídias e privacidade

| Recurso   | Contrato de upload                           |
| --------- | -------------------------------------------- |
| Imagens   | JPEG, PNG, WebP e AVIF, até 10.000.000 bytes |
| Currículo | PDF que abre sem senha, até 5.000.000 bytes  |
| SVG       | Upload editorial permanentemente rejeitado   |

O servidor valida os bytes e o tipo real. O processamento ocorre na aplicação e gera derivados adequados, com proporções e dimensões que reservam espaço no layout. A implementação aceita WebP animado e rejeita PNG e AVIF animados. Imagens fora da área inicial carregam sob demanda. Os arquivos e derivados usam o armazenamento configurado para o ambiente, com R2 nos alvos remotos.

Imagens informativas exigem alternativa textual no idioma e contexto do uso. Imagens decorativas possuem classificação explícita e alternativa vazia apropriada. Legendas são opcionais. Uma mídia compartilhada permite descrições editoriais diferentes entre PT e EN.

Originais, thumbnails, derivados e otimização seguem o mesmo controle de acesso. Prévia autenticada pode entregar mídia privada e usa caminho separado do cache público. A publicação libera apenas os arquivos aprovados e referenciados na geração pública confirmada. A retirada da última referência pública revoga seu acesso. Arquivos publicados em uso têm exclusão bloqueada.

Uma mídia já pública reutilizada em rascunho conserva a exposição decorrente de sua referência pública. Arquivos de outros rascunhos continuam protegidos. O controle de acesso independe da dificuldade de adivinhar a URL. Backups e retenção de arquivos seguem o [guia de operação](operations.md).

## Acesso, renderização e erros

O Payload concentra o acesso ao conteúdo, a autenticação e a recuperação de senha. Contas são criadas administrativamente. Recuperação usa e-mail cadastrado e link temporário, com rejeição de tokens inválidos/expirados e proteção contra abuso. Todas as operações verificam permissões no servidor e o login possui proteção contra tentativas repetidas.

Conteúdo público limita-se ao idioma e publicação solicitados. Rascunhos e prévias exigem sessão válida. Homologação possui autenticação. Segredos, credenciais e referências privadas ficam no servidor, fora do repositório, imagem e navegador. Respostas e logs usam mensagens seguras e identificadores de correlação.

Páginas públicas renderizam no servidor. Publicação, retirada e reordenação atualizam o conteúdo afetado sem reconstruir o site inteiro. Durante falhas temporárias do banco/CMS, a última geração pública confirmada disponível continua atendendo. Uma requisição que depende de conteúdo sem cópia confirmada recebe indisponibilidade apropriada.

Falhas distinguem entrada inválida, conflito, ausência de autorização, conteúdo indisponível e atualização pública pendente. Um case retirado apresenta “Case indisponível”, com acesso à listagem e ao contato no idioma do endereço. A implementação usa `410` para rota retirada, `404` para desconhecida ou privada e `503` para dependência necessária indisponível. Mensagens públicas preservam a confidencialidade dos rascunhos.

## SEO e Analytics

Cada idioma possui títulos, descrições, imagem de compartilhamento e URLs canônicas coerentes. Alternates representam traduções publicadas disponíveis. O sitemap contém páginas públicas publicadas. Descoberta e navegação funcionam diretamente nas URLs com idioma explícito. Painel, rascunhos, prévias e homologação ficam fora da indexação e as áreas privadas mantêm controle de acesso.

A medição usa GA4, automática no site público de produção quando sua ativação for autorizada. Mantém `analytics_storage: denied` permanentemente, sem cookies analíticos, banner de escolha, publicidade, remarketing, User-ID, fingerprinting ou identificadores persistentes alternativos. O cookie de idioma mantém somente sua finalidade funcional.

Os eventos permitidos cobrem visitas às páginas, idioma utilizado, cliques em e-mail, cliques em LinkedIn e acionamento do currículo do idioma atual. O evento de currículo registra a ação para abrir o PDF. Painel, prévias, rascunhos, navegação editorial, testes e staging ficam excluídos. URLs, parâmetros e rótulos passam por tratamento que impede o envio de nomes, e-mails, credenciais e conteúdo privado.

A ativação depende de validar o SDK, o ambiente e as métricas efetivamente disponíveis sob essas restrições. O estado de ativação e sua condição de conclusão ficam no [registro atual](current-status.md). Os testes sintéticos bloqueiam tráfego de medição para o Google.

## Qualidade e operação

A implementação deve atender aos requisitos de WCAG 2.2 AA nos fluxos entregues, incluindo teclado, foco visível e previsível, contraste, semântica, descrições de imagens, estados e mensagens acessíveis. Responsividade inclui tablet e preserva leitura sem rolagem horizontal indevida. Movimento reduzido acompanha menus, botões, avisos e navegação. A exceção aceita para revisão formal com leitor de tela está no [estado atual](current-status.md).

| Meta de laboratório | Celular | Desktop |
| ------------------- | ------- | ------- |
| LCP                 | ≤2,5 s  | ≤2,5 s  |
| CLS                 | ≤0,1    | ≤0,1    |
| TBT                 | ≤200 ms | ≤150 ms |

A matriz cobre Home, listagem e case representativo mais pesado, em PT/EN e celular/desktop. São 12 cenários e pelo menos três repetições equivalentes por cenário, com mediana, variação e falhas registradas. As condições são definidas antes da medição. A referência de INP é p75 ≤200 ms, por perfil de dispositivo, quando houver amostra real suficiente. O [guia de operação](operations.md) contém o protocolo e os critérios de revalidação.

A combinação de Next.js, React, Payload e Node usa versões estáveis compatíveis, fixadas no manifesto e lockfile. Avisos de segurança são revistos antes de produção. Novas dependências exigem necessidade concreta, e atualizações principais têm escopo explícito.

Comportamentos e correções seguem TDD, com falha inicial pelo motivo esperado, implementação mínima e refatoração verificada. Testes acompanham o código responsável e exercitam os contratos e jornadas pertinentes.

Tipagem, lint, formato, testes pertinentes, arquitetura e build verificam as alterações. Unidades, arquitetura e scripts rodam no CI Linux sem banco. Integração, E2E e recuperação usam o banco local fixo com exclusividade e limpeza autorizada entre rodadas. Os três bancos de aplicação são produção, staging e local. Os resultados e sua identidade de fonte permanecem no registro atual.

Produção e staging usam dados, mídias, namespaces e credenciais separados. A mesma imagem validada em staging é promovida por digest para produção, com configuração de ambiente em execução. Backup criptografado, retenção de 56 dias, migrações controladas, recuperação com checkpoint no banco local e saúde seguem o guia operacional. Abertura pública e ativação de Analytics dependem das decisões registradas.

## Origem desta consolidação

As decisões foram consolidadas a partir da especificação e dos contratos aprovados em 29/10/2026, com as instruções posteriores do usuário e a implementação registrada. As versões anteriores podem ser consultadas no Git no commit `a2d06a1ada1b1c1e6bb491776b025419c14a7401`. O histórico de entrevista, os planos de etapas entregues e os catálogos de ferramentas permanecem nesse histórico. As pendências atuais são mantidas em `current-status.md`.
