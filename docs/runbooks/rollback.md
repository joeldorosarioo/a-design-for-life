# Rollback de imagem

O ensaio local iniciou a imagem 004 por ID imutável com o catálogo anterior de 15 migrações. Com a aplicação parada, o job criou e releu o backup criptografado antes de aplicar a migração aditiva. Depois iniciou a imagem 007 no mesmo banco e voltou ao mesmo ID da 004. O OID do banco permaneceu igual. O catálogo e seu SHA-256 conservaram as 16 migrações após a volta. Houve 20 verificações HTTP em cada fase. [Recibo local](../verification/artifacts/E3-operations/migration-image-rollback-6f5d6bd2-0067-4c90-8c2c-71a7f5bbcecb/run.json).

A imagem 004 já contém o arquivo da migração aditiva. No ensaio ela iniciou com tentativas automáticas desabilitadas. O catálogo de 15 entradas veio do predecessor revisado. A composição ainda não empacotou o aplicativo exato de `60314d2` para demonstrar sua volta e não executou o job no Coolify.

Para repetir na homologação, registre o digest em serviço, catálogo, origem, volumes e marcador de backup verificado. Execute a migração em janela controlada e confira prontidão, painel, sessão, conteúdo PT/EN e mídia após a troca. Em caso de rollback, volte ao digest anterior com o schema compatível e verifique o catálogo antes de liberar a operação. A recuperação de dados tem procedimento próprio no [runbook de backup e restauração](backup-e-restauracao.md).
