# 001 — Combinação inicial e verificação da stack

Data de referência: 29/10/2026, America/Sao_Paulo. Escopo: E1.1. A política exige o Next estável mais recente e corrigido, não a instalação indiscriminada de ferramentas incompatíveis.

| Componente                                   | Pin           | Evidência/compatibilidade                                                                              |
| -------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| Next.js                                      | 16.4.3        | Tag latest npm e release oficial; posterior à correção 16.4.1 do advisory de 14/10                     |
| Payload, db-postgres, next, richtext-lexical | 3.92.1        | Todos os pacotes Payload alinhados; peer Next aceita >=16.3.3 <17                                      |
| React / React DOM                            | 19.3.1        | Next aceita ^19.0.0; UI/Lexical aceitam ^19.2.1, que inclui 19.3.1                                     |
| Node                                         | 24.22.2 LTS   | Portátil em .toolchain, não versionado; mantém major da instalação global                              |
| GraphQL                                      | 16.14.2       | Última 16 estável consultada; Payload exige ^16.8.1 e latest 17.0.2 não atende                         |
| Sharp                                        | 0.35.5        | Versão corrigida identificada no advisory oficial de outubro                                           |
| pnpm                                         | 12.10.1       | packageManager fixado e pnpm-lock.yaml versionado                                                      |
| PostgreSQL                                   | 17.11         | Imagem oficial fixada por digest no compose; portas próprias 55432/55433                               |
| TypeScript                                   | 6.0.3         | Última 6.0 consultada compatível com parser ESLint >=4.8.4 <6.1.0; latest 7.0.2 rejeitado pelos peers  |
| ESLint                                       | 9.39.5        | Última 9 consultada compatível com plugins do eslint-config-next; latest 10.13.0 rejeitado pelos peers |
| Vitest / Vite                                | 5.0.5 / 8.3.5 | Engines aceitam Node 24.22.2; consumo real validado pelos testes                                       |
| Playwright                                   | 1.64.1        | Runner real e configuração para build de produção local isolado                                        |
| Zod                                          | 4.6.7         | Validação de configuração exclusivamente no servidor                                                   |

Node global 24.21.0 não satisfaz o engine atual de Payload (^22.23.4 || >=24.22.1). Nenhuma instalação global foi modificada. O ZIP oficial de Node 24.22.2 win-x64 teve SHA256 conferido contra SHASUMS256.txt: `ca1bff5d8ead13c9f2ea404a176db46bd430704d5b5113734049fa365e7799e2`.

A documentação geral de instalação do Payload ainda menciona Next 16.2.6+; o pacote 3.92.1 é mais restritivo. O pin 16.4.3 atende ambos. Não houve downgrade de Next.

## Necessidade e impacto das dependências

Payload/Next/React/Postgres/Sharp/Lexical compõem a stack aprovada; o editor Lexical permite definir os formatos fechados nas tarefas de modelos, sem HTML livre. GraphQL é dependência nativa exigida pelo Payload, mas a API GraphQL está desabilitada. Zod valida fronteiras. Dotenv carrega somente configuração local ignorada. `server-only` faz o build rejeitar fronteiras indevidas; os testes Node resolvem apenas esse marcador para um módulo vazio, sem mock de regras ou persistência.

Vitest, Testing Library, jsdom, Playwright, TypeScript, ESLint e Prettier são ferramentas aprovadas de verificação. Vite e esbuild 0.28.2 são consumidores compatíveis do runner. dependency-cruiser 18.7.0 foi avaliado para E1.2: mantido, engine Node ^22 || ^24 || >=26, responsabilidade concreta de analisar o grafo; as regras pertencem a E1.2.

ESLint 9.39.5 é marcado deprecated no registry em favor da major 10. O ecossistema de plugins usado pelo Next ainda restringe peers à major 9. Essa limitação fica registrada, sem relaxar peers ou trocar a configuração por outra silenciosamente. A instalação final reportou `No peer dependency issues found`.

pnpm 12 lê settings de projeto em pnpm-workspace.yaml; .npmrc é restrito a autenticação/registry/TLS/proxy. Store/cache são .work/pnpm-store e .work/pnpm-cache. Somente os scripts de build necessários de esbuild e unrs-resolver são permitidos; versões e integridade ficam no lockfile. A primeira tentativa bloqueada de scripts não conta como RED.

## Fontes oficiais consultadas

- https://registry.npmjs.org/next/latest
- https://github.com/vercel/next.js/releases/tag/v16.4.3
- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://registry.npmjs.org/@payloadcms%2Fnext/latest
- https://registry.npmjs.org/@payloadcms%2Fui/latest
- https://registry.npmjs.org/payload/latest
- https://github.com/payloadcms/payload/releases/tag/v3.92.1
- https://payloadcms.com/docs/getting-started/installation
- https://registry.npmjs.org/react/latest
- https://registry.npmjs.org/react-dom/latest
- https://nodejs.org/en/blog/release/v24.22.2
- https://nodejs.org/en/blog/release/v24.22.1
- https://nodejs.org/dist/v24.22.2/SHASUMS256.txt
- https://pnpm.io/settings

## Segurança e limites atuais

A verificação de peers não substitui a auditoria de segurança. `pnpm audit --json` inicial encontrou 1 critical, 4 high, 1 moderate e 4 low em transitivas. A análise e as decisões ficam em E1.1.md e no JSON preservado. Não existe alegação de stack sem avisos. Não foram contratados recursos nem implantado ambiente público.

A correção patch npm DOMPurify 3.4.17 foi aplicada por override explícito e validada pelos consumidores. O audit atual continua não zero (0 critical, 3 high, 1 moderate, 1 low), e Monaco mantém cópia vendorizada 3.4.15. Ver [evidência e riscos](../verification/E1.1.md) e [pesquisa primária](../verification/E1.1-security-research.md). Nenhuma major transitiva foi atualizada silenciosamente.
