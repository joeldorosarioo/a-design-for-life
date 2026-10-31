# E2.5 — pré-requisitos de identidade e aviso implementados

30/10/2026. Etapa2: **16,7% (1/6; E2.1 concluída)**. Este recorte implementa somente os pré-requisitos autorizados após o desenho em `E2-reading-implementation-plan.md`. Nenhum controlador/Provider/toggle/toast de leitura, resolvedor contextual, página, estilo, configuração, dependência, lockfile, Git, Next ou build foi criado/alterado por este agente. E2.5 permanece aberta: a primeira implementação da UI depende do E2E RED real nas páginas liberadas pelo coordenador.

## Perfil profissional

`stable-profile-reading-keys.ts` é um hook próprio da feature, registrado antes da validação de publicação. Percorre trajetória e métodos, reaproveita a chave anterior pela identidade Native da linha dentro de seu grupo, gera UUID para chave omitida e recusa troca de uma chave estabelecida ou repetição dentro do Perfil. A geração também funciona em linhas incompletas de draft; não exige texto publicável no rascunho. Uma linha nova da tradução pode copiar explicitamente uma chave correspondente. Não compara títulos, não usa índice como identidade e não obriga os dois idiomas a terem a mesma estrutura.

O guard de publicação passa a exigir UUID válido e único nas linhas dos dois grupos. O hook precede o guard, portanto publicações Native de linhas ainda sem chave recebem a identidade no servidor. DTOs/leitura de snapshots antigos continuam nullable; nenhum Root, versão histórica ou migração antiga foi reescrito. O fix não precisa de coluna nova: os campos text já existiam.

## Mensagem de equivalência parcial

Navegação recebeu `messages.readingPositionAdjusted`, texto simples opcional no draft, preservado pelo mapper/DTO existente. O guard genérico de nova publicação exige revisão desse campo como dos outros estados públicos. Nav confirmado antigo sem o campo continua legível.

A função pura privada `language-switcher/helpers/reading-position-message.ts` prioriza o texto editorial não vazio recebido do **Nav de destino** e, na ausência legada, usa o fallback técnico aprovado pelo coordenador:

- PT: “Este trecho não tem equivalente neste idioma. A leitura foi reposicionada.”
- EN: “This passage has no equivalent in this language. The reading position was adjusted.”

Ela não grava o fallback no CMS e não cria conteúdo profissional. Não contém UI, provider, estado de leitura ou I/O. `translationUnavailable` permanece separado para case inteiro sem tradução pública; não é reinterpretado como aviso de trecho ausente. O novo campo não introduziu defaults mutáveis/arrays compartilhados.

## Geração Native e migração

Com Node portátil24.22.2 e Payload3.92.1 instalados, ambiente sintético APP_ENV=test e banco de testes loopback55433/adfl_test_base, foram executados os CLIs Native:

```text
node --conditions=react-server node_modules/payload/bin.js generate:types
node --conditions=react-server node_modules/payload/bin.js migrate:create e2_reading_position_adjusted
```

Ambos exit0. Native gerou `src/payload-types.ts`, `src/migrations/20261030_201024_e2_reading_position_adjusted.{ts,json}` e o registro em index. Foram removidos somente parâmetros gerados não usados (`payload,req`) das assinaturas up/down e aplicada formatação; SQL/snapshot não foram construídos manualmente.

UP contém exatamente:

```sql
ALTER TABLE "site_navigation" ADD COLUMN "messages_reading_position_adjusted" varchar;
ALTER TABLE "_site_navigation_v" ADD COLUMN "version_messages_reading_position_adjusted" varchar;
```

Ambas nullable, sem default. DOWN remove somente essas duas colunas. A comparação recursiva do snapshot novo com `20261030_190345_e2_editorial_presentation_fields.json` encontrou apenas as duas colunas `{type:varchar,notNull:false,primaryKey:false}` e o ID gerado do snapshot. Não houve alteração de tabela/índice/coluna alheia, histórico ou spec. A aplicação de UP ocorreu pelo runner Native real; não executei roundtrip DOWN/UP separado.

## TDD e verificações observadas

| Evidência em work/stage2-briefs | Resultado |
| --- | --- |
| E2-reading-prerequisites-unit-red.log | 4 arquivos;14 falhas/4 passes: hook baseline não gera/preserva/recusa chaves, guard não exige chave, schema estrito rejeita novo campo, fallback baseline vazio |
| E2-reading-prerequisites-native-red.log | RED executado pelo coordenador antes da integração:2 arquivos,4/4 falharam; geraçãoUUID ausente, troca de chave aceita, novo campo rejeitado como desconhecido, publicação sem novo aviso aceita |
| E2-reading-prerequisites-unregistered-unit-green.log | Tentativa intermediária:3 falhas/7 passes; a implementação já rejeitava, mas os testes esperavam o texto detalhado em Error.message; Payload o fornece em data.errors |
| E2-reading-prerequisites-unregistered-unit-green-final.log | Depois de usar a API real estruturada de ValidationError:2 arquivos,10/10 |
| E2-reading-prerequisites-unit-green.log | 4 arquivos,18/18 após integrar schema/guard |
| E2-reading-prerequisites-native-green.log | 6 arquivos,22/22,13 migrações Native aplicadas; container próprio removido pelo runner |
| E2-reading-prerequisites-related-unit-green.log | 20 arquivos,163/163 em Profile, Navigation e Language |
| E2-reading-prerequisites-typecheck.log | Primeiro check isolado exit2: duas tipagens no teste do hook (originalDoc parcial e callback any) |
| E2-reading-prerequisites-typecheck-final.log | Depois de corrigir somente as anotações da fixture/teste: exit0, sem saída |
| E2-reading-prerequisites-hook-green-final.log | 7/7 após a correção de tipo do teste |
| E2-reading-prerequisites-lint.log + lint-final.log | Arquivos próprios e migração exit0; teste alterado conferido novamente exit0 |
| E2-reading-prerequisites-format-final.log | exit0, arquivos próprios formatados |
| E2-reading-prerequisites-schema-diff.log | exit0; só2 colunas nullable e ID Native do snapshot |

O erro de parse Zod no RED é o comportamento real esperado ao submeter o novo campo antes de sua implementação, não uma falha de import/setup. O RED Native original foi copiado de `.work/E2-reading-prerequisites-native-red.txt` do coordenador; ele observou os quatro comportamentos antes de liberar a integração. Os asserts de rejeição foram ajustados para o shape público real `status400/data.errors[path,message]`; o contrato de rejeitar permaneceu igual. As falhas intermediárias foram preservadas, não contadas como GREEN.

Comando Native GREEN autorizado:

```text
node node_modules/vitest/vitest.mjs run --project integration src/features/professional-profile/content/stable-profile-reading-keys.integration.test.ts src/features/site-navigation/content/reading-position-message.integration.test.ts src/features/professional-profile/content/validate-publication.integration.test.ts src/features/professional-profile/content/collections/professional-profiles.integration.test.ts src/features/site-navigation/content/collections/site-navigation.integration.test.ts src/config/capture-legacy-publications.integration.test.ts
```

Novos casos Native demonstram chaves geradas em draft, renomeação/reordenação preservando UUID, rejeição de alteração/duplicação, cópia explícita entre idiomas, texto do aviso persistido em current+versão sem alterar outro idioma e recusa de publicação nova sem aviso revisado. Regressões relacionadas cobrem publicação de Perfil, coleções estruturais e captura legada. A prova histórica old0fa separada anterior não foi repetida por este recorte; não atribuir sua cobertura automaticamente à migração nova.

## Ambiente e liberação

O coordenador concedeu janela exclusiva55433 antes do GREEN Native/CLI; nenhum outro lifecycle foi executado simultaneamente por este agente. O runner selecionou somente `postgres-test` do compose do app, com tmpfs e banco sintético, e o removeu no encerramento. A conferência final com permissão de execução confirmou zero containers com os labels desse serviço e zero listeners55433; a janela foi liberada explicitamente ao coordenador. Não houve comando de ciclo de vida de5432/55432, limpeza global Docker, dados reais ou produção. Uma consulta inicial Docker sem elevação recebeu permission denied antes do runner; a verificação efetiva e o lifecycle autorizados usaram a permissão correta.

Não executei suíte global/arquitetura/build/HTTP/browser. A tipagem usa o config isolado `E2-reading-prerequisites-tsconfig.json`; não é o gate global. O snapshot está congelado para a integração do coordenador; logs anteriores de729 testes/build/33 jornadas continuam históricos. Identidades estáveis não resolvem sozinhas trechos sem correspondência: aplicar a decisão aprovada de ancestral explícito/topo+aviso exige o controlador e as jornadas E2.5 ainda pendentes.

## Fontes congeladas

`E2-reading-prerequisites-source-hashes.json` identifica os16 arquivos próprios: hook e testes de Perfil, guard/teste/registro, schema+teste e campo+teste Native de Navegação, helper+teste de aviso, tipos Native e nova migraçãoTS/JSON/index. O manifesto foi gerado depois de todos os checks e não inclui mudanças de outros agentes. Nenhuma nova alteração de app será feita por este agente após o aviso de freeze sem nova coordenação.

E2.5 e A2 permanecem em andamento. O plano `E2-reading-implementation-plan.md` continua a referência da UI futura, com primeiro E2E RED real antes da implementação.
