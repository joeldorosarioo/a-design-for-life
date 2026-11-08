# Publicação confirmada e falhas — E1.8

Etapa 1: **87,5%**. E1.8 e A1 permanecem pendentes do gate independente. Esta implementação local não inicia a etapa 2 nem autoriza implantação.

## Autoridade pública

O banco conserva o trabalho editorial e intenções imutáveis. A raiz persistida `current.json` conserva a geração pública confirmada. Uma resposta captura essa raiz uma vez e a repassa às projeções: corpo, canonical, histórico, lista, ordem, destaques, contagem, SEO, sitemap, alternates, perfil, navegação e concessões de mídia. Reordenação de `cases` é uma intenção própria e não publica traduções.

A raiz fica em `.work/publication/<namespace>/current.json`; o namespace deriva de APP_ENV, SITE_ORIGIN e nome do banco. O caminho deve sobreviver aos processos. Não é um cache Map nem é reconstituído a partir de `_status` durante uma leitura pública. O arquivo é privado; novos arquivos temporários são gravados, sincronizados e renomeados no mesmo diretório. Leituras observam a geração anterior ou a seguinte. Não se afirma resistência a perda de energia no Windows.

Os getters públicos recebem opcionalmente uma raiz explícita. `readPublishedPortfolio` captura uma geração para todas as projeções. A rota conhecida e os bytes confirmados não inicializam o Payload nem consultam PostgreSQL. Em ausência de conteúdo confirmado, uma origem inacessível produz 503; uma origem saudável permite distinguir 404. A prévia é autenticada, privada e no-store. REST anônimo nativo exige `publicConfirmed`; filtros, ordenação e contagem não expõem o alvo pendente.

## Protocolo de gravação

1. O Payload valida domínio, revisão e lease. Seus hooks `afterChange` e `afterOperation` ainda antecedem COMMIT.
2. O hook registra `publication-updates` e troca `latestPublicationIntent` na mesma transação nativa. O alvo contém DTO e referências de mídia imutáveis; a feature continua dona da validação e da composição.
3. Após a operação nativa, uma leitura independente exige a intenção efetivamente comitada. Uma transação Local externa continua provisória até seu dono concluir COMMIT; não há promoção em seus hooks.
4. O coordenador adquire o escritor global entre processos e abre uma transação SQL. Um CAS na linha real do head, com a intenção atual, bloqueia essa linha. Uma sessão ausente é erro: o fallback de `getTransaction` para a conexão global não vale como fence.
5. Com o alvo já comitado, o coordenador compõe e substitui a raiz inteira. Somente essa substituição concede visibilidade e mídia pública.
6. Na transação SQL, reconcilia reservas de rotas e referências de mídia, registra confirmação e conclui o ACK. Uma leitura independente confirma o resultado. O retry da mesma intenção já presente na raiz reaplica somente a reconciliação, sem gerar outra publicação.

Não existe atomicidade de dois recursos entre FS e SQL. Se a raiz avançou e o ACK falhou, a publicação pode estar visível enquanto o recibo permanece `update-pending`. A intenção persistida permite recuperar essa diferença. Uma intenção SQL mais nova ainda pendente não equivale a uma publicação mais nova confirmada. Sob perda da sessão SQL não se promete simultaneidade distribuída instantânea. O escritor global impede uma tentativa antiga de substituir uma geração **já confirmada** mais recente.

O escritor usa named pipe no Windows e socket abstrato no Linux, com identidade estável do diretório. O kernel libera a exclusividade ao encerrar o processo; não há TTL nem tomada de posse de processo apenas lento/pausado. A prova Windows usa processos reais. O teste SIGSTOP Linux exige execução na CI Linux e não é declarado aprovado pela execução Windows.

## Recibos e CMS

`operationId` identifica a intenção; `targetRevision` identifica a revisão editorial que a originou. `public`, `update-pending` e `superseded` são estados de aplicação pública, separados da revisão privada atual. Salvar um draft não cria uma intenção nem substitui a última intenção aprovada. O CMS usa recursos nativos para mostrar estado persistido, recarregar e repetir a intenção. O retry não reinicializa o formulário, não adquire lease e não publica alterações não salvas. O servidor exige usuário nativo, acesso ao documento e vínculo entre operação e assunto.

Native 2xx sozinho não significa publicação confirmada. O envelope mantém `doc`, acrescenta recibo e mensagem específica. Retirada pendente conserva o conteúdo anterior até a troca da raiz. Uma tentativa substituída não pode reivindicar que o corpo antigo do formulário é o corpo público mais recente.

O adapter @payloadcms/db-postgres 3.92.1, com Payload 3.92.1 e drizzle-orm 0.45.2, consome a rejeição tardia de COMMIT em sua promise de início. `withConfirmedTransactions` observa a promise bruta de Drizzle antes desse catch, associa seu desfecho ao objeto real da transação e exige sucesso no commit. Preserva a promise original, bindings, opções e rollback nativos. Uma falha real de COMMIT em Save Draft ou publicação devolve 503 seguro, sem afirmar que foi salvo. Atualizar Payload/Drizzle exige repetir essa caracterização; não houve alteração em node_modules.

## Reservas durante falhas

Referências pendentes acumulam por proprietário/revisão. O comando de mídia preserva a união global ordenada dos IDs antigos/novos e um CAS por mídia. A reconciliação pública só retira pendências quando é seguro. A raiz concede acesso aos bytes; SQL conserva retenções para impedir descarte físico prematuro.

No intervalo raiz→ACK, inclusive com `everPublished=false`, rotas e identidade permanecem protegidas. Antes de marcar uma tentativa antiga como substituída, o coordenador bloqueia o head atual e reconcilia a raiz existente sem retirar pendências mais novas. Isso fecha a corrida entre leitura de reserva e remoção de pin. Um draft nunca público pode ser excluído e sua rota liberada depois de cancelamento/reconciliação seguros; não recebe uma reserva eterna por ter tido uma tentativa cancelada.

## Migração e operação local

A migração `20261030_124550_publication_coordination` acrescenta campos editoriais tipados, versões, campos técnicos e a única collection adicional aprovada. Na mesma transação captura publicações anteriores pela leitura canônica Native `draft:false`, junto das reservas históricas já públicas. Captura também tombstones de retirada; ignora o corpo privado mais recente. Não republica conteúdo nem recria versões. Banco vazio sem usuários não requer conta fictícia; dados elegíveis sem editor existente falham claramente e preservam a transação.

Enquanto houver intenção de bootstrap pendente, mutações editoriais comuns falham com 503. Um operador local com editor existente executa:

```powershell
pnpm migrate
pnpm bootstrap:publications
```

O bootstrap usa os mesmos retries, respeita dependências e é idempotente. Não execute contra dados não revisados nem remova a raiz pública para resolver uma falha. Primeiro preserve banco, raiz e armazenamento privado; diagnostique a intenção e repita o bootstrap/retry. O comando permanece limitado aos ambientes local/teste desta etapa. Provisão de volume, topologia de múltiplos hosts, provider de objetos e recuperação operacional de produção são decisões da etapa 3.

A prova de upgrade usa fonte anterior exata 0fa495864cfefcf3489856d66444b81fdf1f730e e dados/versões criados antes da migração, não apenas linhas com campos nulos. A→B permanece 308, B200, draft C404, retirada410, nunca público404; restauração gera somente draft e conserva raiz, versões antigas e SHA dos bytes.

## Limites de evidência

Há testes PostgreSQL, armazenamento, processos e falhas reais. A prova de reinício/PG indisponível usa um servidor HTTP mínimo em processo novo que chama as funções de produção; não é um reinício completo do servidor Next. Separadamente, os E2E usam build Next de produção e CMS Native real. Os estados finais e comandos estão em [E1.8](../verification/E1.8.md); A1 continua pendente em [A1](../verification/A1.md).

## Limites de resposta e cobertura após revisão

A perda da segunda autenticação nunca devolve o sucesso Native indiferenciado. A confirmação responde503 explícito, exige nova sessão e consulta antes de repetir a gravação, sem promover sem usuário. Falhas antes da primeira prova independente de intenção não sustentam alegação de save/public. Uma intenção já lida fora da transação editorial sustenta um recibo `update-pending` mesmo quando uma leitura posterior de dependência, raiz ou coordenador falha. As interfaces públicas contêm essas falhas e não expõem mensagens SQL/FS.

Sem cobertura do assunto na raiz, uma rota comprovadamente pública pela classificação SQL significa503, não404. A mesma regra vale para mídia com uso SQL confirmed sem cobertura do proprietário. O banco apenas classifica indisponibilidade; não fornece corpo nem concede bytes. A presença de um proprietário com lista pública de mídia vazia confirma revogação, inclusive durante ACK pendente. Gerações anteriores explicitamente capturadas continuam coerentes para assuntos que cobrem.

O contador técnico `attempts` ainda não registra todas as tentativas falhas quando sua transação reverte (minor I4). Não o use como auditoria completa de retries; a operação pendente persistida e seu diagnóstico continuam a base de recuperação. I5 mantém os avisos já documentados de lint/pg/reporter, sem supressão.

### Seleção Native e transporte estrutural após revisão ampla

O acesso anônimo Native decide pelo head atual: draft=true é normalizado antes da consulta, para impedir que uma versão histórica com marcador herdado autorize um alvo pendente. Antes de salvar uma nova versão publicada, seu marcador já é false; só o ACK confirma o head. Editores autenticados continuam lendo drafts e versões, e o Local explicitamente confiável conserva sua seleção. Não há migração que reescreva versões antigas para obter essa garantia.

Perfil/Navegação publicados traduzem falta de cobertura em503/no-store. SQL não fornece o DTO: uma contagem técnica de intenções por locale serve somente para provar ausência/never-public404 quando o origin está saudável. Uma intenção pendente pode ter atravessado a troca FS sem ACK, portanto sua presença conserva503 se não há geração utilizável. A falta de prova de ausência nunca vira404; o corpus e os grants continuam exclusivos da raiz confirmada.
