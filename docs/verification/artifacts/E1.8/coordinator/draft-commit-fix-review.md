# E1.8 — conferência delimitada da correção D1

30/10/2026. Etapa 1: **87,5%**, E1.8 WIP. **D1 ADDRESSED** no snapshot abaixo: leitura do código e conferência dos logs RED/GREEN produzidos pelo executor principal. Nenhum achado acionável remanescente identificado nesta revisão estreita. Não é revisão final E1.8 nem execução independente de testes.

## Correção e invariantes conferidos

- **Fronteira correta:** `src/helpers/payload/transaction-settlement.ts:22–29` observa a promise bruta retornada por `drizzle.transaction` antes do catch consumidor de Native beginTransaction. Devolve essa mesma promise ao chamador, sem substituir seu resultado por uma promise de sucesso. Isso cobre precisamente a origem de D1.
- **Identidade real da transação:** `outcomes` é WeakMap criado por instância de adapter (`:8–9`), indexado pelo objeto recebido no callback de Drizzle (`:23`). O commit captura `adapter.sessions[id].db` antes de Native apagar a sessão e consulta o mesmo objeto (`:35–38`). Não há “último resultado” global, associação por usuário nem dado de uma sessão usado para decidir outra.
- **Bindings:** `factory.init(args)` é chamado como método da factory original (`:8`). Native begin/commit ficam vinculados ao adapter (`:11–12`); a função transaction original fica vinculada ao host Drizzle (`:18`). Options e callback são encaminhados; a correção não recria sessões nem altera o callback editorial.
- **Inicialização e instalação:** a wrapper aguarda `adapter.initializing` antes de obter Drizzle (`:14–15`), e WeakSet por adapter impede instalar novamente no mesmo host a cada begin (`:16–19`). O trecho check/instalação é síncrono entre awaits. `payload.config.ts:71–79` envolve a factory uma vez, na composição normal; cada `factory.init` cria seus próprios WeakMap/WeakSet.
- **Ownership e rollback nativos:** a wrapper continua chamando `nativeBegin(options)` (`:32`) e não força commit ao retornar de uma operação Local. `rollbackTransaction` não é substituído. A implementação instalada remove a sessão e rejeita sua promise; a observação apenas registra false. Uma transação externa continua provisória até o dono executar commit/rollback.
- **Falha segura:** após Native commit, `:45` exige outcome verdadeiro e lança APIError público 503 com mensagem fixa quando falso. O erro não inclui SQL, título, conteúdo privado, credenciais nem a mensagem bruta do driver. Se uma sessão existente não tiver observação, `:39–41` reverte e falha fechado. O comportamento nativo de sessão já ausente é preservado (`:37`), não convertido em nova alegação de persistência.
- **Rejeições e memória:** `raw.then(success, failure)` tem ambos os handlers; ambos apenas resolvem uma promise booleana, logo a promise derivada descartada não recebe a rejeição bruta. O caller continua responsável pela promise raw original; Native conserva seu tratamento. Outcome não rejeita. O commit remove a entrada em finally (`:46`); rollback não deixa retenção forte pelo WeakMap após o adapter soltar a sessão.
- **Escopo:** a correção não grava conteúdo, não cria intenção de publicação para draft, não cria collection, não substitui autenticação/leases ou faz commit antecipado. Direct consumers de `drizzle.transaction`, caso o host já tenha sido observado, recebem a promise original. Métodos de schema/migração não foram substituídos. Isso é leitura de invariantes, não aprovação de todos os fluxos de auth/migração.

## Evidências existentes lidas — sem reexecução

`src/helpers/payload/transaction-settlement.integration.test.ts:28–47` usa autenticação nativa real, lease/revisão atuais e endpoint PATCH nativo com `draft=true`, passando depois pela fachada de confirmação. Um constraint trigger PostgreSQL `DEFERRABLE INITIALLY DEFERRED` na tabela nativa de versões rejeita o commit do documento da fixture. Não é mock de retry/transport nem falha anterior à escrita.

Os dois casos têm publicação anterior false/true. Verificam 503, mensagem segura, head anterior, título anterior, contagem de versões e outbox inalteradas. Depois removem o fault e exigem save normal 200 com novo título persistido.

| Log do executor principal | Evidência presente |
|---|---|
| `.work/e1.8-draft-commit-red.txt` | Dois testes falharam por **200 recebido, 503 esperado**, na asserção de resposta do save. |
| `.work/e1.8-draft-commit-green.txt` | Dois testes passaram; stack dos erros seguros aponta para o novo guard de COMMIT. |
| `.work/e1.8-settlement-concurrency-green.txt` | Três testes passaram, incluindo o caso de ownership/isolamento acrescentado. |

O terceiro teste (`transaction-settlement.integration.test.ts:50–77`) inicia três transações reais. A mantém draft Local provisório e sofre COMMIT rejeitado; B comita documento independente; C sofre rollback. `Promise.allSettled` espera exatamente rejected/fulfilled/fulfilled, confirma 503 para A e verifica persistência de B, ausência de C e draft durável anterior em A. A leitura externa antes do commit de A também confirma que o resultado Local ainda não é durável.

Os logs pertencem ao principal. O revisor somente os leu e capturou hashes; não invocou Vitest, PostgreSQL, Docker, Next ou build. Não extrapolar os três testes para toda a suíte da etapa.

## Snapshot examinado

Raiz: `E:\a-design-for-life`. SHA-256:

| Arquivo | Hash |
|---|---|
| `src/helpers/payload/transaction-settlement.ts` | `AE277ECCA8DBCA499FDA893FD37394D141F84F5E00D4AAA2172121066BD24BFC` |
| `src/payload.config.ts` | `FBE22E457D3CACA6E9B0C31FBADF5A3E5147FF978D8986C2B4851128093F3C4B` |
| `src/helpers/payload/transaction-settlement.integration.test.ts` | `D88EF3DA0AEF52F359EC9FD0479ACB42AB3E9C445BCDE513DF1D4A2747C10AE3` |
| `.work/e1.8-draft-commit-red.txt` | `D7124EFF795EED2AE3550E3D9714EC8EDBDCB0441D438D6427D4056EC42BAC44` |
| `.work/e1.8-draft-commit-green.txt` | `5B4E534F1B62F42C665D6B8A39B34A6C36B4D29DB84A3DDAA0110CB0AB21F4BE` |
| `.work/e1.8-settlement-concurrency-green.txt` | `C9B44C204B067E1A4647BBE81E17E7995BD8E77820F667F33F80D0185B3C5B6E` |

Também conferidos Native postgresAdapter.init, beginTransaction, commitTransaction e rollbackTransaction instalados. Hashes de begin/commit continuam respectivamente `19C7EFA7721A08DB4343512386ECB7B3A90B17B98B369CBE458313976D6C1763` e `BAE2D14DE0F2D4D21793D2A5AE916C97C87E9F01ADC4C9B20C234EC6C56158B2`, iguais à revisão D1 anterior: esses dois arquivos de node_modules não foram modificados para produzir a correção.

**Limites:** compatibilidade específica com o adapter instalado 3.92.1 e composição atual. Nenhum teste novo do revisor, nenhuma alteração no aplicativo e nenhuma afirmação de gate completo. O comportamento de versões futuras do adapter, configs diferentes, falha ambígua de conexão e demais requisitos E1.8 continuam fora deste fix-check. Não identifiquei necessidade de ampliar a correção de D1 com um novo serviço, collection ou sistema de autenticação.
