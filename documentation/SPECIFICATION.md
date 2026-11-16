# Especificação do portfólio

Esta é a referência de comportamento e conteúdo do portfólio. As decisões mais recentes do usuário prevalecem. Consulte a [arquitetura](ARCHITECTURE.md) para entender o código, o [guia de operação](OPERATIONS.md) para os procedimentos e as [pendências](PENDING.md) para verificações, exceções e lançamento.

## Objetivo e escopo

O portfólio apresenta o trabalho de uma profissional de Product Design e UX, com foco em contatos de empregadores para emprego fixo. Freelances são uma oportunidade secundária. O visitante deve conseguir conhecer o perfil, avaliar cases, abrir o currículo e entrar em contato em português ou inglês.

O site tem Home, listagem, detalhe de case e Sobre, adaptados para celular, tablet e desktop. O contato principal é por e-mail, com LinkedIn como alternativa. Cada idioma tem seu currículo em PDF. Pelo Payload, quem edita altera cases, apresentação, Sobre, navegação, textos globais e contatos, ordena os projetos e escolhe os destaques da Home.

Duas contas individuais têm as mesmas permissões. Cada pessoa salva rascunhos, confere a prévia autenticada e publica. Blog, busca interna, formulário de contato, loja, comentários, cadastro público e aprovação entre editores dependem de ampliação expressa do escopo.

## Referência visual e conteúdo

O Figma define cores, fontes, composição, componentes, ativos e formatos editoriais. A página **03 · Layout proposto** reúne 18 frames e 14 componentes de referência. A implementação adapta os layouts às telas e à acessibilidade. Mudanças visuais relevantes exigem aprovação. [Figma do projeto](https://www.figma.com/design/PXUcVZFdLuOzHQZkD5PU4b/Untitled?node-id=123-179).

Os IDs abaixo permitem reencontrar os frames no arquivo `PXUcVZFdLuOzHQZkD5PU4b`.

| Página   | PT desktop  | PT celular  | EN desktop  | EN celular  |
| -------- | ----------- | ----------- | ----------- | ----------- |
| Home     | `123:574`   | `123:705`   | `125:3765`  | `125:4026`  |
| Listagem | `125:2472`  | `125:2595`  | `125:4291`  | `125:4490`  |
| Detalhe  | `123:838`   | `123:954`   | `125:4693`  | `125:4961`  |
| Sobre    | `134:13116` | `134:13205` | `134:13298` | `134:13435` |

O segundo exemplo de case EN usa `126:8101` no desktop e `126:8293` no celular. É uma variação da mesma composição. Papel e escopo aparecem em `125:4710`. Os componentes estão em `123:178`; os tokens, em `123:1155`, na página `123:177`.

A referência usa tema claro, Cherry Cola, fontes do sistema e Georgia. O desktop tem 1.440 px, conteúdo de 1.280 px, margens de 80 px, grid de 32 px e intervalo de seção de 64 px. O celular tem 390 px, padding de 24 px e conteúdo de 342 px. Larguras intermediárias e zoom devem preservar leitura e navegação. Os valores usados no código ficam em [tokens.css](../src/stylesheets/tokens.css).

| Página   | Estrutura de conteúdo                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Home     | Navegação, hero com apresentação e retrato, projetos, Sobre e trajetória, Abordagem e footer                                               |
| Sobre    | Abertura editorial, introdução e retrato, percurso, fotografias, pausa editorial, abordagem, Em movimento, encerramento e acesso aos cases |
| Listagem | Abertura e cards dos cases publicados no idioma, ordenados editorialmente                                                                  |
| Case     | Retorno aos projetos, identificação editorial, título, introdução, capa, papel e escopo, nota de contexto, sumário, narrativa e footer     |

Modelos demonstrativos ficam em rascunho até a revisão final. Cases reais ou conceituais de autoria da profissional podem ser publicados depois de revisados e identificados. Resultados, métricas, depoimentos e experiências precisam corresponder ao conteúdo aprovado.

A seção Abordagem continua na Home. As imagens usam os originais aprovados e seus derivados. A composição do header segue a decisão descrita em Navegação, contatos e currículo.

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

O cookie funcional `portfolio_locale` guarda somente `pt` ou `en` por 180 dias desde a última escolha manual. Uma nova escolha atualiza a preferência e reinicia o prazo. Visitas comuns mantêm a data de expiração. Quando o cookie expira ou é apagado, a entrada volta a consultar o navegador e depois usa inglês. Valores inválidos são descartados. Esse cookie serve apenas à preferência de idioma e fica separado do Analytics.

Ao trocar de idioma, a página equivalente publicada mantém o trecho de leitura e sua posição na tela, compensando diferenças de texto, imagens e fontes. O sistema relaciona cases pela identidade permanente. Seções e blocos equivalentes usam IDs estáveis, preservados ao renomear ou reordenar. A restauração da leitura também considera o histórico do navegador.

Se o case estiver sem tradução publicada, a troca abre a listagem do idioma escolhido no topo e mostra um aviso acessível nesse idioma. Traduções privadas ficam fora da listagem e dos destaques públicos.

## Navegação, contatos e currículo

O header e o menu de celular usam os quatro itens abaixo, nessa ordem. A marca leva à Home no idioma atual.

| Item PT / EN        | Destino                                              |
| ------------------- | ---------------------------------------------------- |
| Projetos / Projects | Listagem de cases do idioma atual                    |
| Sobre / About       | Página Sobre do idioma atual                         |
| Currículo / Resume  | PDF publicado no Perfil profissional do idioma atual |
| Contato / Contact   | `#contact` no footer da página atual                 |

O currículo abre em nova aba, com indicação acessível, e mantém o portfólio aberto. Contato leva ao footer da página atual, no mesmo idioma, com teclado e movimento reduzido. O header deve deixar o destino visível ao chegar à seção.

Os rótulos são editáveis por idioma. O sistema resolve destinos internos tipados para página, currículo ou âncora, mantendo a finalidade de cada item. E-mail e LinkedIn usam campos próprios validados no Perfil profissional publicado. Header e footer leem esses dados e a mesma referência de currículo.

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

Cada case tem no máximo um documento editorial por idioma e pode existir em apenas um deles. Ordem e destaque são compartilhados. Conteúdo e publicação são independentes. Alterar os dados compartilhados mantém o estado de cada tradução. Destaques exibem somente traduções publicadas.

Navegação e Perfil profissional têm exatamente um documento PT e um EN cada. A configuração inicial cria esses quatro documentos como rascunhos editáveis. O servidor impede exclusão e mudança de idioma. Depois da primeira publicação válida, também impede retirar o documento de publicação. Novos rascunhos mantêm a versão pública até a próxima publicação explícita e válida.

O servidor e o PostgreSQL garantem a unicidade dos documentos e rotas, inclusive em gravações simultâneas. As versões pertencem ao documento e mantêm sua identidade.

### Conteúdo do case

Cada documento editorial contém a referência obrigatória ao case, idioma `pt` ou `en`, título, resumo/introdução, slug, capa, papel profissional, escopo, nota de contexto, seções, blocos e metadados de busca/compartilhamento. Card e abertura podem ter campos separados quando a referência usar textos diferentes. Valores derivados vêm do conteúdo correspondente.

Para publicar, preencha título, resumo, slug válido, capa, papel profissional e pelo menos um bloco. O CMS informa o que falta. Os blocos aceitam texto formatado com parágrafos, listas, links e destaques, imagem única ou dupla de imagens. No celular, a dupla fica na vertical e mantém a ordem editorial.

As seções organizam os títulos e a narrativa. O sumário usa os títulos e a ordem publicados. Comparações antes/depois seguem uma apresentação predefinida. Títulos, header, footer e rótulos usam texto simples. Os formatos aprovados excluem HTML arbitrário, scripts, estilos livres, vídeos, carrosséis, embeds e construtor livre de páginas.

### Perfil profissional e Navegação

O Perfil reúne identificação profissional, hero e retrato, Sobre e trajetória da Home, cartões de Abordagem, página Sobre, fotografias, Em movimento, encerramento, contatos, currículo e metadados. Os campos seguem a composição do Figma.

Navegação reúne marca, rótulos e destinos do header, além de identificação, títulos, descrição e rótulos do footer. A lista de contatos usa a âncora estável `contact`. E-mail, LinkedIn e currículo vêm do Perfil publicado no mesmo idioma.

Cada grupo valida seu conteúdo obrigatório antes de publicar. A abertura pública depende da revisão dos textos, metadados, contatos e currículos PT/EN.

## Publicação, recuperação e concorrência

Publicar, editar ou retirar PT mantém EN como estava, e vice-versa. Publicar Navegação PT mantém Perfil PT e Navegação EN. Um rascunho incompleto conserva a última versão pública válida.

Recuperar uma versão de case, Navegação ou Perfil cria um rascunho para revisão no documento e idioma escolhidos. A identidade e as relações são mantidas. A versão pública só muda após a publicação explícita, com as validações normais.

Cada documento permite uma pessoa editando por vez. A outra pode consultá-lo em leitura. Documentos diferentes, incluindo as traduções do mesmo case, podem ser editados ao mesmo tempo. O bloqueio expira por inatividade ou é liberado ao sair, conforme a configuração técnica. Uma sessão desatualizada recebe um conflito e precisa atualizar antes de salvar.

O servidor confere sessão, permissão, bloqueio, revisão, identidade, entradas e referências de mídia, inclusive nas chamadas diretas à API e ao Payload. Transações protegem conteúdo, estado e rotas. A gravação, a mídia e a atualização pública podem falhar em momentos diferentes. Operações internas privilegiadas têm contexto e finalidade definidos.

A atualização pública inclui detalhes, listagens, destaques, rotas, metadados e destinos de idioma afetados. Reordenar ou mudar um destaque atualiza a listagem e a Home. Se o conteúdo for salvo e a confirmação pública falhar, o CMS informa a pendência e permite tentar novamente com segurança. Uma tentativa antiga preserva a publicação mais recente. A [arquitetura](ARCHITECTURE.md) explica a geração pública confirmada e sua recuperação.

## Slugs e histórico de endereços

O CMS sugere o slug pelo título. Ele continua editável e mantém o valor escolhido quando o título muda. O formato aceita letras minúsculas sem acentos, números e hífens, até 80 caracteres. Rascunho incompleto pode ficar sem slug. Para publicar, o slug deve ser válido.

A combinação idioma/slug pertence a um case e é única entre endereços atuais, rascunhos e histórico. O mesmo slug pode existir em PT e EN. A reserva é atômica. Em caso de conflito, o CMS pede outro valor e mantém a reserva do outro case. Palavras reservadas correspondem a conflitos reais de rota.

| Operação                                | Efeito sobre os endereços                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Trocar slug de rascunho nunca publicado | Libera a reserva anterior elegível                                                       |
| Preparar novo slug de case publicado    | Reserva o novo e mantém o endereço público atual                                         |
| Publicar mudança                        | O novo vira atual e os antigos continuam reservados, redirecionando diretamente para ele |
| Retomar histórico do próprio case       | Exige publicação explícita e reorganiza os destinos sem ciclos ou cadeias                |
| Recuperar versão                        | Respeita as reservas e mantém a URL pública até a publicação explícita                   |
| Retirar case de publicação              | Torna a versão e seus endereços indisponíveis, preservando a outra tradução publicada    |

Uma reserva que já foi pública continua protegida quando o conteúdo volta a rascunho. Endereços atuais publicados respondem `200`. Os históricos usam `308`, mantêm o idioma do endereço e chegam ao destino atual em um salto.

## Mídias e privacidade

| Recurso   | Contrato de upload                           |
| --------- | -------------------------------------------- |
| Imagens   | JPEG, PNG, WebP e AVIF, até 10.000.000 bytes |
| Currículo | PDF que abre sem senha, até 5.000.000 bytes  |
| SVG       | Upload editorial permanentemente rejeitado   |

O servidor valida os bytes e o tipo real do arquivo. A aplicação processa as imagens e gera derivados com proporções e dimensões que reservam espaço no layout. Aceita WebP animado e rejeita PNG e AVIF animados. Imagens fora da área inicial carregam sob demanda. Arquivos e derivados usam o armazenamento do ambiente, com R2 nos alvos remotos.

A validação de PDFs rejeita arquivos vazios e respeita o limite de tamanho acima. Confere extensão `.pdf`, MIME `application/pdf` e assinatura `%PDF-`, e usa PDF.js apenas para carregar o documento. A checagem ocorre durante a requisição; o arquivo é salvo antes de disponibilizar seu link.

Imagens informativas exigem texto alternativo no idioma e contexto de uso. Imagens decorativas têm classificação explícita e alternativa vazia. Legendas são opcionais. A mesma mídia pode ter descrições diferentes em PT e EN.

Originais, thumbnails, derivados e otimização seguem o mesmo controle de acesso. A prévia autenticada pode entregar mídia privada, fora do cache público. A publicação libera apenas arquivos aprovados e referenciados na geração confirmada. Retirar a última referência pública revoga o acesso. Arquivos publicados em uso têm exclusão bloqueada.

Uma mídia pública reutilizada em rascunho continua acessível pela referência publicada. Os demais arquivos privados ficam protegidos, inclusive quando alguém conhece a URL. Backups e retenção seguem o [guia de operação](OPERATIONS.md).

## Acesso, renderização e erros

O Payload cuida do acesso ao conteúdo, da autenticação e da recuperação de senha. As contas são criadas por administrador. A recuperação envia um link temporário ao e-mail cadastrado, rejeita tokens inválidos ou expirados e tem proteção contra abuso. O servidor confere permissões em todas as operações e limita tentativas repetidas de login.

As consultas públicas respeitam o idioma e a publicação solicitados. Rascunhos, prévias e homologação exigem autenticação. Segredos, credenciais e referências privadas ficam no servidor, fora do repositório, imagem e navegador. Respostas e logs usam mensagens seguras e identificadores de correlação.

As páginas públicas são renderizadas no servidor. Publicar, retirar ou reordenar atualiza o conteúdo afetado sem reconstruir o site. Durante uma falha temporária do banco/CMS, a última geração pública confirmada continua disponível. Uma requisição que precisa de conteúdo sem cópia confirmada recebe um estado de indisponibilidade.

O sistema distingue entrada inválida, conflito, falta de autorização, conteúdo indisponível e atualização pública pendente. Um case retirado mostra “Case indisponível”, com acesso à listagem e ao contato no idioma do endereço. A rota retirada responde `410`, uma rota desconhecida ou privada responde `404`, e a falta de uma dependência necessária responde `503`. As mensagens públicas mantêm os rascunhos privados.

## SEO e Analytics

Cada idioma tem título, descrição, imagem de compartilhamento e URLs canônicas coerentes. Alternates apontam para traduções publicadas. O sitemap inclui somente páginas públicas publicadas. A descoberta e a navegação funcionam diretamente nas URLs com idioma. Painel, rascunhos, prévias e homologação ficam fora da indexação e mantêm controle de acesso.

A medição usa GA4 e começa automaticamente no site público de produção quando a ativação for autorizada. Mantém `analytics_storage: denied` permanentemente, sem cookies analíticos, banner de escolha, publicidade, remarketing, User-ID, fingerprinting ou identificadores persistentes alternativos.

Os eventos cobrem visitas às páginas, idioma, cliques em e-mail, cliques em LinkedIn e abertura do currículo do idioma atual. O evento de currículo registra o acionamento para abrir o PDF. Painel, prévias, rascunhos, navegação editorial, testes e staging ficam excluídos. URLs, parâmetros e rótulos são tratados para impedir o envio de nomes, e-mails, credenciais e conteúdo privado.

A ativação depende de conferir o SDK, o ambiente e as métricas disponíveis sob essas restrições. Sua condição de conclusão está nas [pendências](PENDING.md). Testes sintéticos bloqueiam o tráfego de medição para o Google.

## Qualidade e operação

Os fluxos devem atender à WCAG 2.2 AA, com teclado, foco visível e previsível, contraste, semântica, descrições de imagens, estados e mensagens acessíveis. A adaptação inclui tablet e permite ler sem rolagem horizontal indevida. Menus, botões, avisos e navegação respeitam movimento reduzido. A exceção aceita para revisão formal com leitor de tela está nas [pendências](PENDING.md).

| Meta de laboratório | Celular | Desktop |
| ------------------- | ------- | ------- |
| LCP                 | ≤2,5 s  | ≤2,5 s  |
| CLS                 | ≤0,1    | ≤0,1    |
| TBT                 | ≤200 ms | ≤150 ms |

A referência de INP é p75 ≤200 ms por perfil de dispositivo, quando houver amostra real suficiente. Cenários, repetições e registro das medições seguem o [protocolo de performance](OPERATIONS.md#performance). A condição para medir novamente ou reaproveitar uma referência fica nas [pendências](PENDING.md#condições-de-lançamento).

Next.js, React, Payload e Node usam versões estáveis compatíveis, fixadas no manifesto e lockfile. Avisos de segurança são revistos antes de produção. Novas dependências precisam de uma necessidade concreta. Atualizações principais têm escopo explícito.

Comportamentos e correções seguem TDD. Primeiro, o teste falha pelo motivo esperado. A implementação mínima faz o teste passar, e a refatoração mantém o resultado. Os testes ficam junto do código responsável e verificam os contratos e jornadas pertinentes.

Os comandos e ambientes de verificação estão no [README](../README.md#verificação). Backup, migrações, recuperação e promoção de imagem seguem o [guia operacional](OPERATIONS.md). As [pendências](PENDING.md) concentram o que falta para o lançamento e a ativação de Analytics.
