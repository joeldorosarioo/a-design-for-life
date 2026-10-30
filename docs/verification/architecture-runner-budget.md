# Orçamento do runner de arquitetura

Etapa 2: **0% (0/6)**. Ajuste operacional do runner, sem mudança de regras, grafo, fixtures ou asserts.

O primeiro caso inicia uma CLI Node real do dependency-cruiser e inclui processo/configuração/TypeScript no prazo de5s. Falhas observadas: E1.8 em6750ms e E2.1 em6134ms. O corpo síncrono termina antes da verificação de deadline do Vitest; os logs reportam timeout, sem asserção de fronteira falha. O restante do arquivo difere12ms entre essas execuções. Não foi medida causa específica em CPU/disco/cache/concorrência.

testTimeout=15000 agora se aplica somente ao projeto architecture. Todos os28testes, incluindo grafo atual e casos ESLint, permanecem obrigatórios, sem retry/skip/warmup/filtro. O prazo é tolerância limitada superior a duas vezes o maior custo observado, sem promessa de eliminar toda variação ou alterar o custo da análise.

Verificação atual: pnpm exec vitest run --project architecture --reporter=verbose, Node24.22.2/Vitest5.0.5/Windows, exit0,28/28,18.32s total; primeiro919ms. [Log e hash](artifacts/architecture-budget/evidence-manifest.json). A execução isolada não reproduz os6s nem prova a causa dessa variação. O gate integral combinado ainda precisa ser executado.

## Gate integral do preparo combinado

Em30/10/2026, pnpm verify terminou exit0: **584 testes aprovados,1 skip específico do Windows,81 arquivos**, tipagem, lint sem erros (4warnings herdados), formato e buildNext16.4.3 aprovados. PostgreSQL real isolado55433/tmpfs removido pelo runner; PostgreSQL5432 de outro projeto preservado. Primeiro gate interrompeu antes dos testes/build por formatação de E2.1.md; a tentativa falha foi preservada, o documento formatado e o comando integral repetido. Não se conta essa falha de formato como RED comportamental.

[Fontes cobertas](artifacts/E2-preparation/source-snapshot.json), [logs e revisões](artifacts/E2-preparation/evidence-manifest.json). O snapshot identifica o estado combinado, sem atribuir essa cobertura a modificações posteriores. Warnings pg/client.query e mensagens esperadas dos testes de COMMIT/autorização permanecem no log. O checkCI exato e25jornadasE2E continuam necessários antes da promoção remota. Nenhuma tarefa E2 está concluída por esse gate isolado.
