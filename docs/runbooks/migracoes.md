# Migração controlada

O ensaio local usa o Payload 3.92.1 e o PostgreSQL 17.11 em um banco descartável adquirido pelo runner da porta 55434. O módulo `ops/migrations/controlled.ts` aceita somente esse alvo e a migração aditiva revisada `20261106_035830_cms_user_profile`. O predecessor contém exatamente 16 migrações; o catálogo atual contém 17, encerradas em `cms_user_profile`. O executor recusa históricos vazios, incompletos, duplicados ou divergentes e conserva os campos anteriores.

## Executar o ensaio local

Use o Node 24.22.2 fixado no repositório. Aponte `ADFL_TEST_BACKUP_TOOLS_CONFIG` para a configuração privada do runner sintético com os binários validados de age e tar. Confirme que a porta 55434 está livre para a aquisição exclusiva.

```powershell
$node = '.\.toolchain\node-v24.22.2-win-x64\node.exe'
& $node node_modules/vitest/vitest.mjs run --project unit ops/migrations/controlled.test.ts
& $node node_modules/vitest/vitest.mjs run --project integration src/config/controlled-migration.integration.test.ts
```

O teste verifica a recusa de concorrência, a rejeição de históricos inválidos e o backup anterior ao `up`. O repositório local relê o conjunto criptografado antes de devolver seu marcador. Uma falha de dump mantém o catálogo predecessor com 16 registros. Uma segunda execução depois da migração devolve `already-current`. A recuperação técnica recria o estado anterior em um segundo banco UUID e verifica a raiz pública, o usuário e o catálogo.

O [relatório do ensaio anterior](../verification/artifacts/E3-operations/migration-local-report.md) registra a transição histórica de metadados de novas tentativas. O catálogo aceito atualmente é o revisado em `ops/migrations/controlled.ts`; aquela evidência não amplia as migrações permitidas pelo executor.

## Execução explícita na mesma imagem Alpine

Use o CLI operacional incluído na mesma imagem Alpine da aplicação, conforme o [runbook de backup](backup-e-restauracao.md), para o alvo de homologação revisado. Antes de executar o comando, interrompa o processo de aplicação, workers e outros escritores, mantendo o PostgreSQL disponível durante a janela. A autorização fica somente no processo operador:

```sh
OPS_ALLOW_REVIEWED_MIGRATION=true node --conditions=react-server src/backup-runtime.mjs migrate
```

O comando é explícito e não faz parte da inicialização do servidor nem do deploy automático. O job usa um advisory lock exclusivo do PostgreSQL, confere a identidade da base e o catálogo revisado, cria e relê o backup criptografado, confirma novamente o catálogo e aplica somente o `up` aditivo revisado de `20261106_035830_cms_user_profile`, de 16 para 17 migrações. A repetição com o catálogo atual devolve `already-current`, sem DDL. A variável de autorização não permite aplicar outra migração nem alterar o catálogo aprovado.

O ensaio Linux anterior recusou concorrência nos dois níveis de exclusão, aplicou a migração então revisada após backup verificado e restaurou o catálogo anterior em outro PostgreSQL. [Evidência histórica do job](../verification/artifacts/E3-operations/linux-operational-job-report.md).

Antes de reabrir os escritores, confira o marcador, o catálogo e a versão da imagem. O executor deve preservar os volumes privados e autenticar a identidade do banco e do bucket. O rollback troca a imagem por um digest compatível e conserva o catálogo já migrado. [Procedimento de rollback](rollback.md).

## Condições da execução em homologação

A etapa operacional precisa de um job separado da inicialização do servidor, com exclusão compartilhada entre executores, destino previamente identificado, janela de suspensão de escritores e confirmação do backup remoto. Um segundo job deve falhar antes de aplicar a migração. A composição Linux usa um lock consultivo de sessão e outra exclusão na própria transação de DDL. A releitura do catálogo nessa transação preserva o predecessor esperado mesmo se a sessão externa cair. O rollback local 004 → 007 → 004 preservou o catálogo aditivo e o OID do banco. A prova com o aplicativo exato do predecessor e a execução no Coolify continuam abertas. [Prova de rollback](rollback.md).

Registre o digest da imagem em serviço, o catálogo atual, a identidade do alvo e o marcador do backup verificado antes de qualquer promoção. Habilite as tentativas automáticas somente após a migração confirmada e a verificação de saúde. Se o catálogo divergir do predecessor revisado ou o backup falhar, mantenha a aplicação na versão corrente e investigue a divergência. Uma migração destrutiva exige autorização explícita e um procedimento de recuperação preparado.
