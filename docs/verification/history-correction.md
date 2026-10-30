# Correção do histórico local

29/10/2026, America/Sao_Paulo. Solicitação explícita do usuário: commits e branches em inglês, Conventional Commits, unidades pequenas e branch `develop`.

Na primeira correção, os dois commits locais iniciais foram reorganizados em 34 commits por referência, configuração, comportamento, teste e conjunto de evidências. Essa organização foi posteriormente consolidada conforme o esclarecimento do usuário, registrado abaixo. Nenhum remoto estava configurado e nenhum push foi realizado. As referências aprovadas e os logs brutos foram preservados.

| Marco original                                    | Marco equivalente no histórico corrigido   | Árvore Git idêntica                        |
| ------------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| `a4f102171a8c7a8bdbb3ea3d250ec65783e74ee2` — E1.1 | `930a789728f691fdf118d4acfdaa34d6be7f79a6` | `b008355708dc63db46270e68e8784fa17eaa139a` |
| `9a38b7d36da1329c7f10ae1414acead7419c2489` — E1.2 | `58c038ef7e8788cb38e241ab1305d46fc439f91a` | `c72cc09b9b3e556f120852c97154ee08fd40217b` |

A branch ativa é `develop`. A referência de branch anterior foi removida após verificar a nova árvore e preservar o histórico em um bundle local ignorado. Não houve reset, checkout de arquivos ou reaplicação de stash.

## Provas executadas

- Plano de divisão conferido antes da alteração.
- Histórico original salvo e `git bundle verify` concluído.
- Cada marco reconstruído comparado com sua árvore original: hashes idênticos.
- Os 182 arquivos versionados e em andamento foram comparados por SHA256 antes/depois, sem diferença.
- Índice original preservado; estado dos arquivos de E1.3 mantido exatamente.
- Mensagens dos 34 commits validadas contra o padrão Conventional Commits e texto ASCII em inglês.
- Branch conferida como `develop`; nenhum remoto configurado.

A correção altera somente histórico e documentação de rastreabilidade. Não repete nem substitui as verificações funcionais de E1.1/E1.2; o trabalho não commitado de E1.3 continua com seu próprio gate pendente.

Os hashes anteriores presentes em relatórios e saídas brutas são registros históricos. A tabela acima mantém a correspondência sem modificar evidências capturadas. O lockfile e os arquivos gerados foram mantidos íntegros como unidades técnicas; a separação foi feita por responsabilidade.

Backup e manifestos locais ignorados: `.work/history-correction/`. Contêm o bundle anterior, snapshot comprimido dos arquivos e mapa completo dos novos commits. Não contêm `.env` ou dependências ignoradas.

## Consolidação posterior por responsabilidade

O usuário esclareceu que a coerência deve prevalecer sobre a fragmentação e solicitou aplicar isso ao histórico. A sequência foi consolidada em 13 commits funcionais: referências, toolchain validada, configuração segura, bootstrap Payload/PostgreSQL, jornadas, DTO público, fronteiras de módulos, CI, marco de arquitetura, modelos bilíngues, provisionamento e documentação de convenções.

| Marco anterior                          | Marco equivalente consolidado            | Árvore Git preservada                    |
| --------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| E1.1: a4f1021 / 930a789                 | 32e956f42fe53e81865a5732aeffcf84444d5873 | b008355708dc63db46270e68e8784fa17eaa139a |
| E1.2: 9a38b7d / 58c038e                 | 615ea104a93f04bde00aac0e6f5cec6918865562 | c72cc09b9b3e556f120852c97154ee08fd40217b |
| Primeiro conjunto parcial E1.3: 1d541f9 | 56cd2e8e5b25a2bfe839219d11e6ef51354bfe4a | 43e4d86f173c5867938a6c317479f492bbd4ddb7 |
| Convenção de coesão: 815c3fa            | 13bb200547069048ca41cc6bb5d14b82fe72de63 | 19f26d8fc094c7932d85a53b691cec74623f9403 |

As quatro árvores foram verificadas durante a reconstrução. Os 267 arquivos versionados e em andamento e o índice original foram preservados byte a byte antes/depois da troca do ponteiro de develop. Nenhum checkout/reset/stash foi necessário. Histórico, snapshot comprimido e mapa completo estão no backup local ignorado .work/history-cohesion/; o bundle foi verificado antes da alteração. Não houve remoto ou push.

A atualização deste registro e da regra de porcentagem é documentação posterior aos marcos equivalentes, sem alteração do código verificado. E1.3 permanece em andamento.
