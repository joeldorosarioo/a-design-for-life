# Backup e recuperação por transporte R2 em loopback

`runBackup` aceita o escritor R2 registrado e compara a identidade real fornecida pelo fence da mídia com o endpoint canônico e o bucket de origem vinculados ao escritor. Divergência impede captura e qualquer requisição ao bucket de backup. O transporte usado para ler os objetos é o mesmo que foi validado. O caminho FS mantém seu contrato de retorno e sua retenção. O retorno R2 inclui `retention: 'disabled'` e `removedBackupIds: []`.

O escritor usa gravações exclusivas sob `namespace.json` e `sets/<uuid>/`. O manifesto em texto fica dentro do arquivo criptografado. A conclusão exige baixar integralmente o ciphertext e verificar tamanho e SHA-256, validar o manifesto e, depois de publicar o marcador, reler o marcador. Resposta perdida ou leitura divergente impede o recibo de sucesso. A colisão não substitui o objeto existente.

`restoreBackup` aceita o leitor R2 registrado, fixa o leitor e o ID antes da primeira espera e mantém a validação do alvo local isolado. O leitor tem entrada de credenciais própria e executa somente GET. Ele publica a cópia privada somente após verificar o conjunto completo. A prova composta descriptografou com age real, validou o arquivo, conferiu a mídia sob a chave original e conferiu a raiz pública no destino local. O limite de PostgreSQL usou callbacks sintéticos de catálogo e processo. O teste não abriu conexão com PostgreSQL.

## Evidência atual

Ambiente Windows, Node 24.22.2, pnpm 12.10.1, AWS SDK S3 3.1161.0, Vitest 5.0.5, age 1.3.2 e bsdtar 3.8.9. A prova usou dois buckets sintéticos separados no mesmo servidor HTTP efêmero em `127.0.0.1` e identificadores de credencial sintéticos distintos para origem, gravação e recuperação. O SDK fez requisições S3 assinadas ao fixture. O arquivo de configuração de ferramentas foi fornecido por `ADFL_TEST_BACKUP_TOOLS_CONFIG` e permaneceu privado.

| Recibo | Resultado |
| --- | --- |
| `r2-backup-transport-red-green.txt` | RED inicial 1/1 por gravação ausente. GREEN 1/1. RED da recuperação 3 falhas esperadas. GREEN 4/4. RED de mutação de manifesto e relógio 1 falha e 9 aprovações. O GREEN unitário intermediário registrou 126 aprovações e 14 testes que exigiam configuração de age/tar pulados. |
| `r2-backup-wiring-red-green.txt` | RED inicial da composição 3 falhas e 11 aprovações. GREEN 14/14. RED de substituição de origem e de bucket 2 falhas e 13 aprovações. RED de substituição de leitor 1 falha e 14 aprovações. GREEN final 145/145 em 11 arquivos de teste, sem pulos, com configuração real de age/tar. |
| `r2-backup-wiring-static.txt` | Tipagem focada sem incremento, ESLint e Prettier com saída 0. `git diff --check -- ops/backup` sem ocorrências. |

O comando final foi executado na raiz do projeto com o caminho privado de ferramentas no ambiente.

```powershell
$node = '.\.toolchain\node-v24.22.2-win-x64\node.exe'
& $node 'node_modules\vitest\vitest.mjs' run --project unit 'ops/backup' --reporter=dot
```

A configuração da tipagem focada estende o `tsconfig.json` do projeto, desativa incremento, carrega `node` a partir de `node_modules/@types` e inclui os dois arquivos `ops/backup/r2-repository*.ts` e seus imports. A primeira tentativa dessa tipagem saiu com 2 por falta de `typeRoots` na configuração externa e por uma interface de logger incompleta. Ambos foram corrigidos antes da tipagem focada final.

| Arquivo da composição final | SHA-256 |
| --- | --- |
| `ops/backup/r2-repository.ts` | `a94d7392e0c3c5d9af00e11f6575aec3db0f65ef8a0e578c76cf98eaf213948e` |
| `ops/backup/r2-repository.test.ts` | `ff8524dfc9761e9196f3477c043cca386b2916d5f77a0896c42ff7fe9417f335` |
| `ops/backup/repository.ts` | `1b417932cebe181f2a078352009570c098bef51fba67c7fd0811607c6a7596ec` |
| `ops/backup/run.ts` | `cf0b0e2281f467bae232ea955921c591aa9468e468c887390e727b4d11b5b96b` |
| `ops/backup/restore.ts` | `8075f0166e00c3fe3ac410fd6c6dc08b468131377be30dd8f3ea5e94539e4f33` |

Continuam pendentes as provas no provedor R2, o provisionamento e a separação das credenciais reais, a retenção remota e o agendamento operacional, e a restauração completa com PostgreSQL real e bucket de destino isolado. Esta execução não acessou conta, bucket, credencial ou serviço externo.
