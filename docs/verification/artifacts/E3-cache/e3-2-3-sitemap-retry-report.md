# E3.2.3 — Sitemap indexável e novas tentativas

Execução local de 04/11/2026 em `develop`, com Node 24.22.2, pnpm 12.10.1, Next 16.4.3, Payload 3.92.1 e PostgreSQL descartável na porta 55434. O build do ensaio Playwright ficou em `.work/next-tests/<run-id>`. A configuração de indexação foi usada em um segundo processo Next ligado somente a 127.0.0.1, com origem canônica sintética `.example.invalid`, credenciais inertes e Analytics desativado. O publicador de teste manteve a configuração isolada. A ativação do observador no runtime segue restrita ao runner.

## Sitemap servido

- RED do transporte. O teste do caminho literal `/sitemap.xml` falhou com `Unsafe public HTTP verification plan` antes da requisição. O transporte passou a aceitar esse caminho explícito sob os limites e a exigência de loopback existentes.
- O handler captura a raiz uma vez, usa a mesma geração para o XML e `X-Portfolio-Generation`, e responde com `Cache-Control: no-store`. O navegador parseou o XML e verificou os namespaces, URLs canônicas únicas e alternates recíprocos PT/EN.
- O XML inicial tinha 11 URLs públicas. A troca de slug manteve 11 URLs e removeu o endereço antigo das URLs canônicas e alternates. A retirada da tradução EN reduziu o conjunto a 10 URLs e removeu seu alternate. Um rascunho privado ficou ausente, o sitemap do ambiente de testes ficou vazio e a falta de raiz no leitor indexável produziu 503.
- O coordenador de publicação observou as rotas do Next real através de um relay que trocou apenas o XML pelo corpo antigo, com o cabeçalho de geração atual. A operação continuou `update-pending`. A repetição direta confirmou `public` com a mesma operação, revisão e geração, após o XML correto. [Gerações e SHA-256](e3-2-3-indexable-sitemap.json)

## Novas tentativas do worker

O ensaio de integração usa Payload 3.92.1, PostgreSQL real e o bloqueio do escritor de filesystem para manter a intenção pendente. As datas são injetadas no dreno para verificar cada limite sem depender da velocidade do host. Para cada vencimento, o dreno seleciona zero operações 1 ms antes e uma operação no instante programado. Recriar o dreno entre as tentativas preservou a agenda armazenada no PostgreSQL.

| Tempo desde o início | Execução                              | Tentativas automáticas consumidas | Próximo horário |
| -------------------- | ------------------------------------- | --------------------------------- | --------------- |
| 0 s                  | Imediata                              | 0                                 | +1 s            |
| 1 s                  | Automática 1                          | 1                                 | +6 s            |
| 6 s                  | Automática 2                          | 2                                 | +21 s           |
| 21 s                 | Automática 3                          | 3                                 | Sem agenda      |
| 60 s                 | Manual autorizada, ainda sob bloqueio | 0                                 | +61 s           |
| 61 s                 | Automática após liberar o bloqueio    | 1                                 | Sem agenda      |

Antes da repetição manual, o dreno em +60 s selecionou zero operações e o recibo ainda estava pendente. Em +61 s a mesma operação e revisão passaram a `public`. Em +120 s o dreno continuou sem trabalho. Os testes adjacentes exercitam substituição por intenção mais recente, conta ausente/removida e paginação limitada diante de uma operação sem acesso. O painel mantém a mensagem de pendência e a ação `Tentar novamente`.

Os intervalos de 1, 5 e 15 s são contados a partir do início persistido da execução anterior. O supervisor no processo Next usa lotes sequenciais de até 20 operações e consulta novamente 1 s depois de terminar o lote. Os ensaios de relógio e reinício provam o comportamento local. O alvo de propagação normal em até 60 s fica para medição e aceite A3 na stack operacional.

## Verificações executadas

- 95 testes unitários focados na política, execução e registro do worker.
- 81 testes unitários focados em sitemap, observador HTTP e inicialização do Next isolado. Tipagem e lint focados passaram.
- 23 testes de integração Native com PostgreSQL real. O teste do ciclo completo da política passou.
- 4 jornadas Playwright Chromium passaram em 2,7 min, incluindo sitemap indexável, confirmação HTTP, retomada após indisponibilidade e recuperação após SIGKILL do worker. O cenário do sitemap levou 6,5 s.

Com o Node portátil selecionado e o namespace descartável livre, os comandos focados foram executados na raiz.

```powershell
node ./node_modules/vitest/vitest.mjs run --project integration src/config/publication-worker.integration.test.ts src/helpers/payload/publication-retries.integration.test.ts
node --conditions=react-server ./node_modules/@playwright/test/cli.js test src/config/publication-sitemap.e2e.test.ts src/config/publication-worker.e2e.test.ts src/config/publication-http-observation.e2e.test.ts --project=chromium --workers=1 --reporter=list,json
```

## Gate completo e repetição do build

O `pnpm verify` (013) passou tipagem, lint com quatro avisos históricos, formatação, 209 arquivos do Vitest (1.942 testes aprovados e 3 pulados), CSS (2/2) e progresso (36/36). A fase de build do gate terminou com exceção nativa do Windows `0xC0000005` durante a otimização do Turbopack em `.work/next-build`. O build do ensaio Playwright já havia passado.

A repetição de `pnpm build` com a mesma configuração e saída nova em `.work/next-tests/<run-id>` passou com código 0. O arquivo de identidade da prévia protegida manteve o mesmo hash. A causa específica da falha nativa ficou indeterminada. [Recibo dos dois resultados](e3-2-3-local-gate.json)
