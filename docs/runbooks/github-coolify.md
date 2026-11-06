# GitHub Actions → Coolify por ambiente

## Mapeamento aprovado

| Branch    | Ambiente GitHub e Coolify      | Comportamento                                                                                  |
| --------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `develop` | `staging` — ambiente de testes | Verificar, construir uma imagem privada, atualizar o digest e fazer redeploy do recurso `app`. |
| `main`    | `production` — quando existir  | Promover o mesmo digest já validado em staging, sem reconstruir a imagem.                      |

Staging ativado e validado em 06/11/2026. A [PR1](https://github.com/joeldorosarioo/a-design-for-life/pull/1) foi integrada normalmente após os checks obrigatórios. O [primeiro workflow completo](https://github.com/joeldorosarioo/a-design-for-life/actions/runs/42225045302) publicou a imagem privada, concluiu o deploy com Running/Healthy e registrou o mesmo manifesto homologado. STAGING_AUTODEPLOY_ENABLED=true está no repositório; produção permanece ausente e desativada. [Evidência sem credenciais](../verification/artifacts/E3-operations/github-coolify-activation-001.json).

O job de verificação existente, `type-lint-test-architecture-build`, mantém o nome e os passos obrigatórios. O `pnpm verify` inclui os testes dos clientes de deploy. Pull requests e branches diferentes continuam passando pelas verificações, sem publicar imagem ou fazer deploy. A fila por branch cobre verificação, publicação, redeploy e registro da imagem saudável.

## 1. Habilitar a API no Coolify

1. No painel Atlas, abrir **Settings → Advanced → API and MCP**.
2. Habilitar **API access** e salvar.
3. Em **Keys & Tokens → API Tokens**, criar `a-design-for-life-staging-config` com permissões **Read** e **Write**. Esse token consulta a aplicação, atualiza somente a tag da imagem e acompanha o status.
4. Criar outro token, `a-design-for-life-staging-deploy`, com permissão **Deploy**. Esse segundo token solicita o deploy.
5. Guardar os valores em local privado. Eles serão cadastrados como secrets do GitHub; não entram nas variáveis de execução do app nem no Dockerfile.

O dashboard cria um token exclusivamente de deploy quando a permissão Deploy é selecionada. Por isso o fluxo usa duas credenciais, dispensando `root` e `read:sensitive`. Um token criado por API com os três escopos pode ser usado pelo cliente, mas não é necessário neste roteiro. Tokens pertencem ao time ativo no momento da criação; usar o time ao qual pertence o projeto.

[Permissões da API](https://coolify.io/docs/api/permissions) e [integração com GitHub Actions](https://coolify.io/docs/applications/sources/github/actions).

## 2. Configurar o environment staging no GitHub

No repositório `joeldorosarioo/a-design-for-life`, abrir **Settings → Environments → New environment** e usar `staging`. Se o environment já existir, editar o existente.

Em **Deployment branches and tags**, selecionar **Selected branches and tags** e permitir somente a branch `develop`.

Em **Environment secrets**, cadastrar:

| Nome                   | Valor                                        |
| ---------------------- | -------------------------------------------- |
| `COOLIFY_TOKEN`        | Token Read + Write criado no passo anterior. |
| `COOLIFY_DEPLOY_TOKEN` | Token exclusivo de Deploy.                   |

Em **Environment variables**, cadastrar:

| Nome                      | Valor atual                                |
| ------------------------- | ------------------------------------------ |
| `COOLIFY_URL`             | `https://panel.joeldorosarioo.dev`         |
| `COOLIFY_RESOURCE_UUID`   | `1tiveqtdwa1kxsjfhtugcjdp`                 |
| `APPROVED_MIGRATION_TREE` | `863d5c13d017c3435b43a2e4e9cc36d68b06f89a` |

Esse último valor identifica o diretório de migrações do schema17 já aplicado e verificado em staging. Quando uma nova migração for adicionada, o deploy é recusado até realizar backup, aplicar/verificar a migração e atualizar esse valor. O cliente não altera o banco nem aprova um schema por conta própria.

Não importar o .env inteiro para o GitHub ou para o build. PostgreSQL, R2, Resend e o segredo do Payload continuam nas variáveis de execução do recurso no Coolify.

[Environments e proteção por branch](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## 3. Permitir publicação no GHCR privado

No pacote `a-design-for-life` em GitHub Packages, conferir que a visibilidade continua **Private**. Em **Package settings → Manage Actions access**, conceder acesso **Write** ao repositório `a-design-for-life`, caso ele ainda não tenha esse acesso.

O workflow usa o `GITHUB_TOKEN` temporário, com `packages: write` somente nos jobs necessários. Não depende do PAT manual de publicação. A autenticação de leitura já configurada na VPS continua permitindo que o Coolify baixe as imagens privadas.

## 4. Ativar e validar staging

1. Enviar as mudanças por pull request e integrá-las a `develop` depois do check obrigatório. A integração inicial já foi concluída; novas alterações seguem o mesmo caminho pela develop protegida.
2. Em **Settings → Secrets and variables → Actions → Variables → New repository variable**, cadastrar `STAGING_AUTODEPLOY_ENABLED=true`. Essa é uma variável do repositório, não do environment nem do app.
3. Fazer o próximo push/merge em `develop` e acompanhar **Actions → Checks**. A sequência é verificação → build/publicação → deploy staging → registro da imagem saudável.
4. No Coolify, conferir o novo Deployment Log e `Running / Healthy`; o cliente já aguarda esses dois resultados antes de aprovar a execução.
5. Conferir no `/admin` o comportamento da versão. A imagem recebe uma tag por commit e o recurso é atualizado para um digest imutável; não é necessário copiar manualmente o hash a cada release.

O cliente altera somente `docker_registry_image_tag`. Volumes, cotas, usuário, comando de entrada, healthcheck e variáveis existentes não são regravados. Manter **Consistent name (no rolling updates)** para a stack que reúne PostgreSQL e Next no mesmo container.

## Produção futura

Deixar `PRODUCTION_AUTODEPLOY_ENABLED` ausente. Quando o ambiente de produção existir e seu lançamento estiver autorizado, criar o environment GitHub `production`, permitir somente `main`, configurar seus próprios tokens/UUID/schema aprovado e adicionar a revisão humana exigida para releases.

A promoção usa um marcador `staging-tested-tree-<árvore Git>`, criado somente depois que o deploy de staging ficou saudável. Ele aponta aos mesmos bytes do manifesto. O código em `main` precisa ter a mesma árvore do código homologado, inclusive quando o merge cria um SHA de commit diferente. Sem imagem homologada correspondente, o job recusa a promoção e não faz um build substituto.

A configuração de produção não foi criada nem ativada nesta rodada. O mapeamento por branch não equivale à aprovação de lançamento.

## Verificação local

Executar `pnpm test:deploy` para os testes offline de API, guardas por branch/schema/UUID, status de deploy, pacote privado e promoção do mesmo manifesto. `pnpm verify` também executa esses testes. Os cenários usam respostas simuladas: não substituem a primeira execução real do GitHub Actions nem um deploy autenticado no Coolify.
