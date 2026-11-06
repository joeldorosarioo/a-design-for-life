# Lease compartilhado do runner local

A revisão identificou que o lease anterior era local ao checkout/UUID. Dois checkouts poderiam passar pelo preflight simultaneamente. A correção usa um único arquivo `postgres-55434.lock` no diretório temporário do usuário, com pasta derivada de hash do UID/nome de usuário. O caminho padrão não depende do checkout nem do UUID.

Escopo: runners cooperantes do mesmo usuário do sistema operacional nesta máquina, usando a porta fixa55434 e o mesmo diretório temporário de usuário. O lease não coordena usuários diferentes ou hosts diferentes compartilhando um daemon Docker. Atores externos forjando labels/UUIDs ficam fora desse modelo local de runners cooperantes.

`prepareTestLifecycle` adquire o lease antes de executar o callback de preflight/Docker. O runner registra a ausência de recursos sob esse lease. Após a tentativa de compose, inclusive falha, faz uma única descoberta para validar e capturar os IDs imutáveis aparecidos. Cleanup usa exclusivamente esses IDs capturados e revalida cada recurso; não procura nem adota recursos por nome. O lease só é liberado após cleanup de início falho ou teardown final. Se o próprio preflight falha antes da tentativa, o lease é liberado sem mutações Docker.

TDD real de filesystem: `shared-lease-red.txt` registrou3 falhas de asserção (segundo checkout com UUID igual, UUID diferente e shared lease com junction),4 testes anteriores passando. `shared-lease-green.txt` registra8/8, incluindo dois checkout roots com o mesmo leaseRoot, recusa antes de alcançar o segundo callbackpreflight, release/reacquisition por outro UUID/checkout, recusa de token modificado sem removê-lo, traversal e junction. Nenhum import/método/setup ausente contou como RED.

Verificação final: `shared-lease-focused-green.txt`,90 testes/5 arquivos,exit0; `shared-lease-eslint.txt`,exit0 com comando registrado mesmo sem stdout; `shared-lease-prettier.txt`,exit0. Nenhum Docker, DB, gate global ou build foi executado pelo agente neste fix. A imagem/compose e recursos visuais foram preservados. O coordenador conduz as novas verificações reais após re-review.

Arquivos de implementação: `testing/setup/test-lifecycle-lock.ts`, teste adjacente e `testing/setup/owned-test-database.ts`. A ausência de receipt de stdout do lint V001 foi corrigida com `v001-eslint.txt`, que registra o comando e exit0 originalmente observados.
