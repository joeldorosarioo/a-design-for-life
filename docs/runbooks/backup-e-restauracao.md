# Backup e restauração — preparação local E3.6

Política aprovada: backups semanais e extras antes de migrações/atualizações, oito semanas de histórico, banco completo e arquivos necessários, criptografia age, bucket R2 privado exclusivo e credenciais próprias. Identidade privada de recuperação fica separada da VPS e do bucket. O pipeline de conjuntos criptografados e restauração isolada foi comprovado localmente. O repositório R2 passou em loopback com o SDK fixado. O job Linux de execução separada está disponível. A ativação do agendamento e a validação com o bucket de homologação continuam pendentes.

## Job Linux de backup

Construa `ops/backup/Dockerfile` a partir do commit da aplicação e registre a revisão e o ID da imagem antes de habilitar o job. O entrypoint roda com UID 10001 e usa Node 24.22.2, pnpm 12.10.1, o cliente PostgreSQL 17.11 e age 1.3.2. A imagem usa um contexto próprio que inclui código e lockfile. Guarde a identidade privada do age fora da VPS. Injete somente o recipient público em `OPS_BACKUP_RECIPIENT`.

O comando `backup` usa a raiz da mesma origem, banco e ambiente da aplicação. Mantenha `SITE_ORIGIN`, `DATABASE_URI` e `MEDIA_BUCKET` coerentes com o alvo aprovado. Na homologação, confirme o destino com `OPS_STAGING_DATABASE_TARGET` no formato `host:porta/banco` e use um identificador técnico em `OPS_BACKUP_SOURCE`. A conexão aceita parâmetros TCP explícitos e, quando aplicável, somente `sslmode` como opção da URI. Forneça `OPS_BACKUP_BUCKET`, `OPS_BACKUP_ACCESS_KEY_ID` e `OPS_BACKUP_SECRET_ACCESS_KEY` do bucket privado exclusivo pelo mecanismo de segredos do executor. Os acessos de mídia seguem a configuração R2 da aplicação. Consulte o marcador de conclusão somente após a releitura do conjunto.

Ao executar backup com a aplicação em serviço, compartilhe o namespace de rede do processo que publica e remove objetos. Monte o volume de publicação no mesmo caminho absoluto `/app/.work/publication`; o socket abstrato que protege snapshot e objetos pertence a esse namespace de rede. A exclusão entre jobs usa um advisory lock do PostgreSQL na mesma conexão dedicada por todo o backup ou migração. Confirme os dois mecanismos no executor de homologação antes de agendar o comando `backup` semanalmente. A execução extra anterior à atualização deve concluir e registrar seu marcador antes da troca de imagem. A migração `migrate` cria e verifica o seu próprio conjunto antes de executar DDL. [Migração controlada](migracoes.md).

O job comprovou a criação de dois conjuntos criptografados e a recuperação independente do catálogo anterior à migração. [Evidência do job](../verification/artifacts/E3-operations/linux-operational-job-report.md).

Em teste, o job exige banco UUID próprio, porta interna 25434 em loopback e volume descartável. O modo de homologação exige revisão Git completa e alvo declarado. Produção, tentativas automáticas, verificação pública e comandos destrutivos são recusados pelo entrypoint desta etapa.

## Guardas disponíveis

- `ops/backup/contracts.ts`: contratos Zod fechados de namespace, manifesto interno e marker externo. O manifesto contém versão da aplicação/schema, checksums de dump/raiz pública e referências imutáveis dos objetos. Deve ficar dentro do payload criptografado; o marker externo contém somente dados técnicos do conjunto.
- `verifyCompletedBackup({ marker, manifest, ciphertext, now })`: verifica estrutura, identidade e hashes/tamanho dos bytes fornecidos e emite receipt opaco em memória. O consumidor deve fornecer bytes lidos de volta do destino. Esta função não prova que o arquivo é age, que o dump está íntegro semanticamente ou que todo objeto necessário foi incluído. O pipeline real deve provar esses requisitos antes de criar o marker completo.
- `selectExpiredBackups(markers, now, { namespace, replacement })`: retorna candidatos completos estritamente anteriores a 56 dias, preservando o limite exato. Exige receipt não forjado e fresco da conclusão mais recente presente na listagem. Recusa listagem malformada, IDs duplicados, namespace estranho, datas futuras e divergência do marker verificado. Ignora conjuntos incompletos na seleção. A função seleciona candidatos. A implementação FS de `applyRetention` revalida o vínculo com a instância, o marker e os bytes antes da remoção. Não executar retenção antes de completar e verificar o novo conjunto.
- `createRestoreTargetBoundary(inspectOwnedTarget)`: composição da fronteira de ownership. `acquire(target, now)` valida destino de teste/homologação, identidades distintas, namespace da aquisição, ausência anterior, criação pelo proprietário, lease ativa, recursos vazios e observação atual. Retorna permit opaco, exclusivo daquela instância. `run(permit, now, effect)` reinspeciona antes do efeito, exige a mesma aquisição e consome o permit uma única vez, inclusive quando o efeito falha.

Os prazos internos dos receipts são guardas de frescor, não metas operacionais de propagação, RPO ou RTO: conclusão recente em até cinco minutos, receipt/permit até um minuto, observação do destino até cinco segundos, lease com duração máxima de cinco minutos. O chamador deve usar relógio atual confiável.

## Limites da integração operacional

O inspector é uma dependência privilegiada do ciclo de vida de recursos. Precisa consultar os recursos reais adquiridos, provar ausência anterior e manter a lease durante toda a restauração; nunca converter nomes enviados por usuário ou um campo `verified:true` em prova. As unidades usam observações sintéticas nesse limite e um efeito real de arquivo para demonstrar que recusas não chegam ao consumidor. A composição local abaixo liga essa guarda a um banco PostgreSQL novo e a diretórios privados exclusivos. A aquisição de destino R2 permanece pendente.

O pipeline deve capturar a raiz pública confirmada, sincronizar inventário da feature com snapshot nativo Payload/PostgreSQL e `pg_dump`, copiar/verificar todos os objetos, criptografar com age, enviar ao destino, ler de volta e criar marker completo por último. A composição local implementada usa `createLocalRestoreObjectWriter` para importar sob as chaves originais. A importação equivalente em R2 permanece pendente. Não usar `put()` normal para restaurar, pois ele gera outra chave.

A coordenação atual da publicação usa socket Unix abstrato no Linux. Um job em outro namespace de rede não compartilha o bloqueio só por montar o volume. O desenho operacional deve provar a coordenação entre processos/contêineres, sem presumir esse comportamento.

## Histórico da primeira fatia

Com Node 24.22.2 e lockfile mantido:

```powershell
pnpm exec vitest run --project unit ops/backup/retention.test.ts ops/backup/restore-target.test.ts
```

RED comportamental: 50 falhas por guardas ausentes, sem erro de importação/instalação. GREEN final: 50/50 testes. Evidências em `docs/verification/artifacts/E3-backup/guards-{red,green,green-final}-001.txt`; tipagem isolada, lint e formato possuem logs próprios com código de saída.

Não executados nesta fatia: suíte completa, Next build, Docker operacional, pg_dump/restore, age, R2, agenda semanal ou restauração de um conjunto. O primeiro comando de tipagem isolada falhou por TS5112 (o compilador instalado exige `--ignoreConfig` quando recebe arquivos); o comando corrigido passou sem mudar configuração. Nenhuma caixa E3.6 foi encerrada por esta preparação.

## Fundamentos nativos comprovados — segunda fatia

`withNativeBackupSnapshot({ payload, directory, capture }, consume)`, em `src/helpers/payload/backup-snapshot.ts`, captura a raiz confirmada sob o escritor existente, abre transação nativa Payload/PostgreSQL `REPEATABLE READ READ ONLY` e exporta o snapshot por `pg_export_snapshot()`. A função `capture` recebe request e raiz para inventário na mesma transação. O escritor é liberado depois dessa captura; a transação exportadora permanece aberta durante `consume` e é finalizada em `finally`, inclusive em falhas. Nenhuma consulta SQL paralela de conteúdo foi adicionada. O protocolo de request é restrito em memória a esse período; `requireNativeBackupSnapshot` recusa requests comuns ou já liberados.

`captureBackupMediaInventory({ req, root })` é exportada pela entrada pública de servidor da feature de mídia. Usa o adaptador nativo em páginas estáveis, inclui registros na lixeira, originais, variantes e referências da raiz confirmada. Valida manifestos e recusa identidades/referências conflitantes; não omite mídia inválida para concluir um conjunto incompleto. Não existe endpoint público de inventário.

`createLocalRestoreObjectWriter({ root, ownerId })` adquire namespace local privado novo, exclusivamente `.work/private-media/adfl-test-restore-<uuid>/adfl_test_restore_<uuid sem hífens>`. Recusa diretório existente/ligado/substituído, exige bytes/hash/tamanho corretos e publica o objeto sob sua chave original somente depois de escrever e sincronizar bytes completos. Escritas idênticas são idempotentes; divergência nunca sobrescreve. Esta capacidade é operacional e não altera o upload editorial, autorização de entrega ou `ObjectStorage.put()`. A guarda de alvo da primeira fatia foi alinhada a esses prefixos aceitos pelo ambiente de teste: RED1→GREEN51 em `restore-namespace-{red,green}-002.txt`; os recibos originais de 50 testes foram preservados.

Prova real atual:

```powershell
pnpm exec vitest run --project integration src/helpers/payload/backup-snapshot.integration.test.ts src/features/media-library/server/backup-inventory.integration.test.ts
pnpm exec vitest run --project unit src/helpers/storage/restore-object.test.ts src/features/media-library/server/backup-inventory.test.ts
```

Integração final: **4/4**, `foundations-native-green-final-007.txt`, 19,42 s. PostgreSQL `pg_dump/pg_restore 17.11` reais no runner próprio da porta 55434; base nova `adfl_test_restore_22fa29ad0c7d41cfaa43dd1d63c08b64`. Com a origem modificada para B após exportar o snapshot, o dump restaurado e o inventário mantiveram A, PT/EN, PDF na lixeira, mais de 100 registros de mídia e bytes sob as chaves originais. A parte observada de dump/restauração/cópia levou 4.633 ms; isso não é RPO/RTO nem duração de um backup criptografado completo. Read-only real rejeitou gravação com código PostgreSQL 25006; falha no consumidor liberou transação/escritor. Foram encerrados todos os pools das fixtures, removidos a base/dump temporários e o contêiner/rede próprios.

Recibos: `native-foundations-proof-312221a7-96ea-4ace-a9f7-8e86ce45fffd.jsonl` registra comandos reais, versões, stdout/stderr/status e IDs; `native-snapshot-restore-22fa29ad-0c7d-41cf-aa43-dd1d63c08b64.json` registra o resultado. Unidades atuais **23/23**, `foundations-unit-green-final-008.txt`; lint e tipagem sem emissão possuem recibos finais 008. Nenhuma dessas unidades usa PostgreSQL falso para acesso/transação/concorrência.

Falhas preservadas: RED nativo válido `foundations-native-red-005.txt` (3 falhas esperadas, 1 teste já atendido); tentativas 003/004 tiveram a assertiva principal mascarada por opção `rm --force` não suportada pelo BusyBox e não são prova RED desse caso. A limpeza foi corrigida para `-f`. GREEN005 revelou expectativas incorretas da fixture (código PostgreSQL encapsulado em `cause` e IDs gerados pelo adaptador), corrigidas sem mudar as políticas nativas. O primeiro GREEN de unidade teve uma expectativa Buffer/Uint8Array corrigida para o contrato existente. Registros de preparação de tipo/lint com falha foram mantidos, sem crédito RED.

Continuam sem prova nesta fatia: age/archive completo, login/recuperação na aplicação restaurada, restauração do estado público em servidor HTTP, importação R2, bucket privado/credenciais separadas, retenção realmente executada sobre conjuntos, suspensão coordenada de limpeza física, job Docker e agenda semanal/pré-migração, coordenação de escritor entre contêineres, suíte completa e Next build. A identidade privada age não foi criada/usada aqui. Esta preparação não encerra automaticamente caixas inteiras de E3.6.

## Conjuntos locais criptografados — terceira fatia

O pipeline local agora é executável pelas funções de servidor `runBackup` e `restoreBackup` em `ops/backup/`. Não há endpoint público operacional. O job Linux, o bucket R2 real de backup e o agendamento permanecem pendentes.

`runBackup({ namespace, repository, source, application, recipient, tools, now? })` recebe uma composição privilegiada: transporte registrado pelas factories reais e captura da feature por snapshot nativo. A origem e os destinos físicos precisam ser distintos. Um fence de retenção protege os bytes da origem durante captura, dump e cópia; as factories LOCAL/R2 aplicam o mesmo fence em `delete`. Transportes injetados ou copiados sem registro não recebem essa garantia. Reads e novos puts imutáveis continuam disponíveis. O fence usa o escritor já existente, por identidade separada de armazenamento; não há TTL, tomada de lease expirada ou promessa de lock distribuído.

O criador exige dump PostgreSQL custom, reúne objetos sob suas chaves originais, raiz confirmada e manifesto privado, valida o conjunto exato de nomes/tamanhos/hashes, produz USTAR e criptografa com age usando somente recipient público. A versão local suja é registrada como `draft-uncommitted` com fingerprint real de fonte; não é atribuída falsamente ao último commit limpo. O manifesto aceita também um SHA de commit limpo para a composição operacional apropriada.

O repositório FS possui namespace próprio em `.work/backup-sets/<hash>`. Upload e readback são streams; o marker completo é publicado exclusivamente por último, depois de verificar os bytes presentes no destino e o manifesto. O caminho normal do criador verifica antes a correspondência semântica do arquivo e executa age real. A camada técnica do repositório, isoladamente, não prova semântica de PostgreSQL/age: não tratar uma chamada manual de `complete` como aceite de recuperação. A restauração sempre verifica o conteúdo novamente.

Retenção só acontece após uma conclusão verificada da própria instância do repositório, com nova leitura do ciphertext sob fence. Só conjuntos completos estritamente anteriores a 56 dias podem ser removidos; o limite exato, recentes e incompletos são preservados. Falha de upload deixa o conjunto incompleto e não chama retenção. Não existe limpeza física de mídias editoriais adicionada por esta entrega.

`restoreBackup({ backupId, repository, identityPath, ageBinary, target, verifyRestored })` recusa produção ou alvo ambíguo antes de ferramentas. Lê o ciphertext do destino, confere integridade, descriptografa com identidade separada e valida todo o USTAR antes de extrair uma quarentena privada nova. Recusa links, travessia, duplicação, entradas extras, arquivo não referenciado e divergências de hashes/identidade. Só depois adquire o alvo da aplicação.

O provider local (`local-target.ts`) é restrito ao ambiente de teste da porta 55434 e requer um runner técnico confiável que reinspecione a aquisição original. Ele confirma ausência anterior, cria DB UUID novo, lê OID real, cria diretórios novos e deriva suas identidades reais. Mantém uma lease física durante a operação e reinspeciona OID/diretórios/emptiness antes do efeito usando o guard opaco existente. Importa chaves originais, executa `pg_restore --single-transaction --no-owner --no-acl` por stdin, instala apenas a raiz capturada no namespace calculado novo e chama a verificação de conteúdo fornecida pela feature. Não usa `--clean`, não substitui usuário e não publica outro rascunho. Cleanup só remove a aquisição nova após reinspeção; identidade diferente deixa o alvo para revisão. As callbacks de ferramentas e conteúdo pertencem à composição privilegiada do servidor, nunca a flags recebidas de uma API/CMS.

## Prova criptografada nativa atual

Com Node24.22.2/pnpm12.10.1 e fixture explícita de ferramentas de teste:

```powershell
pnpm exec vitest run --project integration src/features/media-library/server/backup-set.integration.test.ts
```

`pipeline-native-proof-024.txt`: **1/1**, exit0, 30,00 s. PostgreSQL dump/restore reais **17.11**, age **1.3.2**, bsdtar **3.8.9**. O caso comprovou snapshot A restaurado depois da alteração concorrente B na origem; PT/EN, versões, rotas, PDF na lixeira, três objetos sob as chaves originais e `current.json` foram conferidos pelo Payload e pelo transporte real. Os bytes originais permaneceram intactos. O fingerprint de fonte foi igual antes/depois: `eba5964756c5f51e0375855b07b2bef310571c215202ee95b69817c1c9d2d250`; schema `c2689541da600ceef56d5e3e423058ffbd0b662ebb54729ab92c516aeaed645b`.

Recibos completos em `encrypted-native-events-c7030397-9932-4a0c-a994-fbc38914388f.jsonl`. Conjunto `89af0cb3-683b-42f6-87ca-f46c90485c69`: 174.312 bytes, SHA-256 `85c4c55dabf24f59e0ea417edc9d46705849e49db6b6fb690fa6460497bd3005`. Tempos observados: 924 ms na criação e 14.774 ms na restauração; não são SLA/RPO/RTO. Somente ciphertext e marker técnico foram preservados em checkpoint C privado, separado da identidade. Nenhuma identidade privada foi arquivada, impressa ou incluída no repositório.

O runner, rede, DB e diretórios de restauração próprios foram removidos após a verificação; pools conhecidos encerrados sem forceexit. Não foram alterados os serviços 5432/55432/55433 ou a base visual.

Unidades atuais do escopo: `pipeline-unit-current-023.txt`, **192 passaram / 1 skip Windows de symlink já existente**, com ferramentas reais configuradas; mais **11/11** de preservação do runtime em `pipeline-runtime-regression-final-025.txt`. Esse total não é a suíte completa do projeto. O guard original da primeira fatia continua **52/52**, dentro do total. Sem a fixture externa de ferramentas, os skips explícitos de crypto não comprovam age/tar; a configuração CI é uma entrega própria.

O criador suporta somente engines/versionamentos comprovados: bsdtar3.8.9 e GNUtar1.35. A variante GNU foi comprovada em Node Linux da imagem003, sem rede/mounts/portas, com arquivo de200KB, conforme `archive-gnu-linux-f4bcac05-661a-42b7-9bd6-5cf476230fff.json`. O instalador de age 1.3.2 também passou em contêiner Linux isolado, sem rede, com teste de ida e volta e rejeição de identidade errada em `portable-tools-linux-4bed9120-df6d-4480-bc70-b1278ecee5a0.json`. Falta executar o job operacional completo.

Continuam pendentes o bucket privado R2 com credenciais próprias e readback remoto, o job Linux completo com age e coordenação de volumes, a agenda semanal e pré-migração, a restauração em bucket R2 isolado e a execução no CI remoto. E3.6.2 tem prova de recusa de alvo, retenção de recentes, readback antes da conclusão e preservação do último conjunto válido sob upload parcial. As condições acima mantêm os demais critérios E3.6 abertos.

## Repositório R2 e leitor de recuperação

O escritor usa bucket exclusivo e grava namespace, pendência, ciphertext e conclusão por operações condicionais. A chamada de conclusão consome todos os bytes baixados e verifica manifesto e SHA-256 antes do marcador, depois relê o próprio marcador. O manifesto privado permanece no conjunto criptografado. Perda do recibo de escrita deixa o resultado sem confirmação e uma tentativa duplicada preserva os bytes existentes.

`runBackup` confere a identidade do armazenamento de origem registrada na factory enquanto mantém o fence de retenção. O bucket de mídia precisa corresponder à origem admitida e ser distinto do bucket de backup. As mesmas referências registradas atendem a leitura de bytes. A saída R2 informa retenção desabilitada. A exclusão remota fica pendente até comprovar listagem, identidade física e exclusão mútua do job operacional.

`restoreBackup` aceita o leitor registrado de recuperação. O leitor verifica o namespace, o marcador e todo o ciphertext antes de preparar o arquivo privado. A descriptografia e a validação do arquivo acontecem antes de adquirir o destino PostgreSQL e de mídia isolado. A primeira prova de composição usa destino local. A importação em bucket R2 novo e a jornada HTTP de login e recuperação seguem pendentes.

As provas em loopback exercitaram o SDK S3 fixado com buckets sintéticos distintos. A última execução usou as ferramentas age e tar reais da fixture e passou 145 testes unitários sem skips. O callback PostgreSQL da prova de composição R2 é sintético. O dump e a restauração PostgreSQL reais pertencem às provas Native do pipeline local e da migração controlada. [Recibos de backup](../verification/artifacts/E3-backup/)

## Restauração HTTP em imagem local

A prova com PostgreSQL, filesystem, age e tar reais iniciou a imagem 007 sobre o alvo restaurado durante sua aquisição descartável. Verificou o conteúdo PT/EN, imagem, PDF privado, login, painel e redefinição com e-mail capturado localmente. A senha e a sessão anteriores foram revogadas e o token usado foi recusado. Backup de 848 ms, restauração de 25832 ms, incluindo 11758 ms da prova HTTP da imagem 007. Tempos observados neste ensaio sintético. A importação para bucket R2 isolado continua aberta. [Recibo](../verification/artifacts/E3-backup/encrypted-native-events-1a557ee1-e967-410a-930d-66f8be47abab.jsonl).
