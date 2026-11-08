# Execução autorizada — etapa 2

**Etapa 2: 0% (0/6 tarefas concluídas). E2.1 em andamento.**

A1 aprovada explicitamente em 30/10/2026. Autorizadas somente E2.1–E2.6 na raiz E:\a-design-for-life, branch develop. Commits em inglês, Conventional Commits, por mudança coerente. Estimativa inicial: **18–28 horas de trabalho**, incluindo implementação, testes, comparação com o Figma e correções; atualizar diante de bloqueio concreto.

## Acompanhamento

- [ ] E2.1 Tokens, primitivas e fundação de movimento.
- [ ] E2.2 Header, footer, Home e Sobre.
- [ ] E2.3 Listagem, detalhe e apresentações editoriais.
- [ ] E2.4 Resolução inicial e cookie funcional de idioma.
- [ ] E2.5 Troca de idioma preservando a leitura.
- [ ] E2.6 SEO, acessibilidade, responsividade e aceite visual.
- [ ] Pacote A2 verificado e entregue.
- [ ] A2 aprovada pelo usuário — não iniciar etapa 3 antes disso.

## Contratos e limites preservados

Referências originais em docs/specs permanecem imutáveis. Modelos/DTOs, privacidade e geração pública confirmada de A1 continuam obrigatórios. Testes adjacentes, helpers/stylesheets e fronteiras por feature; TDD comportamental real. Conteúdo Figma/modelo permanece privado ou em ambiente isolado de teste, sem inventar resultados profissionais. Analytics somente na produção pública futura; integrações finais, infraestrutura e lançamento pertencem às etapas 3/4.

## Ambiente e verificações

Base 4f72388, limpa ao iniciar; Node portátil 24.22.2, pnpm 12.10.1, Next 16.4.3, Payload 3.92.1 e React 19.3.1. PostgreSQL dos testes próprios na porta 55433; preservar 5432 de outro projeto e 55432. Nenhum novo teste, build ou aceite é declarado neste registro inicial. Cada tarefa acrescentará evidências RED/GREEN, comandos, ambiente, exits e limitações.

## Referência visual e materiais

Figma PXUcVZFdLuOzHQZkD5PU4b, página 123:179. MCP Starter atingiu limite; inspeção pela interface normal autenticada e materiais oficiais prévios em pesquisa. O levantamento observou os 16 frames principais e as duas variantes do segundo case EN. Capturas vistas inline não são representadas como arquivos arquivados.

Cinco ativos exatos retornados pelo contexto oficial anterior e seus hashes ficam em work/stage2-reference, sem comprovação de serem uploads brutos originais. Retrato, fotos Sobre e outros materiais ainda indisponíveis serão nomeados antes de implementação afetada. Não contratar upgrade/serviço nem contornar quota. Tokens documentados, política de movimento e core puro de idioma seguem independentes. A preparação do core E2.4 não conclui sua integração HTTP/E2E e não altera a contagem de tarefas.

## Coordenação inicial

E2.1 é o único dono de instalação, lockfile, DB de teste, build, Next e gates globais. Pesquisa Figma usa somente o workspace do chat. O core de idioma usa arquivos disjuntos e testes unitários focados; integrações com páginas e cookie manual serão verificadas no momento de E2.4/E2.5. Aprovação/ledger, reviews e remoto continuam com o coordenador.
