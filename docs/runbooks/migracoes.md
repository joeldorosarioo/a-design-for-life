# Migração controlada

O ensaio local usa o Payload 3.92.1 e o PostgreSQL 17.11 em um banco descartável adquirido pelo runner da porta 55434. O módulo `ops/migrations/controlled.ts` aceita somente esse alvo e a migração aditiva `20261104_012603_publication_retry_metadata`. O teste inicia com as 15 migrações de `60314d2` e conserva os campos anteriores.

## Executar o ensaio local

Use o Node 24.22.2 fixado no repositório. Aponte `ADFL_TEST_BACKUP_TOOLS_CONFIG` para a configuração privada do runner sintético com os binários validados de age e tar. Confirme que a porta 55434 está livre para a aquisição exclusiva.

```powershell
$node = '.\.toolchain\node-v24.22.2-win-x64\node.exe'
& $node node_modules/vitest/vitest.mjs run --project unit ops/migrations/controlled.test.ts
& $node node_modules/vitest/vitest.mjs run --project integration src/config/controlled-migration.integration.test.ts
```

O teste verifica a recusa de concorrência, a rejeição de históricos inválidos e o backup anterior ao `up`. O repositório local relê o conjunto criptografado antes de devolver seu marcador. Uma falha de dump mantém o catálogo com 15 registros. Uma segunda execução depois da migração devolve `already-current`. A recuperação técnica recria o estado anterior em um segundo banco UUID e verifica a raiz pública, o usuário e o catálogo.

Os comandos, resultados e limites da prova estão no [relatório do ensaio](../verification/artifacts/E3-operations/migration-local-report.md).

## Condições da execução em homologação

A etapa operacional precisa de um job separado da inicialização do servidor, com exclusão compartilhada entre executores, destino previamente identificado, janela de suspensão de escritores e confirmação do backup remoto. Um segundo job deve falhar antes de alterar banco ou arquivos. O ensaio Linux confirmou a exclusão por inode em dois contêineres locais. A composição desse lock no job e a prova com a imagem anterior ainda estão abertas.

Registre o digest da imagem em serviço, o catálogo atual, a identidade do alvo e o marcador do backup verificado antes de qualquer promoção. Habilite as tentativas automáticas somente após a migração confirmada e a verificação de saúde. Se o catálogo divergir do predecessor revisado ou o backup falhar, mantenha a aplicação na versão corrente e investigue a divergência. Uma migração destrutiva exige autorização explícita e um procedimento de recuperação preparado.
