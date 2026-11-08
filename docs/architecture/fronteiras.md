# Fronteiras de módulos e configuração pública

Referência: spec §§6–7 e plano E1.2. Implementação em 29/10/2026, America/Sao_Paulo.

## Grafo permitido

| Origem                                   | Destino permitido                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Rota pública em app                      | Interfaces públicas index.ts/server.ts para compor features; rota fina               |
| payload.config.ts e config de composição | Definições das collections das features, sem obrigar import de barrel de consultas   |
| Uma feature                              | Seus próprios arquivos internos; index.ts ou server.ts de outra feature              |
| helpers e componentes genéricos          | Capacidades técnicas/genéricas; nenhuma dependência direta ou transitiva de features |
| index.ts da feature                      | Contratos e componentes compartilháveis; nenhum caminho runtime a servidor           |
| server.ts da feature                     | Operações exclusivas do servidor, com import direto de server-only                   |
| Módulo com diretiva use client           | Apenas dependências que não alcancem servidor no grafo runtime                       |

A restrição de entrada pública é **entre features**. Não se força payload.config.ts a passar por server.ts que reexporta consultas: isso criaria um ciclo config → consulta → getPayload → config. Hooks usam req.payload e imports internos da própria feature. A configuração compõe definições; helpers não passam a conter regras editoriais.

Não há exceção para dependências circulares, inclusive quando são só de tipos. Os caminhos de import são resolvidos, portanto trocar alias por caminho relativo não contorna as regras.

## Verificações automatizadas

`dependency-cruiser.config.cjs` define quatro regras: ausência de ciclos; apenas entradas públicas entre features; rotas públicas acessando interfaces públicas; helpers/componentes genéricos sem caminho para features. `tsPreCompilationDeps: true` inclui dependências de tipos. `reachable: true` cobre pontes intermediárias. A API/CLI real resolve aliases pelo tsconfig. Pacotes externos não são percorridos como se fossem módulos do projeto; testes colocados ao lado são excluídos do grafo de produção e executados por seus runners.

`src/config/architecture.ts` usa o grafo real e a AST do TypeScript. Uma diretiva é reconhecida no prólogo de statements; comentários, textos arbitrários e nomes de arquivo não determinam a condição de cliente. O percurso runtime ignora somente imports que o grafo classifica como type-only. Ele rejeita caminhos de clientes ou do index compartilhável a:

- módulo com import runtime de server-only;
- entrada `features/*/server.ts`;
- arquivos em `features/*/server/` e `features/*/content/`;
- módulos que importem/reexportem em runtime o pacote raiz `payload` ou adaptadores `@payloadcms/db-*`.

A classificação de capacidades externas é restrita aos pacotes de dados conhecidos. Imports só de tipo continuam fora do grafo runtime, e `@payloadcms/ui` não é classificado genericamente como servidor. A restrição de rotas se aplica somente a `app/(portfolio)`, preservando a configuração Payload e o import map nativo.

A exigência do marcador de server.ts é verificada separadamente; a convenção de pasta não mascara marcador ausente. A collection técnica de usuários já existente recebeu marcador próprio. O build do Next permanece uma prova adicional da fronteira.

A regra local `architecture/import-boundaries` do ESLint dá feedback imediato em import/export/dynamic import literal, resolvendo aliases @/ e caminhos relativos. Ela rejeita arquivos privados de outra feature e dependências diretas de helpers/UI para features. O grafo é a autoridade para ciclos e dependências transitivas. Não foi adicionada dependência de lint.

As fixtures de grafos são definidas ao lado do teste em architecture.test.ts e materializadas em subdiretórios temporários de .work. São analisadas, não executadas. A limpeza verifica o destino absoluto antes de remover só a fixture. `testing/fixtures/content.ts` contém somente suporte compartilhado de configuração sintética validada pelo schema real.

`pnpm test:architecture` executa cenários proibidos, permitidos e o grafo atual. `pnpm test` inclui esse projeto junto de unit/integração. `pnpm verify` chama a suíte uma vez: não repete arquitetura depois da suíte. Nenhum modo passWithNoTests ou continue-on-error foi introduzido.

## Configuração em execução

`readServerEnv` continua sendo a fronteira Zod de entrada. `readPublicRuntime` é executado no servidor e seleciona explicitamente `siteOrigin`, `environment` e `analytics: null`. Seu tipo é derivado da função. Segredo do Payload, URI de banco, bucket e NODE_ENV não são serializados no DTO.

Analytics null representa integração ainda não configurada nesta etapa; não é uma escolha de consentimento. E3.3 mantém a política aprovada de medição automática exclusivamente na produção pública, sem cookies de analytics e sem banner. Nenhum script do Google ou identificador fictício foi inserido.

## CI e bloqueio externo

`.github/workflows/checks.yml` instala pelo lockfile imutável e executa pnpm verify e as jornadas Playwright, com Node24.22.2 e pnpm12.10.1. O Chromium headless shell é instalado pelo CLI fixado do Playwright no caminho .work/playwright-browsers. O PostgreSQL é iniciado/migrado/removido pelo mesmo suporte isolado dos testes. Os valores do workflow são somente sintéticos e não acessam produção. Build usa porta de banco sem serviço; não consulta conteúdo de produção.

Actions ficam fixadas por SHA completo: checkout v7.0.1, setup-node v7.1.0 e pnpm/action-setup v6.1.0. Permissão contents:read, sem persistência da credencial de checkout, sem continue-on-error e sem filtros que pulem o gate. O job agregado se chama type-lint-test-architecture-build; o bash aplica -eo pipefail e os scripts propagam falhas.

**BLOCK-GITHUB-BRANCH-PROTECTION:** o repositório local não tem remote. Nenhum workflow foi executado no GitHub e nenhum ruleset/proteção remota foi configurado. É necessário acesso ao repositório remoto para exigir o check agregado e impedir merge com falha/pêndencia. O YAML salvo não é prova dessa proteção efetiva. Nenhum repositório remoto foi criado e não houve push.

## Fontes primárias consultadas

- [Regras dependency-cruiser18.7.0](https://github.com/sverweij/dependency-cruiser/blob/v18.7.0/doc/rules-reference.md).
- [Opções do analisador](https://github.com/sverweij/dependency-cruiser/blob/v18.7.0/doc/options-reference.md) e tipos da instalação18.7.0.
- [Regras locais do ESLint](https://eslint.org/docs/latest/extend/custom-rules) e [API Node](https://eslint.org/docs/latest/integrate/nodejs-api).
- [setup-node](https://github.com/actions/setup-node), [pnpm/action-setup](https://github.com/pnpm/action-setup) e [instalação pnpm imutável](https://pnpm.io/cli/install).
- [Segurança das Actions](https://docs.github.com/en/actions/reference/security/secure-use), [falhas de workflow](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) e [proteção de branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
