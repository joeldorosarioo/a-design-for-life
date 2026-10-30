# Correção do histórico local

29/10/2026, America/Sao_Paulo. Solicitação explícita do usuário: commits e branches em inglês, Conventional Commits, unidades pequenas e branch `develop`.

Os dois commits locais iniciais foram reorganizados em 34 commits por referência, configuração, comportamento, teste e conjunto de evidências. Nenhum remoto estava configurado e nenhum push foi realizado. As referências aprovadas e os logs brutos foram preservados.

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
