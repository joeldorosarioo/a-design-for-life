# Arquitetura

Next.js e Payload rodam na mesma aplicação. O Payload concentra a edição e o acesso ao PostgreSQL. A [especificação](specification.md) define os contratos e o [guia operacional](operations.md) explica como executar os fluxos.

## Módulos

- `src/app` compõe as rotas e as features de cases, perfil, navegação, idioma, mídia e Analytics.
- `src/config` prepara o contexto das requisições e conecta as features.
- `src/helpers` fornece infraestrutura compartilhada. `src/components/ui` reúne as primitivas visuais.
- As features expõem contratos, UI e operações de servidor pelas entradas públicas que precisam. As regras de arquitetura impedem ciclos e acesso ao banco ou armazenamento pelo navegador.

Zod valida as fronteiras. Os tipos gerados do Payload representam o conteúdo persistido.

## Ambientes e identidade

Há três bancos de aplicação fixos, um de produção, um de staging e um local. Desenvolvimento, integração e E2E compartilham `127.0.0.1:5432/a_design_for_life_rebuild`, com o usuário e a senha configurados no `.env`.

No ambiente local, Next.js roda no host e o Compose mantém somente PostgreSQL no volume externo. Desenvolvimento e testes disputam uma reserva exclusiva. Os testes limpam dados entre rodadas e usam checkpoint nos ensaios de recuperação, sem criar bancos descartáveis.

No contêiner, a aplicação usa `appuser`, UID/GID `70:70`. As ferramentas de backup usam UID `10001`. Os arquivos locais privados pertencem à identidade que os cria. Esses papéis não exigem um login Windows específico.

Mídia local, publicações e captura de e-mail ficam em namespaces de `.work`. Staging e produção usam dados, mídias e credenciais separados. O CI verifica tipos, lint, formato, unidades, arquitetura, scripts e build sem banco. Integração, E2E e recuperação usam o banco local antes do aceite da candidata.

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

A configuração é lida no servidor. O navegador recebe apenas os campos públicos permitidos. A mesma imagem recebe a configuração de cada ambiente na execução.

A escolha de idioma, a preservação da leitura e o fallback seguem a especificação. O Figma orienta a interface e os tokens ficam no código. Analytics mede somente respostas públicas válidas de produção quando ativado, sob a política de privacidade aprovada.
