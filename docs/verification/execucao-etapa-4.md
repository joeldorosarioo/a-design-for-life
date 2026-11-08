# Execução autorizada — etapa 4

Autorização explícita recebida em 06/11/2026: A3 aprovada e execução integral de E4.1–E4.3. A aprovação A4 e a autorização de lançamento permanecem pendentes.

**Etapa 4: 87,5% do checklist (14/16 itens); 1/3 tarefas inteiramente encerradas. Aprovação registrada: A3 aprovada em 06/11/2026. A4 aprovada em 08/11/2026. Lançamento sem autorização.**

Estado inicial conferido: develop, HEAD 7331e34c7ed52e9be44fa1e4fa3247f4820d64b3; alteração preexistente em next-env.d.ts preservada.

## Evidências e decisões da execução

- O checklist preserva a estrutura 5/6/5 da seção 8. RED do teste do contador confirmou que o CLI rejeitava o argumento de etapa 4 com saída 1. O GREEN passou 40 testes Node, incluindo preservação de E2/E3, rejeição de ledger com 30 itens e ausência do sexto critério de E4.2. Os logs do teste ficam em .work/stage4-2026-11-06/progress-{red,green}-001.log.
- O protocolo de performance foi fixado antes das 36 medições. A rodada inicial registrou 11/12 cenários dentro das metas, com LCP mediano de 2.803,06 ms no case PT celular. [Protocolo](E4.2-performance-protocol.md)
- A leitura autenticada do GitHub confirmou a proteção de develop e a conclusão bem-sucedida do pipeline 42304741961 no SHA homologado. A consulta a main respondeu HTTP 404. [Recibo](artifacts/E4-operations/github-protection-001.json)
- O procedimento de implantação, verificações privadas, rollback e recuperação está no [runbook de lançamento](../runbooks/lancamento.md). [Dossiê A4](A4.md) · [Matriz de rastreabilidade](rastreabilidade-etapa-4.md)

## Gates locais e sucessora em staging

- O `pnpm verify` local terminou com saída 0, 2.332 aprovados em 237 arquivos e três skips de plataforma. O `pnpm test:e2e` integral passou 123/123 após informar o Origin da sessão autenticada na fixture. As tentativas anteriores e seus códigos de saída foram preservados no recibo. [Gates locais](artifacts/E4-gates/final-local-001.json)
- A PR #6 seguiu os checks protegidos e o pipeline 42512917835 passou em `befe22bc711d88f43f134983d151d0f87f6c7af2`, com 2.335 testes Linux e 123 jornadas Chromium. O build e o deploy ocorreram apenas no fluxo develop → staging. Os jobs de produção foram ignorados. [Pipeline 42512917835](https://github.com/joeldorosarioo/a-design-for-life/actions/runs/42512917835)
- O marcador de backup `04d7933e-18f4-437b-99f6-04db4bac80a9` ficou completo em `2026-11-08T19:16:02.476Z` antes do deploy. O manifesto `sha256:557ba0fbcdc8bd8bb2e225d84846c90271bdf7d0489e180796ee2d7a7f18d5aa` foi confirmado pelo Coolify, pela leitura SSH e pela resolução do marcador GHCR. A árvore de migrações, os três volumes, a raiz publicada, as cotas e a rotação de logs permaneceram iguais. A imagem anterior fica registrada no runbook como rollback de staging. [Runbook](../runbooks/lancamento.md) · [Recibo de staging](artifacts/E4-operations/stage4-staging-release-001.json)
- O smoke confirmou seis respostas 200 autenticadas com noindex e nenhum script Google, além de 401 para acesso anônimo. A leitura SSH confirmou a preservação após o smoke. [Recibo da sucessora](artifacts/E4-operations/stage4-staging-release-001.json)
- Os 11/12 cenários na meta e o LCP de 2.803,06 ms pertencem à rodada da imagem inicial. As medições da sucessora têm recibos próprios e ainda estão pendentes neste registro. [Performance](E4.2-performance.md)

## Validação da imagem e entrega para A4 — 08/11/2026

O PR #6 passou nos checks protegidos e foi integrado em `develop` como `befe22bc711d88f43f134983d151d0f87f6c7af2`. O pipeline `42512917835` passou 2.335 testes em Linux e 123 jornadas Chromium. A troca do staging usou backup completo prévio, preservou as três montagens e a raiz pública e manteve `appuser`, as cotas e a rotação de logs. A árvore de migrações ficou igual à da imagem anterior. A releitura do GHCR e a inspeção SSH conferiram o manifesto `sha256:557ba0fbcdc8bd8bb2e225d84846c90271bdf7d0489e180796ee2d7a7f18d5aa`. [Implantação e preservação](artifacts/E4-operations/stage4-staging-release-001.json)

Os gates locais completos passaram. O recibo preserva a tentativa interrompida por formatação e a primeira leitura de teste tratada como anônima por falta do cabeçalho de origem. A correção dessa leitura ocorreu na fixture. A nova suíte passou 123/123. [Gates locais](artifacts/E4-gates/final-local-001.json)

A auditoria visual comparou as 18 referências na imagem inicial e repetiu os detalhes afetados no sucessor. As 36 medições da sucessora passaram nos 12 cenários. O case PT móvel caiu de 2.803,06 ms para 1.867,62 ms de LCP mediano. Os recibos conferem a geometria, o arquivo selecionado e a mesma raiz publicada. [Qualidade E4.2](E4.2-quality.md) · [Performance E4.2](E4.2-performance.md)

Os critérios E4.1.3 e E4.2.1 continuam abertos pelo material editorial final e pela inspeção formal com leitor de tela. Os currículos PT/EN em branco são temporários, e NVDA permanece desativado. Domínio, configuração de produção, backup do alvo de produção, atualização de avisos e `BLOCK-GA4-REPORT-LIMITATION` estão no dossiê. O dossiê local é posterior à imagem e não é o identificador da promoção. [A4](A4.md) · [Runbook de lançamento](../runbooks/lancamento.md)

Em 08/11/2026, o usuário aprovou A4 e adiou o lançamento. A aprovação se refere ao dossiê e ao manifesto homologado no [A4](A4.md). A autorização explícita de lançamento permanece pendente.
