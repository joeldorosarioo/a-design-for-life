# V001 — correção do ambiente dos testes

O primeiro gate combinado do coordenador terminou com66 falhas,1167 testes passando e41 pulados. O log original foi preservado em `../E3-gates/vitest-full-001.txt`; os resultados focados abaixo não substituem esse gate.

Foram reproduzidos dois vazamentos de ambiente e uma regressão adicional de origem suportada:

- O parse retornava `MEDIA_CHECKER_BINARY:undefined`; a atribuição ao objeto especial process.env transformava o valor no literal `undefined`. Isso impedia o fallback nativo para QPDF. O teste adjacente observou esse literal antes do fix. A atribuição agora omite/deleta undefined e preserva um checker explícito.
- MEDIA_STORAGE_ROOT/INTERNAL_HTTP_ORIGIN do globalSetup de integração contaminavam o projeto unit. O consumer proxy original falhou41/41 sob os valores herdados; o setup exclusivo de unit agora limpa somente esses dois overrides antes dos imports. O consumer original passou41/41 sob os mesmos valores herdados, sem alterar seus testes ou relaxar server-env.
- TEST_SITE_ORIGIN com localhost válido era copiado para o campo interno que exige loopback literal. Um teste real de configure reproduziu a rejeição. Agora somente a origem interna é normalizada para127.0.0.1; a origem do site é preservada.

Logs RED/GREEN: `v001-config-red.txt` (2 falhas/7 passando), `v001-config-green.txt` (9/9), `v001-checker-green.txt` (2 passando/7 fora do filtro), `v001-proxy-red.txt` (41 falhas), `v001-proxy-green.txt` (41/41).

Verificação focada final: `v001-focused-green.txt`,86 testes/5 arquivos,exit0, com os overrides de integração herdados. Formatação dos três arquivos alterados:exit0 (`v001-prettier.txt`); ESLint direcionado registrado em `v001-eslint.txt`. Nenhuma execução DB/build/global foi feita pelo agente de isolamento neste follow-up. A recuperação completa dos PDFs Native e dos17 arquivos do gate inicial continua dependente da repetição do coordenador.

Arquivos alterados: `testing/setup/test-environment.ts`, teste adjacente e `testing/setup/vitest.ts`. Ownership/compose/Next/lifecycle não foram alterados neste follow-up. Os testes novos falharam antes dos fixes; não houve RED por import/método/setup ausente nem enfraquecimento de verificações de PDF/ambiente.
