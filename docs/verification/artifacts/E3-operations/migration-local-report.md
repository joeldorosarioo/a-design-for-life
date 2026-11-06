# Migração controlada E3.5.4 — prova local

`ops/migrations/controlled.ts` aceita o histórico nativo de 15 migrações do predecessor `60314d2` ou o histórico atual de 16. Recusa nomes desconhecidos, lacunas, duplicatas, batches inválidos e modo dev. Valida o alvo local adquirido, flags, o adaptador ainda desconectado e sua configuração antes da conexão. O único `up` permitido é `20261104_012603_publication_retry_metadata`, na transação nativa confirmada pelo próprio request do adaptador. O histórico já atual retorna `already-current` antes de criar backup. A composição chama `runBackup` diretamente, com inventário real da feature e snapshot nativo exportado. A conclusão do backup inclui o readback do ciphertext feito pelo repositório. Só depois a composição aplica o `up` e relê o histórico.

## Evidências

- `migration-ledger-red-001.txt` registrou seis falhas comportamentais esperadas. `migration-unit-final-006.txt` registrou seis testes aprovados, exit 0.
- `migration-native-red-001.txt` preserva uma falha inicial da fixture no guarda de provisionamento do Payload. `migration-native-red-002.txt` registrou o RED comportamental após as 15 migrações reais. O stub devolveu `already-current` quando deveria propagar a falha do dump.
- `migration-native-green-final-005.txt` registrou um teste nativo aprovado, exit 0, em 16,58 s. Run `6a1f6dc0-cd65-4950-a16e-2998fa22771b`. O dump que falhou preservou o histórico com 15 registros. O segundo job foi recusado durante o backup. O `up` adicionou um registro, preservou o usuário e a raiz pública e o novo job retornou `already-current`. A restauração técnica do ciphertext prévio, com age e `pg_restore --single-transaction`, recuperou os 15 registros, o mesmo usuário e a raiz num banco UUID independente. A identidade de teste, os bytes do dump e o ciphertext ficam fora deste dossiê. O identificador do conjunto é `717adc25-dcd3-453a-9d02-4c8d4f5e04f0`, SHA-256 `c273ae1c58ad51810d818707fa61ebb1d462cfc6c2372f6288da023fdb8a8e70`.
- Os manifestos `migration-native-source-before-005.json` e `migration-native-source-after-005.json` têm o mesmo SHA-256 `3f94a327b8bc3c14a5237371125cda5c946e47456550887bf0bcf388f21a4097`. `migration-native-postcheck-006.md` registra a ausência dos IDs adquiridos, da publicação Docker e da lease, e a disponibilidade comprovada pelo bind real na porta 55434. O wrapper inicial terminou com exit 1 na tabela TCP, que ainda registrava PID 0 após a limpeza. A saída do Vitest e a verificação posterior são recibos separados.
- `migration-static-final-006.txt` registrou formato, lint dos três arquivos e tipagem sem emissão, todos exit 0.

Comandos de teste executados na raiz `E:\a-design-for-life` com Node 24.22.2. A prova de integração recebeu a configuração privada já existente de ferramentas sintéticas por `ADFL_TEST_BACKUP_TOOLS_CONFIG`.

```powershell
& ./.toolchain/node-v24.22.2-win-x64/node.exe node_modules/vitest/vitest.mjs run --project unit ops/migrations/controlled.test.ts
& ./.toolchain/node-v24.22.2-win-x64/node.exe node_modules/vitest/vitest.mjs run --project integration src/config/controlled-migration.integration.test.ts
```

## Exclusão Linux separada

`migration-linux-inode-lock-001.json` é a prova experimental do `flock` 2.41.5 instalado na imagem local imutável 004. Dois contêineres UID 10001 sem rede ou portas receberam o mesmo arquivo sintético em bind somente leitura. O launcher executou `/usr/bin/flock --exclusive --nonblock --conflict-exit-code 75 --no-fork /lock node ...`. O primeiro processo Node assumiu PID 1. O concorrente saiu 75 sem executar o comando. Após `SIGKILL` no titular, exit 137, o mesmo concorrente adquiriu o mesmo dispositivo/inode e saiu 0. A verificação por IDs confirmou a remoção dos dois contêineres.

O job local em TypeScript usa o escritor do sistema operacional na sua execução de teste. A integração do inode ao entrypoint operacional, o compartilhamento do namespace do escritor de publicação, a execução em Linux com dados sintéticos e o rollback real da imagem por digest continuam pendentes. A prova de restauração deste teste cobre o banco e a raiz sintéticos. A entrega completa de E3.5.4 permanece aberta.
