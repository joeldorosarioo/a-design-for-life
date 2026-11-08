# Job Linux de backup e migração

O job foi executado em 04/11/2026 na imagem local imutável `sha256:734df47a9bb63fe400cdcb4be0c689c25eb8d6dedd2ec9bba2aec20d1583a949`. Usa Node 24.22.2, pnpm 12.10.1, pg_dump 17.11, age 1.3.2 e GNU tar 1.35 sob UID 10001. O runner criou PostgreSQL 17.11 descartável em loopback interno 25434, sem portas publicadas e sem rota externa. O job recebeu o recipient público. O contêiner de recuperação recebeu a identidade privada sintética separadamente pela entrada padrão.

- O catálogo inicial foi reconstruído com as 15 migrações da revisão `60314d2`. O job independente `migrate` criou e releu um conjunto completo, aplicou a migração aditiva e levou o catálogo a 16. A repetição devolveu `already-current`. O comando `backup` criou um segundo conjunto.
- Um concorrente com o advisory lock de sessão fez o job recusar a migração, preservando o catálogo com 15 registros. Outro concorrente manteve o lock usado na transação de DDL. A imagem anterior 003 aplicou DDL nesse segundo caso e chegou indevidamente a 16 no ensaio RED. A imagem 004 encerrou com saída 1 e manteve 15.
- A restauração em outro PostgreSQL 17.11 usou o ciphertext relido e `pg_restore --single-transaction`. O banco restaurado ficou com 15 migrações e o banco de origem conservou 16. O primeiro comando auxiliar do ensaio de restauração falhou porque o age exige o caminho de entrada após as flags. A execução corrigida passou com o mesmo ID de imagem. Os contêineres e volumes descartáveis foram removidos.
- Passaram 39 testes focados em quatro arquivos. Tipagem, lint do escopo e formatação passaram.

Esta prova cobre o job Linux, ferramentas, concorrência, backup e restauração do catálogo sintético. O agendamento semanal, o bucket privado R2 real, a retenção e a restauração em bucket isolado ainda dependem da homologação. A [prova anterior de recuperação de aplicação](../E3-backup/encrypted-native-events-1a557ee1-e967-410a-930d-66f8be47abab.jsonl) cobre PT/EN, arquivos, sessão e recuperação de senha no destino local.

[Recibos técnicos](linux-operational-job-proof.json)
