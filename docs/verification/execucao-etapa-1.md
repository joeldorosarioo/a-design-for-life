# Execução autorizada — etapa 1

Fonte: `docs/specs/2026-10-29-portfolio-plano-implementacao.md`.

Autorização explícita recebida em 29/10/2026: plano aprovado; somente E1.1–E1.8. Os avisos históricos dos documentos são preservados como fonte. A1, A2, A3 e A4 não foram concedidas.

## Acompanhamento

- [x] Ler os quatro documentos integralmente, na ordem definida.
- [x] Inspecionar destino, ancestrais Git e instruções locais. Destino novo; E:\AGENTS.md ausente; E:\ não é repositório.
- [x] Criar raiz `E:\a-design-for-life`, sem pasta duplicada, com branch atual `develop` (histórico corrigido por solicitação do usuário).
- [x] Copiar quatro referências a docs/specs e conferir SHA256.
- [x] E1.1 Base executável e ambiente de testes — concluída; evidências e riscos em E1.1.md.
- [x] E1.2 Limites arquiteturais e configuração por ambiente — concluída; CI e proteção remota comprovadas em E1.2-remote.md.
- [x] E1.3 Modelos editoriais e provisionamento idempotente — concluída após revisão e gate independente.
- [x] E1.4 Rascunho, publicação, restauração e concorrência — revisão e CI atual aprovados.
- [x] E1.5 Slugs, reservas e resolução pública — revisões e CI atual aprovados.
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

## Convenção de Git atualizada pelo usuário

Usar `develop`, mensagens em inglês seguindo Conventional Commits e commits pequenos por responsabilidade. E1.1/E1.2 foram reorganizadas sem alterar suas árvores nem o trabalho em andamento. Correspondência dos marcos e provas em [history-correction.md](history-correction.md). Não usar os títulos de commit em português do plano histórico para os próximos commits.

Ajuste posterior do usuário: os commits não precisam ser tão pequenos; devem ser coerentes. Priorizar unidades funcionais completas com testes, contratos e migrações relacionados, mantendo inglês, Conventional Commits e develop. Não fragmentar artificialmente por arquivo ou contagem de linhas.

## Relato de progresso solicitado pelo usuário

Informar a porcentagem da etapa atual em toda atualização. Critério: tarefas concluídas divididas pelo total da etapa, sem contar uma tarefa em andamento como pronta. Estado neste registro: etapa 1 em 25% (E1.1/E1.2 concluídas, 2 de 8; E1.3 em andamento). A consolidação dos commits por responsabilidade e os novos marcos equivalentes estão em history-correction.md. develop e Conventional Commits em inglês continuam obrigatórios.

## E1.3 — snapshot encaminhado para revisão

Etapa 1 permanece em 25% (E1.1/E1.2,2/8). O snapshot E1.3 acrescenta os índices compostos e provas de corrida real, contratos de entrada/DTOs e mapeadores mínimos, proteção de identidade/chaves de leitura e CLI explícito de provisionamento pós-migração sem conta fictícia. pnpm verify passou com107 testes/build;2 jornadas Playwright passaram em3101; caracterização adicional de reload nativo e checks finais estão em E1.3.md. O item E1.3 segue desmarcado até o gate/revisão independente do coordenador. Nenhuma tarefa seguinte ou A1 foi declarada concluída.

## E1.3 — correções da primeira revisão preparadas

Etapa1 permanece em25% (2/8), E1.3 desmarcada até re-review. A revisão independente de f1e6063 e o gate de108 testes foram preservados. A primeira rodada corrige exclusão órfã de identidade (guard editorial + três FKs RESTRICT geradas, incluindo versões/rotas), a ordem das FKs no rollback nativo (dca8c50) e URL interna absoluta indevidamente tratada como externa. Quinze testes focados passaram; o roundtrip das sete migrações e o provisionamento dos quatro drafts foram provados em tmpfs isolado. Tipagem/lint/formatação passaram. O coordenador fará o gate completo e a revisão dos fixes antes de concluir a tarefa; detalhes em E1.3.md e E1.3-rollback.md.

## E1.3 concluída — 37,5% da etapa 1

Em 30/10/2026, E1.1–E1.3 concluídas: 3 de 8 tarefas, 37,5%. Os registros anteriores de 25% descrevem seus checkpoints históricos. E1.4 é a próxima tarefa e A1 continua pendente.

Snapshot de código 27f0b98: gate independente pnpm verify exit0, 21 arquivos/114 testes, tipagem, lint, formatação e build. Payload/PostgreSQL reais isolados; sete migrações aplicadas; postgres-test removido após a execução. Log em artifacts/E1.3/root-verify-after-review.txt. A re-review E1.3-round1-review.md aprovou S1 (identidade referenciada), Q1 (rollback) e S2 (destino interno tipado), sem novos achados acionáveis. Detalhes em E1.3.md e E1.3-rollback.md.

Playwright 2/2 foi executado no snapshot f1e6063 antes das três correções de servidor; não foi repetido após 27f0b98. O gate atual cobre a suíte completa e build; essa distinção é mantida, sem representar a execução anterior como atual. As jornadas editoriais serão ampliadas em E1.4 e o gate integrado será repetido para A1.

Permanecem os riscos de dependências documentados em E1.1 e BLOCK-GITHUB-BRANCH-PROTECTION. A consulta sobre imagens animadas segue sem resposta e não impôs restrição aos modelos. Nenhuma tarefa posterior foi contabilizada como pronta.

## E1.4 concluída — 50% da etapa 1

Em 30/10/2026, E1.1–E1.4 concluídas: quatro de oito tarefas, 50%. E1.5 é a próxima tarefa. A1 permanece pendente e não autoriza etapa 2.

Snapshot de código d43891e4a07f96ac23ec4b4bf013f014bb440142: revisão final e três re-reviews aprovadas, com regressões reais de imagens SEO, draft=true/publicação efetiva e blocos de texto vazios. O gate final independente executado pelo GitHub Actions em ubuntu-24.04 terminou success: pnpm verify com 28 arquivos/149 testes, tipagem, lint, formatação, arquitetura e build; pnpm test:e2e com seis jornadas reais. Run41011551929/job123918342074, logs completos e configuração em artifacts/E1.4/github-*. Os testes usam PostgreSQL17.11 real isolado e Node24.22.2/pnpm12.10.1. O marco passou pelo check protegido e develop remota avançou normalmente para o mesmo SHA, sem force ou implantação.

BLOCK-GITHUB-BRANCH-PROTECTION está resolvido; E1.2-remote.md contém CI inicial, configuração administrativa relida e rejeição GH006 de commit sem check. Os avisos anteriores de ausência de remoto são históricos. Mantêm-se riscos de dependências E1.1 e limites PAYLOAD-LEGACY-ACTION-SELECTORS, LEASE-UNLOAD-BEST-EFFORT, MEDIA-METADATA-FIXTURE-ONLY e PUBLICATION-COORDINATION-E1.8. A consulta de mídia foi refinada por prova real: WebP animado funciona; APNG e AVIF animados têm limitações demonstradas. A política proposta ainda aguarda resposta; nenhuma restrição foi aplicada ao stub fechado.

## E1.5 concluída — 62,5% da etapa 1

Em 30/10/2026, E1.1–E1.5 concluídas: cinco de oito tarefas, 62,5%. E1.7 está em execução independente; E1.6 aguarda a decisão pendente sobre animações para o comportamento afetado. E1.8 depende de mídia e acesso verificados. A1 permanece pendente e nenhuma etapa 2 foi iniciada.

Commit de código e evidências e38226528017eebb609c23fda0d936c989f7d899: revisões de especificação e qualidade PASS, sem achados acionáveis. O CI independente atual em ubuntu-24.04 passou pnpm verify com 33 arquivos/184 testes, checks e build, seguido de dez jornadas Playwright reais. Run41017050616/job123935646634; Node24.22.2, pnpm12.10.1 e PostgreSQL17.11 isolado. Logs completos e metadados seguros em artifacts/E1.5/github-*. O mesmo SHA avançou normalmente para develop protegida, sem force ou implantação.

Ver E1.5.md, E1.5-spec-review.md, E1.5-quality-review.md e ../architecture/rotas-e-reservas.md. Permanecem os riscos de dependências e os limites nomeados PUBLIC-HTTP-CONTRACT-ONLY, PUBLICATION-COORDINATION-E1.8, ORIGIN-RELATION-FAILURE-ONLY e MEDIA-METADATA-FIXTURE-ONLY. A correção de ordem de locks foi provada por deadlock PostgreSQL40P01 antes e corrida transacional válida depois; as regressões da E1.4 também passaram.
