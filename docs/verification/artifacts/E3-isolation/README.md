# E3 — isolamento dos runners locais

Implementação preparatória em `develop`, raiz `E:\a-design-for-life`, em 03/11/2026. Nenhum critério E3 foi encerrado por esta preparação. Node24.22.2 portátil, pnpm12.10.1 e dependências preservados pelo agente de isolamento.

## Contrato implementado

- Compose exclusivo `compose.test.yaml`; projeto `adfl-isolated-tests-<UUIDv4>`, serviço `postgres-isolated`, banco exato `adfl_test_runner`, bind `127.0.0.1:55434`, tmpfs. O compose local e o serviço visual55433 não são alvos do lifecycle.
- `TEST_DATABASE_URI`/`TEST_MEDIA_BUCKET` incompatíveis são recusados. `COMPOSE_PROJECT_NAME` herdado não controla a execução. Storage/origem interna são configurados explicitamente e famílias de configuração externa são limpas.
- Lock exclusivo, recusa de recursos existentes, preflight de porta, labels de ownership/projeto/serviço/checkout/compose, imagem fixada, nomes, IDs imutáveis, banco/usuário, bind/tmpfs e rede exclusiva verificados. Cleanup só é planejado para recursos novos; revalida ownership antes de cada mutação e recusa substituições de IDs.
- A prova de outage continua usando PostgreSQL/processos reais: o teste chama disconnect/connect apenas sobre IDs adquiridos e verificados pelo lifecycle.
- Next comum usa `.work/next-build`; testes usam `.work/next-tests/<UUIDv4>`. O resolver é consumido por `next.config.ts`, aceita somente paths previstos e recusa traversal, paths servidos e ancestors ligados. Os testes do resolver são adjacentes em `src/config`.

## Evidência observada pelo agente de isolamento

| Ciclo | RED comportamental observado | GREEN observado |
| --- | --- | --- |
| Runtime existente | 6 falhas:55433, overrides aceitos, storage/origem herdados | 6/6 |
| Output Next | 9 falhas/1 sucesso contra seleção anterior sem guard | 10/10 |
| Ownership/cleanup | 16 falhas/1 sucesso contra guard amplo de rede | 17/17 |
| Configuração futura herdada | 1 falha/5 sucessos: driver externo persistia | 6/6 |
| Checkout/compose/bind | 3 falhas/17 sucessos: paths estrangeiros e bind aceitos | 20/20 |
| Lock FS real | 3 falhas/1 sucesso: concorrência, traversal, junction | 4/4 |
| Substituição após aquisição | 2 falhas/20 sucessos: IDs substituídos aceitos | 22/22 |

As novas APIs de guard/output foram primeiro exercitadas com o comportamento anterior sem as proteções novas; RED significa falha de asserção por aceitação indevida, nunca import/método ausente. Um erro inicial de sintaxe no fixture de ownership produziu zero testes, foi corrigido e não conta como RED.

`unit-green.txt`:42 testes/4 arquivos, exit0. `eslint.txt`: ESLint direcionado, exit0 (sucesso sem saída). A ausência de saída desse arquivo não representa verificação global. O coordenador conduz separadamente PostgreSQL real, consumer Next, integrações e gates globais; units de snapshots/decisões não são prova de DB real.

Inspeção somente leitura observou o container visual original `7e6b8f052e04e2bad8f1be35d9712b0a0874582f0ba4a17205de6a9ea9294938`, running=true, porta55433. O agente não iniciou build, não parou/removeu/desconectou esse recurso e não executou Docker mutante. A preservação completa008 e a validação real pertencem ao coordenador.

## Comandos focados

```powershell
& '.\.toolchain\node-v24.22.2-win-x64\node.exe' '.\node_modules\vitest\vitest.mjs' run --project unit testing/setup/test-environment.test.ts testing/setup/test-ownership.test.ts testing/setup/test-lifecycle-lock.test.ts src/config/next-dist.test.ts
```

Prettier e ESLint foram executados somente sobre os arquivos de isolamento listados no relatório privado de coordenação. Não houve commit, push, contratação, produção, Analytics ou e-mail real.
