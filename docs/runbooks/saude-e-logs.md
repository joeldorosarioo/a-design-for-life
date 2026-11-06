# Saúde e logs de execução

## Estado validado

O staging usa o probe Node incluído na mesma imagem privada homologada. A configuração real, GET/HEAD autenticados e o início observado foram conferidos sem reiniciar ou interromper o atendimento. Os diagnósticos estruturados e o atendimento de cache durante indisponibilidade têm provas isoladas próprias. Driver, rotação efetiva e consulta dos logs operacionais continuam com verificação separada; o estado Healthy não encerra esses itens.

## Prontidão pública

`GET /health` responde HTTP200 com somente `{"status":"ready"}`. `HEAD /health` responde HTTP200 com corpo vazio. Ambos usam `Cache-Control: no-store, max-age=0`, `X-Content-Type-Options: nosniff`, JSON e `X-Robots-Tag: noindex, nofollow`. A rota força execução dinâmica e não importa configuração, Payload, banco, R2 ou outro serviço.

A resposta indica que o processo consegue executar esse handler. Não certifica banco, mídia, publicação, cache completo, capacidade de disco ou recuperação. Não deve consultar dependências para decidir se páginas confirmadas em cache continuam servíveis. URLs, headers, cookies, credenciais e detalhes de falhas não entram no corpo público.

GET/HEAD são os handlers definidos pela aplicação. Além das provas no Next e na imagem Linux local, as duas respostas passaram pela origem real autenticada de staging: HTTP200, corpo mínimo ou vazio, JSON, no-store, nosniff e noindex. [Recibo atual](../verification/artifacts/E3-operations/staging-health-probe-001.json).

## Probe da imagem e configuração medida no Coolify

O Dockerfile configura o Node com intervalo de 30 s, timeout de 5 s, início de 30 s e três falhas consecutivas. A imagem local 004 alcançou `healthy` em 6,466 s sem rede nem banco acessível. O probe embutido e GET/HEAD passaram. O tempo observado pertence ao contêiner local. A versão atual do probe usa um agente HTTP direto, independentemente do proxy de ambiente, e limita a resposta a 512 bytes. A prova Linux montou somente o arquivo atualizado sobre a imagem 004 e confirmou GET/HEAD e estado saudável com proxy inacessível. Esses resultados históricos são complementados pela observação atual da imagem por digest no Coolify, abaixo.

O recurso real está com healthcheck habilitado do tipo CMD, intervalo30s, timeout5s, três tentativas e período inicial30s. Comando configurado:

```sh
node /app/ops/image/health-probe.mjs
```

O probe consulta somente `http://127.0.0.1:3000/health`, ignora proxy de ambiente, limita o corpo a512bytes e usa timeout interno4s, deixando margem ao timeout externo5s. Em modo HTTP não consulta PostgreSQL ou R2. O modo PostgreSQL-only de bootstrap é separado e não é a prontidão da aplicação já em atendimento.

No deploy existente `dzeb1xlupba8kijfts6xboih`, o Coolify registrou o novo contêiner iniciado em `2026-11-06T18:04:45.664900Z`. O pipeline emitiu o recibo somente após observar `running:healthy`, às `18:04:51.6745560Z`. O limite superior conservador é6011ms, incluindo1ms pela precisão dos timestamps, dentro do período inicial30s. Trata-se de um início observado, não de uma garantia de capacidade ou do instante exato do primeiro probe. A leitura usou apenas a API e o log já existente em memória; não houve novo deploy ou restart. [Recibo de configuração e início](../verification/artifacts/E3-operations/staging-health-probe-001.json).

Uma fixture HTTP local, sem PostgreSQL, mídia, portas de host ou configuração privada, executou o binário embutido na mesma imagem `sha256:c4d47bc495bc4b00c06420751c2bff4f87b8b6baa58c18e97fdff138d3b88d6a`. HTTP200 retornou exit0; HTTP503 e timeout retornaram exit1, sem stdout/stderr; a volta a HTTP200 retornou exit0. O timeout levou4345ms. O SHA-256 do probe embutido coincidiu com a fonte revisada. Contêiner e volumes anônimos próprios foram removidos. Não se forçaram falhas no staging nem se alegou testar a contagem interna de retries do Docker. [Recibo da mesma imagem](../verification/artifacts/E3-operations/staging-image-health-probe-local-001.json).

## API de logs

Usar a entrada server-only `@/helpers/logger`. Não há biblioteca nova nem envio a serviço externo.

```ts
import { logger } from '@/helpers/logger';

const receipt = logger.error({
  operation: 'media.delivery',
  result: 'unavailable',
  correlationId,
  context: { statusCode: 503, errorCode: 'unavailable' },
});
```

`info` e `error` escrevem uma linha JSON com `dateISO`, `level`, `operation`, `result`, `correlationId` e `context`. O recibo é `{ written, correlationId }`. Correlação ausente/inválida recebe UUID novo; UUID válido é normalizado para minúsculas. Criar correlação por operação e propagá-la dentro do mesmo fluxo. Não usar ID de usuário, documento privado, token ou header arbitrário como correlação.

`operation` deve ser uma constante técnica do código, em minúsculas, com até64caracteres e segmentos alfanuméricos separados por ponto, hífen ou underscore. Valores malformados viram `invalid-operation`. A validação estrutural não classifica dados pessoais: nunca construir esse nome a partir de nomes, e-mails, CMS, URLs ou mensagens de erro. `result` aceita somente `success`, `failure`, `unavailable`, `skipped` ou `started`; valor inválido vira `failure`.

`redact(value): unknown` é uma projeção fechada e rasa. Nenhum campo desconhecido é percorrido ou copiado. Objetos simples mantêm apenas valores válidos desta tabela; arrays, Errors e outros valores desconhecidos recebem `[REDACTED]`. Campos aninhados, accessors, propriedades herdadas e ciclos não são serializados. Proxies que falham durante a inspeção são redigidos.

| Campo permitido | Valor aceito                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `durationMs`    | Número finito entre0 e86400000                                                                     |
| `statusCode`    | Inteiro entre100 e599                                                                              |
| `retryable`     | Booleano                                                                                           |
| `dependency`    | `postgresql`, `r2`, `cache` ou `mail`                                                              |
| `errorCode`     | `unexpected`, `timeout`, `unavailable`, `invalid-input`, `unauthorized`, `conflict` ou `not-found` |

Senhas, tokens, Authorization, cookies, chaves, URLs de reset, nome/e-mail pessoal, conteúdo CMS e Error.message/stack não pertencem à whitelist. Não passar request/Payload/env/Error inteiro, mesmo que a projeção descarte os campos. Não há promessa de identificação completa de dados pessoais em strings arbitrárias.

A saída padrão usa escritas síncronas em stdout; só informa `written:true` após aceitar todos os bytes. `createLogger({ write, now })` permite um sink síncrono e relógio explícitos. O sink deve retornar literalmente `true` após aceitar a linha inteira. Exceção, `false` ou ausência de confirmação resultam em `written:false`; o erro do sink não é serializado nem relogado. Falha de relógio usa o relógio local. O recibo não comprova persistência, ingestão ou retenção no Coolify. Uma falha após escrita parcial pode deixar linha incompleta, e não é reversível pelo logger. Medir impacto de backpressure no ambiente real.

Não converter falha do logger em mudança dos contratos públicos404/410/503 ou em retirada de páginas confirmadas do cache. Não imprimir o erro original como fallback.

## Integração dos consumidores e diagnóstico privado

Os limites de entrega e ingestão de mídia e de resolução de rota usam os eventos estáticos `media.delivery`, `media.upload` e `case.route.read`. Em falha, emitem `unavailable` com status 503, preservando os contratos de resposta e autorização. O worker de publicação já usa o mesmo logger.

Em homologação e produção, a configuração do Payload projeta somente diagnósticos de nível `warn` ou superior. O hook do Pino converte essas chamadas em `payload.runtime` e inclui o status somente quando autorizado. Mensagens, bindings de logger filho e argumentos brutos ficam fora do stdout. Local e teste mantêm o comportamento habitual de logging do Payload. O teste inicializou `BasePayload` real com a conexão do banco desativada e exerceu seu logger filho. RED 9 falharam e 5 passaram, GREEN focado 71/71. Tipagem, lint e formato passaram. [Recibos locais](../verification/artifacts/E3-operations/).

O diagnóstico fica em `GET /api/operations/diagnostics` e exige uma sessão Native da coleção `users`. Uma chamada anônima recebe 401 vazio antes das sondas. A resposta autenticada usa `private, no-store` e devolve somente o estado de PostgreSQL e R2. PostgreSQL usa `SELECT 1` e R2 usa `HeadBucket` no bucket configurado, com uma janela de resposta de 2 s para cada sonda. Em modo de armazenamento local, R2 aparece como `not-configured`. Dependência indisponível produz 503 apenas no diagnóstico. Se o próprio banco impedir a autenticação Native, o endpoint pode ficar indisponível junto com o painel. O probe do Coolify continua apontando exclusivamente para `/health`. [Compatibilidade de HeadBucket](https://developers.cloudflare.com/r2/api/s3/api/#implemented-bucket-level-operations)

## Consulta e rotação propostas

Proposta inicial de rotação:10MB por arquivo e três arquivos por contêiner. Confirmar no executor/log driver disponível do Coolify, aplicar na configuração de infraestrutura apropriada e ajustar ao disco contratado antes de A3. Não existe configuração aplicada por este runbook.

Separar logs de implantação (build/pull/início) dos logs de execução (stdout da aplicação). Demonstrar consulta por correlação e por resultado; provocar rotação com dados técnicos sintéticos sem segredos, verificar limite de disco, retenção e continuidade após reinício. Guardar configuração efetiva e recibos da prova. Não habilitar debug que inclua headers, env, SQL com valores privados ou conteúdo editorial.

Não adicionar monitoramento ou notificações externos. A observação pelo próprio host não comprova detecção da queda da VPS.

## Evidência ainda necessária para A3

- Preservar os recibos atuais de GET/HEAD, configuração e início do probe ao promover a imagem; métodos adicionais e alterações futuras precisam de suas provas próprias.
- Comprovar acesso e rotação dos logs de execução separadamente dos de implantação no Coolify de homologação.
- Exercitar falhas reais de PostgreSQL/R2 com páginas confirmadas em cache e provar que a prontidão não as retira indevidamente do serviço.
- Integrar eventos seguros de publicação, cache, processamento e integrações; executar gates Native/E2E/verify no ambiente isolado coordenado.
- Consultar os recibos e limites de migração controlada, backup e rollback nos runbooks próprios; a prova de saúde não substitui essas verificações.

Os testes unitários da preparação validam a linha serializada, projeção de contexto, limites/erros e os handlers diretos. Não substituem estas provas operacionais.
