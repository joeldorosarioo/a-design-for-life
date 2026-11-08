# E2.2/E2.3 — campos editoriais de apresentação

Etapa 2 em **16,7% (1/6)**. E2.1 concluída; esta mudança prepara E2.2/E2.3 e não conclui outra tarefa nem A2.

Os campos existentes de Perfil receberam `approach.methods[].keywords` e `about.journeyEyebrow`, `about.approachEyebrow`, `about.inMotionEyebrow`. São textos simples opcionais, sem novos grupos, apresentações livres ou conteúdo profissional de exemplo publicado. Os DTOs/mapas preservam valores e representam ausência legada por `null`. As três identificações de Sobre e as palavras-chave continuam opcionais também na publicação do Perfil.

Navegação recebeu `controls.caseLinkLabel`, rótulo editorial da ação dos cards de case. É opcional em rascunhos. O guard genérico existente exige seu preenchimento em uma nova publicação, como exige os demais controles. Snapshots confirmados anteriores com o campo ausente/nulo continuam legíveis; a composição verifica os dados necessários à página usada. O card público de Cases agora preserva o `eyebrow` já existente no detalhe; a projeção de cards legados aceita ausência com `null`, sem criar numeração ou identidade por posição.

## Migração e compatibilidade histórica

`20261030_190345_e2_editorial_presentation_fields` foi gerada pelo CLI Native, junto com o snapshot JSON completo e os tipos. Seu `up` contém exatamente dez `ADD COLUMN varchar` nullable: rótulo de Navegação atual/versões; palavras-chave no array atual/versões; três identificações de Sobre atual/versões. Não contém SQL de Cases, alteração de índices/identidades, recriação de tabelas ou preenchimento artificial de linhas antigas. A primeira geração própria nunca aplicada foi substituída após conferir os caminhos absolutos e o ledger, para incluir os três textos adicionais autorizados; as migrações históricas permanecem intactas.

O teste real encontrou a migração histórica de coordenação lendo o schema atual antes das colunas futuras existirem. `captureLegacyPublications` passou a usar projeções Native explícitas e estáveis para grupos, arrays e blocos. A seleção canônica usa a tabela corrente pelo adaptador Native, pois o hook `afterRead` recarregava todo o schema. O `contentRevision` do corpo publicado continua sendo a revisão da intenção, preservando a semântica do hook anterior e a privacidade do draft mais recente. Chaves `undefined` emitidas pelo Native para campos não selecionados são omitidas na fronteira JSON, sem buscar valores atuais.

Somente o update do head em `enqueuePublicationUpdate`, cujo predicado era exclusivamente o ID, passou para `updateOne({ id, select: { id: true } })` na mesma transação. Isso evita o retorno de todas as colunas do schema atual durante a migração histórica. O update preserva o timestamp editorial e falha com 503 se o subject não existe. Os updates condicionais/CAS do coordenador não foram alterados.

## Evidência

- RED inicial: oito falhas/27 passes unitários; entrada rejeitava `keywords`/`caseLinkLabel` e DTOs perdiam palavras-chave/eyebrow. Native: duas falhas/nove passes pelos campos desconhecidos; uma falha separada demonstrou publicação sem rótulo sendo aceita.
- RED das identificações de Sobre: quatro falhas/16 passes, por campos desconhecidos/ausentes. GREEN posterior: 20/20.
- RED real do head: alteração indevida de `updatedAt` e subject ausente resolvendo sucesso. Após a correção, as provas de transação e falha fechada passaram.
- Verificação unitária final: **79/79, 11 arquivos, exit 0**. Integração focada final: **25/25, sete arquivos, exit 0**, incluindo o teste de captura estrutural com as dez colunas temporariamente ausentes, roundtrip da migração aditiva, preservação de versões/UUIDs e geração confirmada, além dos testes de mídia do responsável por essa mudança.
- Upgrade final real do código `0fa495864cfefcf3489856d66444b81fdf1f730e`: migrações antigas, seed Native PT/EN, migrações atuais, captura, bootstrap e verificação terminaram com exit 0. Conteúdo público, UUIDs, versões e drafts PT mais recentes foram preservados; seis operações confirmadas; dez colunas `is_nullable=YES` no PostgreSQL.
- Lint e Prettier limitados aos arquivos próprios: exit 0.

As falhas de startup CSS do trabalho concorrente, a tentativa em fixture com bootstrap pendente, os erros intermediários de projeção Native e os ajustes do verificador de relações/de revisão estão preservados nos logs. Não são apresentados como RED dos requisitos editoriais. O run de upgrade final foi repetido depois das últimas mudanças de produção.

[Logs, fontes e hashes](artifacts/E2-editorial-fields/). Node 24.22.2 portátil, pnpm 12.10.1 e PostgreSQL 17.11 real isolado em 55433/tmpfs. O container próprio foi removido; 5432 e 55432 foram preservados. Não houve instalação, build, Next, E2E, commit ou gate integral nesta unidade. O coordenador executa a validação integrada do estado combinado.
