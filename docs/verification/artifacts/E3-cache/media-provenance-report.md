# Proveniência de mídia para confirmação pública

Fatia local de E3.2 sobre o checkpoint `1e93925` + `6ab4948`. O objetivo é manter a identificação das rotas previamente públicas depois que `current.json` troca de geração e antes da confirmação SQL.

## Contrato

- A composição já optante pela observação grava `value.mediaObservation.removed` em cases e perfis. Cada item contém apenas UUID e variante `original`/`wN`, ou UUID e `optimizer: true`. Até 64 alvos podem ser retidos por entrada. O limite técnico da prova recusa a composição fora desse envelope, sem descartar alvos.
- A raiz, o schema estrito do envelope de assunto, as projeções de DTO e a autoridade de concessões continuam com a mesma forma. O leitor anterior lê a `value` como JSON e as projeções de case e perfil leem seus campos conhecidos. O backup de `current.json` inclui a proveniência sem inventariar chaves de objetos removidos por esse campo.
- Uma retirada de referência compara os alvos do próprio assunto substituído com o próximo assunto. Uma referência readquirida sai da lista. A decisão futura sobre servir ou negar os bytes considera a raiz inteira. A procedência guardada não decide autorização.
- O coordenador reaproveita a leitura existente de operações anteriores e inclui o identificador exato do predecessor selecionado somente ao substituir uma entrada sob observação. A composição considera reconhecido apenas o par operação e revisão anterior em estado `public`. As operações `update-pending` e `superseded` conservam o contexto. Apenas linhas `update-pending` passam pelo laço original de retirada de pendências.
- A tentativa da mesma operação reutiliza o arquivo promovido. Uma tentativa superada mantém as regras anteriores de reconciliação. Não há armazenamento auxiliar, coluna, migração ou consulta adicional.

## Evidência

Os comandos usaram Node `24.22.2` da ferramenta fixada no repositório, o `vitest.mjs` instalado, os projetos explícitos `unit` e `architecture` e os arquivos registrados abaixo.

| Recibo | Resultado |
| --- | --- |
| `media-provenance-unit-red.log` | 5 falhas de asserção esperadas e saída 1. A informação faltava na leitura da raiz e no contexto da composição. |
| `media-provenance-bounds-red.log` | 2 falhas de asserção esperadas e saída 1 para rota insegura e excesso do limite. |
| `media-provenance-resume-red.log` | 1 falha de asserção esperada e saída 1 para a rota original do PDF anterior. |
| `media-provenance-final-unit.log` | 8 arquivos, 81 aprovados, 1 teste de render snapshot pulado no Windows pela condição existente, saída 0. |
| `media-provenance-final-architecture.log` | 34 aprovados, saída 0. |
| `media-provenance-final-static.log` | TypeScript com entradas restritas e imports, Prettier, ESLint e `git diff --check`, todos com saída 0. |

O inventário `media-provenance-final-sha256.txt` contém os seis caminhos e hashes finais. As entradas da validação de tipos ficam em `media-provenance-tsconfig.json`. O projeto `unit` não carrega o setup do PostgreSQL. As provas de arquivos usam diretórios temporários descartáveis. A simulação Native só testa o contexto selecionado e o filtro recebido pelo coordenador.

## Continuação

- Exercitar o `find` Native com o predecessor anteriormente promovido e sem ACK no PostgreSQL descartável. O escopo unitário não prova como o adaptador interpreta o filtro ou como persiste o recibo.
- Implementar o observador binário em fatia separada. Um GET exato do original/derivado comprova tipo, tamanho e SHA-256 da manifestação. Uma requisição canônica ao otimizador comprova resposta de imagem completa e limitada. Todos os resultados precisam de `X-Portfolio-Generation` da mesma captura. A última concessão só se confirma com resposta 404 vazia, enquanto uma concessão compartilhada exige bytes válidos. A falha 503 conserva a pendência.
- Antes de habilitar a prova de bytes, tratar a entrada histórica já promovida e pendente que não tenha proveniência. As linhas Native de uso não distinguem uma mídia pendente nunca selecionada de uma que chegou a `current.json` sem ACK. A falta desse contexto não serve como confirmação de revogação. O observador ainda não consome a proveniência nesta fatia.
- O ensaio do processo real deve conservar o mesmo build e estado de storage, observar um alvo de mídia especificamente falho após as respostas públicas corretas e retomar a mesma raiz. Um listener de teste pode retransmitir as rotas válidas para a origem própria do servidor primário. A origem interna do secundário também direciona a chamada interna do otimizador.
