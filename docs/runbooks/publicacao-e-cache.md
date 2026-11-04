# Publicação, cache confirmado e recuperação

Este runbook descreve a autoridade aprovada em A1 e as provas locais de E3.2. O cache confirmado já passou pelo ensaio real de indisponibilidade e reinício do Next. O worker local processou intenções após reconexão do PostgreSQL e após encerramento abrupto entre a promoção da raiz e o recibo SQL. Limites operacionais, homologação e R2 real têm verificações próprias. A3 permanece pendente.

## Estratégia e APIs reais

O cache durável é de **dados públicos confirmados**. `current.json` contém uma geração composta por assuntos com `operationId`, `targetRevision` e um envelope público validado. Nenhuma leitura pública pode reconstruir esse corpo consultando o rascunho atual. Uma consulta indisponível não produz ausência persistida, lista vazia bem-sucedida ou nova geração.

APIs atuais:

- `readPublicRoot(directory)` seleciona a autoridade atual; `withPublicRootWriter(directory, operation)` serializa escritores e promove um arquivo completo por rename atômico.
- `pinPublicRoot(directory, root)` e `readPinnedPublicRoot(directory, pin)` transportam a mesma geração por arquivo imutável, geração e SHA256. O pin recebido do visitante não escolhe a autoridade.
- `preparePublicRenderRequest(request, options)` captura current uma vez e prepara status/contexto assinado antes de RSC. `readPublicPageRequest`, memoizado com `React.cache`, compartilha essa captura entre corpo e metadata **da mesma requisição**.
- `enqueuePublicationUpdate(input, req)` persiste intenção imutável na transação editorial. `retryPublicationUpdate(operationId, req)` e `portfolioPublicationCoordinator(directory)` promovem a intenção comitada, reconciliam rotas/mídias e leem independentemente o recibo SQL.

`React.cache` não é o armazenamento persistente. HTML e respostas de mídia usam no-store; o cache interno de bytes do otimizador Next é outra camada. Não há `next/cache`, ISR ou tags a invalidar nesta estratégia, nem necessidade demonstrada de um cache handler adicional.

### Mapeamento explícito do plano para A1

A interface proposta `readPublicSnapshot({ key, locale, origin, loader })` está materializada pelo namespace de `publicRootDirectory(env)`, seleção de `readPublicRoot` e projeções das features sobre a raiz capturada. Os loaders Payload pertencem à preparação editorial da intenção, não a um fallback público que possa trazer o corpo pendente. A infraestrutura genérica não importa Cases, Perfil ou Navegação.

`refreshPublicDependencies(operationId)` corresponde ao retry persistido e ao coordenador composto em `config/`. Trocar a raiz atômica torna todas as projeções dependentes da nova geração, sem uma segunda autoridade de tags. A verificação HTTP deve conferir o conteúdo/revisão e os estados realmente servidos; ACK SQL ou invalidação isolada de tag não substituem essa prova. A prova preparada compara recibos/revisões da raiz com resultados públicos reais após publicação/retirada e repete as leituras sob queda/reinício. Ela não acrescenta HTTP de autoverificação a cada publicação de produção nesta fatia.

| Dependência editorial                     | Projeções públicas afetadas                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `case:<id>`, `cases:<locale>`             | Detalhe atual/histórico, cards, contagem, lista do idioma                          |
| `featured:<locale>`                       | Destaques e ordem na Home                                                          |
| Ordem/destaque compartilhados             | Listas/destaques PT/EN, sem publicar traduções privadas                            |
| `profile:<locale>`, `navigation:<locale>` | Home, Sobre, introdução da lista, header/footer, contatos e currículo              |
| `sitemap`, `alternates`                   | Rotas/canonicals/alternates derivados exclusivamente dos conteúdos confirmados     |
| `media`                                   | Concessões atuais, originais, derivados e autorização antes do cache do otimizador |

Idioma está nos envelopes validados; assunto está nas chaves collection/id. O namespace privado deriva de APP_ENV, SITE_ORIGIN e nome do banco. Ambientes com o mesmo nome de banco/origem devem manter volumes separados; a função atual não diferencia host/porta do cluster quando os demais componentes coincidem.

## Persistência e limites

Montar o diretório `.work/publication` relativo ao working directory da aplicação em volume privado persistente. `current.json`, snapshots de render e temporários pertencem a esse volume. O filesystem precisa suportar rename atômico no mesmo diretório e hard links para os pins. Linux sincroniza arquivo e diretório; não há promessa de resistência a perda de energia no Windows.

Preservar raiz, banco e armazenamento privado juntos em investigação/recuperação. Não apagar current para corrigir publicação pendente. O volume montado e seu backup fazem parte das provas E3.4/E3.6; a descrição do caminho não comprova a montagem real.

`DEBT-RENDER-SNAPSHOT-RETENTION` continua aberto: os pins não têm GC automático. Antes de produção, definir orçamento/observação de bytes, número/idade de gerações e temporários, e procedimento seguro de manutenção. TTL arbitrário não protege um render pausado. A limpeza manual exige processos de render parados e preservação de current/gerações necessárias; esta fatia não implementa um coletor.

A raiz pública pode avançar antes do ACK SQL: nesse intervalo o conteúdo já está visível e o recibo continua pendente. Repetir a mesma intenção reconcilia sem republicar um rascunho nem sobrescrever uma geração confirmada mais nova. O estado public atual se baseia em promoção e confirmação independentes do protocolo A1; evidência HTTP do caminho Next é necessária para validar o contrato integral na etapa 3.

Uma rota nunca visitada por HTTP pode funcionar durante a queda se seu conteúdo já está na raiz confirmada. Isso é cache de dados, não uma lista de URLs aquecidas. “Sem cache” na prova significa **sem cobertura pública confirmada**: sem origem para classificar essa ausência, a resposta é503; após recuperação, a origem saudável pode comprovar404. Nunca degradar uma publicação confirmada para503 apenas porque a URL não foi visitada antes.

## Prova preparada com Next de produção

`src/config/public-cache.e2e.test.ts` usa o build único do global setup Playwright e cria um segundo processo com `testing/setup/owned-next-server.ts`.

- Ambiente: APP_ENV=test, banco adquirido em 55434, storage local exclusivo, Next 16.4.3/Payload 3.92.1, runtime Node 24.22.2. Nenhum R2, e-mail real ou Analytics é ativado.
- Origem canônica permanece a do runner (normalmente `http://127.0.0.1:3101`), para ler a mesma raiz. O processo secundário escuta `http://127.0.0.1:3102` e usa essa própria origem em INTERNAL_HTTP_ORIGIN, inclusive no otimizador. Canonicals continuam apontando para a origem canônica, corretamente registrada separadamente da física.
- O helper exige dist `.work/next-tests/<run-id>` e BUILD_ID existente, recusa portas de preview/banco/servidor principal e colisões, e só encerra o ChildProcess que ele criou. Restart exige o mesmo BUILD_ID. `/health` tem contrato 200 JSON `{status:'ready'}` com no-store, nosniff e noindex; a prontidão independe de PostgreSQL.
- Dados sintéticos PT/EN completos aquecem Home/lista/detalhe, metadados, ordem/contagem, original/derivado e um HIT real do otimizador. Um draft privado continua ausente.
- Só o container/network adquirido e validado é desconectado. Home/lista/detalhe e mídia confirmados permanecem 200; rotas/mídia sem cobertura recebem 503 sem vazamento. O processo secundário reinicia com a mesma build e a origem ainda fora do ar.
- Após reconexão, a ausência volta a 404. Uma imagem compartilhada continua pública com o proprietário EN depois da retirada PT. Removida a última referência, GET/HEAD/condicionais/range negam originais, derivados e bytes já presentes no cache do otimizador; a negação é repetida após nova queda/reinício.

Na negação de mídia sem grant, a classificação atual consulta SQL. Portanto, com PostgreSQL indisponível pode haver 503 vazio em vez de 404. Isso nunca autoriza 200/206/304 nem bytes. Não prometer apagar cópias já baixadas. O teste usa storage local; não é prova de privacidade/entrega R2 real.

O finally reconecta a origem antes da limpeza SQL das fixtures, encerra apenas o filho próprio, fecha os contextos e anexa evidências. Se não conseguir comprovar a restauração, recusa a limpeza SQL e reporta falha. Não encerrar processos por porta nem executar teardown Docker global.

### Execução coordenada

Executar somente depois de liberar o gate do ciclo de vida isolado e confirmar que não há outro runner dono do namespace fixo. Preservar preview 008, PostgreSQL visual 55433 e serviços 5432/55432.

Na raiz do repositório, com Node portátil selecionado:

```powershell
$cacheProofNode = Join-Path (Get-Location) '.toolchain\node-v24.22.2-win-x64\node.exe'
& $cacheProofNode --conditions=react-server '.\node_modules\@playwright\test\cli.js' test src/config/public-cache.e2e.test.ts --project=chromium --workers=1 --reporter=list,json
```

Global setup faz `next build` e inicia o servidor principal; o teste só inicia/reinicia seu secundário. Não executar o E2E reutilizando uma build do preview. Preservar stdout/stderr/exit, JSON Playwright, `E3-confirmed-cache-proof.json` e `E3-owned-next-output.txt` anexados ao resultado. A prova anexa BUILD_ID, fontes/SHA256, namespace, IDs próprios, origens, versões observadas, estados HTTP, hashes dos bytes e cache HIT, sem cookies/sessão/corpos privados.

Os testes unitários do helper usam fronteiras de processo/prontidão controladas e não inicializam Next/PostgreSQL:

```powershell
& $cacheProofNode '.\node_modules\vitest\vitest.mjs' run --project=unit testing/setup/owned-next-server.test.ts
```

Se a prova real descobrir regressão, preservar os artefatos e diagnosticar antes de alterar a autoridade A1. Depois dos gates focados, ainda executar os checks e `pnpm verify`/E2E integrados exigidos no plano. Não converter preparação ou resultado unitário em crédito parcial nos trinta critérios originais.

## Trabalho operacional ainda pendente

### Ativação da persistência de tentativas

`PUBLICATION_RETRIES_ENABLED` é uma configuração exclusiva do servidor. Ausente ou `false`, mantém a nova collection técnica fora do runtime e a gravação editorial segue sem consultar a tabela de tentativas. Os ambientes existentes e seus arquivos privados não foram ativados por esta implementação.

Aplicar primeiro a migração aditiva `20261104_012603_publication_retry_metadata`, em uma execução de migração controlada e separada do atendimento. Ela cria somente `publication_retries` e seus índices; `lockDocuments:false` evita acrescentar colunas às relações históricas de bloqueio editorial. Após comprovar a migração, configurar `PUBLICATION_RETRIES_ENABLED=true` no runtime e reiniciar a mesma imagem. Num rollback de imagem que usa o schema compatível, mantenha o catálogo aditivo e desabilite a flag se a imagem anterior exigir. Não existe autodetecção por tabela, auto-DDL nem alteração automática de ambiente.

O ambiente de testes adquirido na porta 55434 opta explicitamente por essa configuração: seu global setup executa as migrações antes das fixtures. Capturas históricas usam uma opção interna explícita que impede qualquer acesso à tabela posterior enquanto o replay ainda não a criou. Nenhuma migração histórica publicada foi editada.

A collection privada armazena operationId, editor real, versão de tentativa iniciada, contador automático e próximo horário. Não armazena alvo, estado público ou concessão. Intenção e metadados iniciais usam a mesma transação editorial; claim durável e resultado usam requisições independentes e CAS de versão. `publication-updates` e current.json continuam como autoridade. Metadados legados ausentes ou sem editor permanecem manuais até uma tentativa explícita por editor autorizado; não se escolhe o primeiro administrador.

O processo automático foi ligado com opt-in explícito. Ele recuperou a mesma operação e geração depois que o processo anterior foi encerrado antes da confirmação SQL. A limitação I4 do contador antigo `publication-updates.attempts` permanece; `startedAttemptsVersion` é o novo contador durável de execução, comprovado separadamente, sem somar duas vezes nem inventar histórico retroativo. Manter pendência visível e repetição manual segura enquanto isso.

### Política de novas tentativas

A tentativa imediata começa após o commit editorial. A agenda persistida arma a primeira tentativa automática para 1 s após o início imediato ou, se ele não ocorrer, 1 s após o registro da intenção. A primeira tentativa automática arma a segunda para 5 s após seu início. A segunda arma a terceira para 15 s após seu início. Os horários indicam quando a operação se torna elegível. Com um dreno ativo, a próxima consulta aguarda a conclusão do lote anterior e mais 1 s. O lote padrão seleciona até 20 operações e as processa em sequência.

Depois de três tentativas automáticas sem confirmação, a agenda fica vazia. O recibo continua pendente e um editor autorizado pode repetir manualmente a mesma operação. A repetição manual reinicia o orçamento de três tentativas para a intenção ainda vigente. Uma confirmação válida ou substituição por intenção mais recente encerra a agenda. O worker usa a conta real vinculada à operação. Se ela estiver ausente ou tiver sido removida, a agenda automática é desarmada e a operação fica disponível para repetição manual autorizada.

O processo que atende Next registra um único supervisor e usa o mesmo banco e a mesma raiz de publicação. A aquisição persistida por versão e o bloqueio do escritor protegem a operação durante reinícios. Após aplicar a migração e ativar os metadados, o supervisor depende de `PUBLICATION_RETRY_WORKER_ENABLED=true`. O prazo normal de até 60 s segue como proposta para A3. O ensaio do relógio da política comprova elegibilidade e limite, enquanto o prazo de propagação depende de carga, tempo de verificação e condições da stack.

A VPS única e o próprio volume continuam pontos de falha. Cache nessa máquina não garante atendimento se a máquina cair; bytes originais também dependem do armazenamento que realmente os contém. Homologação, montagem/backup e falha R2 permanecem provas distintas.

## Verificação da revisão servida — opt-in de teste

O Proxy entrega o marcador opaco `X-Portfolio-Generation` vinculado à raiz selecionada. Perfil, navegação e o agregado anônimo de cases retornam o marcador da mesma captura usada pelo corpo. O observador faz GET direto pelo loopback, confere a geração e o conteúdo completo, compara os DTOs e valida a marcação renderizada de páginas selecionadas. O coordenador só grava confirmação SQL após a observação bem-sucedida; falha mantém o receipt pendente e permite repetir a mesma geração.

`PUBLICATION_HTTP_VERIFICATION_ENABLED=true` está restrito ao runner isolado. A suíte comum força o valor false. O ensaio real precisa selecionar explicitamente o próprio processo Next e a origem interna de loopback. Recibos e limites em [observação da revisão pública](../verification/artifacts/E3-cache/publication-observation-current.md).

### Prova em Next compilado para produção

O ensaio isolado `publication-http-observer-next-002` passou com saída 0. A resposta 503 do observador deixou o recibo pendente no CMS. Outro processo do mesmo build confirmou a mesma geração após ler a resposta pública. A prova verificou o bootstrap com agregado vazio em PT/EN, o primeiro case, o redirect 308 e a retirada 410 nos dois endereços. Em 308, a versão fixada do Next pode escrever o próprio destino como corpo. O verificador aceita esse formato e o corpo vazio, ambos com o destino esperado.

Os [recibos da prova integrada](../verification/artifacts/E3-cache/publication-http-observer-report.md) registram a primeira falha, o diagnóstico do redirect, a correção e a execução seguinte. Os dois avisos de tracing do projeto inteiro desapareceram após remover a exportação de backup sem consumidores do ponto de entrada de mídia da aplicação. A prova seguinte rejeitou bytes antigos do otimizador até a mesma geração servir todas as negações. O documento 410 agora é comparado integralmente com o HTML que o proxy geraria para a raiz selecionada, incluindo o fallback técnico. O worker retomou automaticamente a mesma geração após SIGKILL. [Prova de mídia](../verification/artifacts/E3-cache/media-ack-wiring-report.md) e [recuperação do worker](../verification/artifacts/E3-cache/publication-worker-crash-report.md).

O ensaio do sitemap indexável usa um segundo Next em loopback. O XML e o cabeçalho de geração derivam da mesma raiz. Com XML antigo e o marcador atual, o recibo ficou pendente. O XML correto permitiu confirmar a mesma operação, revisão e geração. [Sitemap e política de novas tentativas](../verification/artifacts/E3-cache/e3-2-3-sitemap-retry-report.md).
