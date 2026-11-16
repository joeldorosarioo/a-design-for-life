# Arquitetura

Next.js e Payload rodam na mesma aplicação. O Payload concentra a edição e o acesso ao PostgreSQL. A [especificação](specification.md) define os contratos e o [guia operacional](operations.md) explica como executar os fluxos.

## Módulos

- `src/app` compõe as rotas e as features de cases, perfil, navegação, idioma, mídia e Analytics.
- `src/config` prepara o contexto das requisições e conecta as features.
- `src/helpers` fornece infraestrutura compartilhada. `src/components/ui` reúne as primitivas visuais.
- As rotas do portfólio e as outras features usam as entradas públicas `index.ts`, `ui.ts` ou `server.ts`. Imports internos da própria feature permanecem locais. Helpers e componentes genéricos não dependem de features, nem por dependências transitivas. O grafo de módulos não admite ciclos.

Zod valida as fronteiras. Os tipos gerados do Payload representam o conteúdo persistido. Banco, armazenamento e segredos ficam nos módulos de servidor.

## Ambientes e identidade

O [README](../README.md#verificação) define os três bancos fixos e a conexão local. No Compose, PostgreSQL usa o volume externo e Next.js roda no host.

Desenvolvimento e testes disputam uma reserva exclusiva. O ciclo de testes limpa dados entre rodadas e usa checkpoint nos ensaios de recuperação, sem criar bancos.

No contêiner, a aplicação usa `appuser`, UID/GID `70:70`, e as ferramentas de backup usam `10001:10001`. Os arquivos locais privados pertencem à identidade que os cria; no Windows, as ACLs usam o SID atual. Esses papéis não exigem um login Windows específico.

Mídia local, publicações e captura de e-mail ficam em namespaces de `.work`. Staging e produção usam dados, mídias e credenciais separados. A configuração entra na execução da mesma imagem. Os fluxos de verificação e promoção estão no [guia operacional](operations.md#ci-e-staging).

## Edição e publicação

`cases` mantém a identidade, ordem e destaque do projeto. `case-content` guarda as traduções com publicação independente. Navegação e Perfil também publicam por idioma. Revisão e bloqueio de edição protegem as operações nativas do Payload, incluindo a API. Recuperar uma versão cria um rascunho.

A gravação editorial registra a intenção de publicação na mesma transação. Após o commit, um coordenador serializado confirma uma geração pública completa e reconcilia o recibo.

Cada requisição captura `current.json` uma vez. Conteúdo, metadados, rotas e autorização de mídias leem a mesma geração. Snapshots privados mantêm essa referência durante a renderização. Enquanto uma atualização está pendente, a geração anterior continua disponível.

Uma repetição reconcilia a intenção sem substituir uma publicação mais nova. O armazenamento das gerações precisa persistir entre reinícios e fazer parte do backup. A prévia autenticada lê rascunhos e mídias privadas fora do cache público.

## Leitura e mídia

As reservas de rota pertencem a um case e idioma. O histórico aponta diretamente para o slug atual. Os contratos de redirecionamento, retirada e indisponibilidade estão na [especificação](specification.md#slugs-e-histórico-de-endereços).

O servidor valida os bytes dos uploads e gera os derivados na aplicação. O desenvolvimento pode usar armazenamento local e os alvos remotos usam R2. Originais, derivados e otimizador consultam a mesma autorização. Retirar a última referência pública revoga o acesso.

A última geração confirmada pode atender durante uma falha temporária da origem. Sem conteúdo confirmado suficiente, a resposta indica indisponibilidade. Falhas não viram listas vazias nem conteúdo inexistente.

## Configuração

A configuração é lida no servidor. O navegador recebe apenas os campos públicos permitidos.

A escolha de idioma, a preservação da leitura e o fallback seguem a especificação. O Figma orienta a interface e os tokens ficam no código. Analytics mede somente respostas públicas válidas de produção quando ativado, sob a política de privacidade aprovada.

## Fixtures de mídia

Os controles de animação em `testing/fixtures/media-animation-assets` servem aos testes dos [contratos de upload](specification.md#mídias-e-privacidade). O AVIF é cópia sem alteração do [libavif `9b07a9d7a874b159bb4e14b80a6f08bb469d06f7`](https://github.com/AOMediaCodec/libavif/tree/9b07a9d7a874b159bb4e14b80a6f08bb469d06f7/tests/data); os APNGs vêm do [libvips `b04300c241934a895d826054e906f3e238e23924`](https://github.com/libvips/libvips/tree/b04300c241934a895d826054e906f3e238e23924/test/test-suite/images).

| Arquivo                                                                                           | Bytes | SHA256                                                             |
| ------------------------------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| [colors-animated-8bpc.avif](../testing/fixtures/media-animation-assets/colors-animated-8bpc.avif) | 1.235 | `2f8683d21725261f37f86e115f0c212cc52d0fefd3a2ddfcc4fa648c1859906d` |
| [cogs-apng.png](../testing/fixtures/media-animation-assets/cogs-apng.png)                         | 2.706 | `728c47dd0f1901e050308852d18800f3a42dd658f04ea2eadf98b24cac7164eb` |
| [apng-hidden-frame.png](../testing/fixtures/media-animation-assets/apng-hidden-frame.png)         |   232 | `5bd93be180977db214559e896c77077cc13eba8aa2120667ca1d8ca5422d20d3` |

O AVIF segue a [licença BSD-2-Clause do libavif](../testing/fixtures/media-animation-assets/libavif-LICENSE.txt); os APNGs preservam a [licença LGPL-2.1 do libvips](../testing/fixtures/media-animation-assets/libvips-LICENSE.txt).

`cogs-apng.png` tem cinco quadros. `apng-hidden-frame.png` tem dois e apresenta uma imagem padrão branca diferente do primeiro quadro vermelho. Decodificar apenas a imagem estática não comprova ausência de animação.

[media-animation.ts](../testing/fixtures/media-animation.ts) gera os controles WebP com Sharp a partir de quadros sintéticos coloridos, delays e loop explícitos, incluindo variações de transparência e orientação EXIF. O encoder normaliza delays solicitados de até 10 ms para 100 ms; os testes usam delays efetivamente codificados de 100/200/300 ms.
