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
