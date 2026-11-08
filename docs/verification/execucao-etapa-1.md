# Execução autorizada — etapa 1

Fonte: `docs/specs/2026-10-29-portfolio-plano-implementacao.md`.

Autorização explícita recebida em 29/10/2026: plano aprovado; somente E1.1–E1.8. Os avisos históricos dos documentos são preservados como fonte. A1, A2, A3 e A4 não foram concedidas.

## Acompanhamento

- [x] Ler os quatro documentos integralmente, na ordem definida.
- [x] Inspecionar destino, ancestrais Git e instruções locais. Destino novo; E:\AGENTS.md ausente; E:\ não é repositório.
- [x] Criar raiz `E:\a-design-for-life`, sem pasta duplicada, na branch `feat/etapa-1-cms`.
- [x] Copiar quatro referências a docs/specs e conferir SHA256.
- [x] E1.1 Base executável e ambiente de testes — concluída; evidências e riscos em E1.1.md.
- [x] E1.2 Limites arquiteturais e configuração por ambiente — concluída localmente; proteção remota bloqueada por acesso, ver E1.2.md.
- [ ] E1.3 Modelos editoriais e provisionamento idempotente.
- [ ] E1.4 Rascunho, publicação, restauração e concorrência.
- [ ] E1.5 Slugs, reservas e resolução pública.
- [ ] E1.6 Upload, processamento e privacidade.
- [ ] E1.7 Contas, prévias e recuperação nativa.
- [ ] E1.8 Coordenação e demonstração dos contratos.
- [ ] Pacote A1 verificado e entregue.
- [ ] A1 aprovada pelo usuário — não iniciar etapa 2 antes disso.

## Fontes preservadas

| Arquivo             | SHA256                                                           |
| ------------------- | ---------------------------------------------------------------- |
| spec-v1             | EB1038667AF44CD732C6165D80F5991D9E0EE5FE2C589A0AF0030595C7F44B46 |
| inventario-figma    | 46A77856C2A5D23151140259A340D2C877C6CA2942F20CAA3B5689CF95A3AE39 |
| contratos-cms       | EBC4210087C2C98CE0CDFA82BB94C7DDFCFBAA7245361DC73131307B51AAE1CF |
| plano-implementacao | A6376936A749DF7E2901D9053FA28CA522F5B0696D2F172F3426202B4CC496CA |

## Skills e decisões de execução

- executing-plans: `C:/Users/joeld/.codex/.tmp/plugins/plugins/superpowers/skills/executing-plans/SKILL.md`.
- test-driven-development e writing-good-tests: `C:/Users/joeld/.agents/skills/test-driven-development/`.
- verification-before-completion: `C:/Users/joeld/.agents/skills/verification-before-completion/SKILL.md`.
- brainstorming: projeto arquitetural com spec e plano já aprovados; a instrução explícita do usuário dispensa repetir entrevista/aprovação.
- vercel-react-best-practices: ler regras específicas quando aplicáveis; exports públicos por feature prevalecem sobre recomendação genérica contra barrels.
- sites: execução somente local, stack/destino/infraestrutura definidos pelo usuário; sem registro ou publicação no serviço Sites.
- executing-plans sugere worktree; o usuário fixou a raiz de trabalho. Usar a raiz nova e branch da etapa, preservando esse destino.
- Subagentes usados para pesquisa, implementação delimitada e revisão. Dependências e gates continuam sequenciais.
- Configuração/documentação/arquivos gerados são verificados por seus consumidores reais, conforme o protocolo aprovado; TDD para comportamentos.

## Ambiente inicial

Windows/PowerShell; Node global 24.21.0, npm 11.19.0, pnpm 12.10.1, Git 2.43.0.windows.1. Docker Desktop 4.97.0/Engine 29.9.2 Linux funciona com acesso ao pipe fora do sandbox. Existe PostgreSQL de outro trabalho na porta 5432; preservá-lo. Todos os testes desta etapa devem usar recursos próprios e isolados.

## Evidências

As tarefas acrescentam comandos, códigos de saída, RED/GREEN e limitações em arquivos próprios de `docs/verification/`. Nenhum teste, build ou aceite de tarefa foi declarado neste registro inicial.

## E1.1 concluída — escopo e ressalvas

Ver [E1.1](E1.1.md), [combinação validada](../decisions/001-stack-validada.md) e [pesquisa de segurança](E1.1-security-research.md). Verificação atual: 16 testes Vitest, 2 jornadas Playwright, tipagem, lint, formatação e build offline; o coordenador repetiu os checks e a jornada em porta alternativa 3101 com sucesso.

Riscos mantidos por nome: SEC-DOMPURIFY-VENDOR, SEC-HAPPY-DOM, SEC-DEEPMERGE, SEC-ESBUILD-TOOLING, AUDIT-GRAPHQL-SCALARS-DISCREPANCY e TOOLING-ESLINT9. Transporte capturado de e-mail/recuperação pertence a E1.7; regras de arquitetura/CI pertencem a E1.2. A1 permanece pendente. Não houve contratação, recurso externo ou implantação pública.

## Pendência futura identificada durante E1.2

O chat principal abriu consulta sobre formatos animados de imagem para E1.6. Ainda sem decisão registrada neste ponto; E1.2 não impõe restrição a imagens nem altera os formatos aprovados. E1.3–E1.5 seguem independentes desse ponto.

## E1.2 concluída — escopo e ressalvas

Fronteiras de features/rotas públicas, ciclos inclusive type-only, infraestrutura genérica, runtime cliente/servidor e DTO público protegidos por testes de grafo e consumidores reais. Ver E1.2.md e docs/architecture/fronteiras.md. Verificação independente atual do coordenador: pnpm verify exit0, 49 testes em4 arquivos, checks e build. Jornadas do painel/API:2 E2E em3101, com limpeza real. Nenhuma dependência foi alterada e o verify não duplica arquitetura. BLOCK-GITHUB-BRANCH-PROTECTION permanece: workflow preparado, sem remote/executar GitHub/proteção remota. A1 e tarefas seguintes permanecem pendentes; esta tarefa não inicia E1.3.
