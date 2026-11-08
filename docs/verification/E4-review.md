# E4 — Revisão da correção e dos verificadores

Base `7331e34c7ed52e9be44fa1e4fa3247f4820d64b3`, com diff de trabalho em `develop`. A revisão de padrões e a revisão de aderência ao plano ocorreram em paralelo. `next-env.d.ts` é a alteração local preexistente e está fora da candidata.

## Standards

- O preflight aceitava uma rota da origem correta que não correspondia à página declarada. RED confirmou saída 0 para `/pt/admin` como Home PT. O executor agora exige as seis rotas e classes previstas. Testes adjacentes comprovam matriz válida, rota errada e origem externa recusadas.
- O relay podia encaminhar bytes de corpo de GET sem a moldura de entrada. RED reproduziu HTTP 200 de um upstream sintético para uma entrada com corpo. O relay rejeita corpo antes do transporte e encerra o GET/HEAD de destino sem encaminhar o corpo. As sete provas do relay passaram.
- Os valores de `sizes` acompanham as proporções dos slots CSS. O comentário aponta a ligação. Largura, altura reservada, conteúdo e regras de autorização da imagem continuam os mesmos.

## Spec

- A prova com dois editores agora lê cada rascunho por sua sessão antes de executar os GETs como visitante. Ela verifica identidade, slug, idioma, título salvo e estado de rascunho. A primeira repetição enviou cookie sem `Origin` e o Payload devolveu 404 por tratar a consulta como anônima. Com `Origin` no consumidor de teste, a leitura editorial e as negativas anônimas passaram na suíte completa de 123 jornadas. [Gates locais](artifacts/E4-gates/final-local-001.json)
- O runner recebe origem, revisão e manifesto declarados. A evidência de cada rodada exige associação aos recibos SSH independentes, com a mesma autoridade de conteúdo. O pacote da primeira rodada contém os dois recibos e a comparação. O sucessor terá registro próprio.
- O dossiê inclui `BLOCK-DEPENDENCY-REFRESH` e a condição de relatórios GA4 sem flexibilizar o armazenamento negado. A correção de capa usa dimensões já confirmadas, aplica o tamanho antigo aos registros anteriores sem dimensões e preserva a geometria aprovada.

[Auditoria de performance](E4.2-performance.md) · [Jornadas](jornadas.md) · [A4](A4.md)
