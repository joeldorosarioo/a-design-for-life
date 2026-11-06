# Armazenamento de bytes privados

## Contrato e autorização

`ObjectStorage` é transporte de bytes. `put` captura os bytes antes da primeira espera e devolve `{ key, byteLength, sha256 }`. A chave contém 64 caracteres hexadecimais aleatórios; o SHA256 descreve o conteúdo, sem servir como endereço público. Cada novo upload recebe uma chave nova.

`get` e o alias compatível `read` devolvem bytes somente depois da verificação de tamanho e SHA256. `head` devolve uma cópia da referência íntegra ou `null` quando o objeto não existe; referência inválida, corrupção e falha de autorização/rede continuam sendo erros. Para preservar essa garantia, `head` verifica o corpo: no R2 isso custa um HEAD e um GET. `delete` verifica a referência antes de remover os bytes e é idempotente para objetos ausentes. Essa operação técnica não libera exclusão editorial: a feature de mídia continua responsável pelas autorizações, referências publicadas, lixeira e retenção.

As rotas autorizadas continuam usando `resolveMediaAccess`; o adaptador não publica URLs, não gera presigned URLs e não decide se um original é público. A política atual mantém um original por imagem, cortes por CSS e otimização pública pelo Next.Image. O transporte privado autenticado permanece na feature. Este incremento não cria derivados ou cópias de originais.

## Filesystem local

`createLocalObjectStorage(root)` exige caminho absoluto, grava com criação exclusiva (`wx`) e mantém a referência de 64 caracteres hexadecimais e as verificações de integridade existentes. A leitura conserva `O_NOFOLLOW` onde o sistema operacional oferece essa flag. Os testes usam diretórios reais e isolados sob `.work/media-storage-*`, sem substituir o filesystem por mocks.

A composição local continua aceitando `installMediaRuntime({ root, checkerBinary })`. O runtime recusa raízes sob `public`, `.next/static`, `.work/next-build/static` e o `static` do distDir de testes selecionado pelo helper central do Next. Uma capacidade injetada usa `installMediaRuntime({ storage, checkerBinary })`.

No Windows desta execução, criar symlink de arquivo retorna EPERM. O teste de não seguir symlinks fica explicitamente pulado nessa plataforma; precisa executar em Linux para compor a prova operacional. Isso não representa prova de bloqueio de symlink no Windows.

## R2/S3

`createR2ObjectStorage({ endpoint, bucket, accessKeyId, secretAccessKey })` usa somente o SDK oficial `@aws-sdk/client-s3`, versão fixada 3.1161.0. A composição de ambiente usa `MEDIA_STORAGE_DRIVER`, `MEDIA_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`. O módulo não lê `.env` nem escolhe filesystem quando a configuração remota é inválida.

O SDK usa região `auto`, credenciais explícitas, path style, tentativa única e limites de conexão/requisição de 3 s/10 s. O upload envia Content-MD5, metadado SHA256 e `If-None-Match: *`, mantendo criação imutável. A aplicação só recebe a referência após resposta bem-sucedida. Falha, desconexão ou 412 são propagadas. Um timeout após aceitação remota pode deixar um objeto órfão; não promove publicação nem apaga automaticamente bytes. Recuperação/limpeza exige processo próprio que respeite referências e retenção.

O cliente seleciona cálculo/validação de checksum do SDK `WHEN_REQUIRED`; a verificação SHA256 da aplicação continua obrigatória. As diferenças de compatibilidade do R2 não são substituídas por assinatura escrita à mão. Nenhuma ACL pública é enviada. Endpoints exigem HTTPS, com exceção de HTTP em loopback para emuladores/testes locais; a configuração de execução deve restringir o endpoint implantado ao R2 HTTPS do ambiente autorizado.

As provas locais exercitam requests/responses HTTP reais com o SDK e servidor S3 controlado em 127.0.0.1, credenciais sintéticas e portas efêmeras. Não simulam Payload/PostgreSQL nem comprovam privacidade de uma conta R2 real.

## Prova do fluxo editorial com transporte S3 local

Em 04/11/2026, o teste de [entrega pelo adaptador R2](../../src/features/media-library/server/r2-delivery.integration.test.ts) passou com Payload e PostgreSQL reais e o SDK S3 conectado a um servidor de loopback. O terceiro PUT do upload perdeu a conexão, o CMS devolveu 503 e o banco conservou a contagem de mídias. Dois objetos anteriores ficaram órfãos no servidor sintético. A repetição criou a mídia íntegra com novas chaves. A prévia autenticada entregou o original antes da publicação. A entrega anônima só disponibilizou original e derivado de 640 px após confirmação do case e voltou a 404 após retirada.

A fixture verifica a composição da aplicação e do transporte S3. A privacidade no provedor, a URL direta e as políticas do bucket permanecem para o ensaio R2 real.

```powershell
node ./node_modules/vitest/vitest.mjs run --project integration src/features/media-library/server/r2-delivery.integration.test.ts
```

### R2 no desenvolvimento

Use `MEDIA_STORAGE_DRIVER=r2` para selecionar o R2. `R2_BUCKET` escolhe o bucket remoto e tem precedência sobre `MEDIA_BUCKET`. `R2_MEDIA_PREFIX` delimita o caminho dos objetos. O adaptador adiciona o prefixo nas operações do SDK e mantém as chaves de 64 caracteres gravadas nos manifests. Defina o prefixo antes de gravar objetos, pois alterá-lo depois exige mover os bytes referenciados. O runner automatizado continua usando armazenamento local.

O ensaio de 04/11/2026 usou a aplicação local, PostgreSQL do projeto e um prefixo de desenvolvimento do R2. O reset removeu seis objetos do prefixo após cópia local. O Payload salvou uma imagem sintética e quatro derivados, confirmou o SHA-256 do original e leu a variante de 640 px via prévia autenticada. O acesso anônimo pela aplicação retornou 404. A consulta sem assinatura ao endpoint S3 retornou 400 para o original e o derivado. A configuração de domínio público do bucket, publicação e retirada no R2 real seguem com provas próprias. [Recibo do ensaio](../verification/artifacts/E3-storage/r2-development-prefix-001.json)

## Ciclo real com publicação e retirada

Em 05/11/2026, o Payload executou o ciclo completo de uma imagem sintética no R2 configurado, usando banco PostgreSQL descartável na porta 55438 e um subprefixo exclusivo. O upload criou o original e quatro derivados. A prévia autenticada respondeu 200 e a leitura anônima respondeu 404 antes da publicação. Após a confirmação editorial, original e variante de 640 px responderam 200, com SHA-256 do original conferido. A retirada confirmada devolveu 404 para ambos. Uma imagem inválida foi recusada antes de criar objetos ou registros de mídia.

Os GETs sem assinatura ao endpoint S3 responderam 400 para original e derivado. A configuração de domínios públicos e `r2.dev` ainda precisa de verificação na conta Cloudflare. Ao fim do ensaio, os cinco objetos daquele subprefixo foram removidos, a listagem ficou vazia e o contêiner PostgreSQL descartável foi encerrado e removido. [Recibo do ciclo real](../verification/artifacts/E3-storage/r2-native-publication-withdrawal-002.json)

## Pendências antes do aceite real

- Configurar bucket privado de homologação e credencial limitada ao bucket; produção e backups permanecem separados, com credenciais distintas.
- Verificar na conta autorizada que domínio público e r2.dev não expõem objetos. Testar URL direta sem credencial e as rotas públicas/de prévia autenticada com o otimizador/caches reais.
- Executar upload/publicação/remoção de referência e falhas de rede na integração da feature em homologação, sem recursos de produção.
- Planejar a transferência verificada das referências locais existentes antes de selecionar outro backend. Alterar o driver não copia objetos nem garante que manifests antigos já estejam no R2.
- Executar o caso de symlink em Linux. Concluir as verificações operacionais e de restauração correspondentes antes do aceite A3.

Nenhum bucket, conta, recurso pago, publicação ou operação R2 real foi criado por estas unidades. A integração real de E3.1 permanece aberta.

## Fontes oficiais verificadas em 03/11/2026

- [Cloudflare: SDK JavaScript v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/): cliente oficial, endpoint e região.
- [Cloudflare: compatibilidade S3](https://developers.cloudflare.com/r2/api/s3/api/): operações condicionais atômicas, Content-MD5 e diferenças de recursos.
- [AWS: integridade e checksums](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-checksums.html): cálculo automático do SDK e checksums de upload.

Evidências locais: `docs/verification/artifacts/E3-storage/`. O teste de transporte local não substitui o aceite real de R2 descrito no plano.
