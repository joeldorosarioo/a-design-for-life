# Snapshot privado para transporte ao render

Etapa 2 em andamento: **0% (0/6 tarefas concluídas)**. Este helper não integra Proxy, páginas ou metadata e não modifica o protocolo de publicação confirmado em A1.

`current.json` continua sendo a única autoridade para selecionar a geração pública de uma nova requisição. O chamador captura essa raiz uma vez e pode fixá-la com `pinPublicRoot(directory, root)`. O resultado `{ generation, sha256 }` permite que outro grafo/processo carregue exatamente a mesma raiz com `readPinnedPublicRoot(directory, pin)`, inclusive depois de uma publicação substituir `current.json`.

Os helpers não consultam `current.json`, CMS ou banco; não escolhem uma geração antiga como fallback. Só recebem uma raiz já capturada ou um pin emitido pelo chamador confiável. O chamador ainda precisa garantir a origem confirmada da raiz, descartar seletores enviados pelo visitante, autenticar o contexto de transporte e encaminhar o mesmo contexto a status, conteúdo e metadata. Um digest detecta mudança de bytes; não autentica o chamador.

## Interface e persistência

```ts
pinPublicRoot(directory: string, root: PublicRoot): Promise<PublicRootPin>
readPinnedPublicRoot(directory: string, pin: PublicRootPin): Promise<PublicRoot>
// PublicRootPin = { generation: string; sha256: string }
```

O schema estrito de raiz é o mesmo de `public-root.ts`; não há um segundo contrato divergente. O pin exige UUID canônico em minúsculas, SHA256 hexadecimal em minúsculas e nenhum campo adicional. A raiz é validada e serializada antes da primeira operação assíncrona; o digest identifica esses bytes serializados. A ordem de propriedades dos objetos JSON integra essa identidade de bytes: conteúdos semanticamente equivalentes com serialização diferente não podem reutilizar silenciosamente a mesma geração.

O arquivo privado fica em `<directory>/render-snapshots/<generation>.json`. O diretório é criado com modo0700 e o temporário com modo0600, conforme o suporte do sistema; no Windows isso não equivale a uma garantia de ACL POSIX. O diretório deve estar no volume privado de publicação, controlado exclusivamente por processos confiáveis. O helper valida chaves de arquivo, mas não promete proteger contra um administrador/processo que possa adulterar esse diretório ou seus links.

Quando a geração já existe, o helper valida digest/schema/geração e reutiliza o arquivo sem substituí-lo. Caso contrário, cria um temporário próprio com `wx`, escreve, sincroniza e fecha os bytes. Um hard link no mesmo diretório torna o arquivo completo visível no nome definitivo, sem sobrescrever o vencedor de outro processo. `EEXIST` só é aceito depois de validar que o vencedor contém os mesmos bytes. Outro conteúdo para a mesma geração é erro; não há atualização do arquivo existente.

O temporário criado pela operação é removido em `finally`, inclusive na disputa de candidatos. Um temporário que a operação não conseguiu criar não é removido por ela. Linux também sincroniza o diretório depois de criar o link; no Windows não se afirma durabilidade contra perda de energia. O filesystem deve suportar hard links no volume usado (NTFS/Linux local); não existe fallback para uma gravação parcial diretamente no nome definitivo.

## Falhas e retenção

Arquivo ausente, corrupção, digest divergente, geração divergente, schema inválido, colisão de conteúdo e erro de armazenamento são propagados. Não se tenta recuperar a raiz do CMS, de outro snapshot ou de `current.json`. Se o link foi criado e a sincronização/limpeza posterior falhou, a chamada pode falhar deixando um snapshot completo reutilizável; o retry valida esse arquivo. Uma queda de processo pode deixar temporários, além dos snapshots completos. Não há coletor automático.

**DEBT-RENDER-SNAPSHOT-RETENTION:** a retenção local é de um arquivo por geração efetivamente fixada durante leituras, sem TTL ou GC automático. O helper não arquiva cada publicação: uma geração nunca fixada pode desaparecer quando `current.json` avançar. O custo cresce com o número de gerações lidas e o tamanho da raiz. Antes da etapa3 é necessário definir orçamento/observabilidade e uma política operacional de limpeza que não exclua snapshots ainda necessários por renders/processos pausados. Essa retenção local não é uma política completa de produção; temporários abandonados também precisam ser considerados.

O transporte privado não restaura concessões públicas de mídia nem muda a seleção de uma nova requisição. O pin não deve ser exposto como endpoint público, cookie ou seletor de geração aceito do cliente. O protocolo de publicação, coordenador, guards de acesso e rotas continuam inalterados.

## Evidência e limites

Os testes adjacentes usam filesystem real. Cobrem raizA selecionada pelo leitor/escritor existente, pinA, promoção real do arquivo current paraB e leitura deA pelo pin enquanto a próxima seleção continuaB; idempotência; colisões; integridade; validação; ausência sem fallback; e criação concorrente por quatro processos Node independentes. Há também disputa de dois corpos pela mesma geração, sem sobrescrita nem temporários remanescentes. O teste de modos POSIX é ignorado no Windows.

Esses testes não simulam nem comprovam publicação Native/PostgreSQL, integração Proxy/RSC, assinatura de contexto, metadata, tratamento de falha tardia após escolha de status, tolerância a queda de máquina ou segurança de filesystem hostil. A corrida com publicação Native e a verificação integrada pertencem à composição posterior. Não houve build/verify completo nesta entrega delimitada.
