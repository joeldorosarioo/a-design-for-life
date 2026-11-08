# Re-review final escopada — W1–W3

**W1: ADDRESSED. W2: ADDRESSED. W3: ADDRESSED.**

**Ready for technical A1: Yes, quanto ao código revisado.** Não há novo achado Critical/Important/Minor acionável no diff desta onda. A CI exata do novo SHA e os demais gates pertencem ao coordenador; a aprovação A1 continua sendo explícita do usuário. **Etapa 1 permanece 87,5%; nenhuma promoção ou etapa 2 é autorizada por este relatório.**

## Escopo e proveniência

- Base: **a719cc1a4fda619aadad45576af034cdcaa7f208**.
- Target: **d4fd9fbee3dc7c189276f362df56c1b2f320ab4a**.
- Pacote obrigatório: stage1-final-fix-review-d4fd9fb.diff, **38.722 bytes**, SHA256 conferido **a9bf3218577b0b65a584bc2747a1055d8ab48a1b4c6e2f6b5b312b1e46eff51f**.
- Manifesto adjacente lido: 25 arquivos alterados. O diff textual completo, com 647 linhas, foi lido em três partes, sem tratar truncamento como leitura completa. Os extratos e o índice excluídos do texto foram lidos separadamente no target indicado.
- Lida integralmente a seção “Whole-review fix wave W1–W3 — frozen d4fd9fb” do handoff. A revisão ampla anterior delimita os achados; não reabri E1.1–E1.8 nem dependências sem relação com o fix.
- Nenhuma alteração no checkout/index/HEAD/branch. Nenhuma execução de DB, build, Next, suites, harness ou subagentes. Somente este relatório foi escrito no workspace do chat. Os comandos de leitura em E: foram limitados ao índice e aos 11 pares de evidências da onda.

## Forças da correção

- W1 é fechado antes da seleção Native, protegendo listagem, seleção por ID e filtros. A proteção não depende apenas de apagar metadados depois de ler um corpo nem de reescrever versões antigas.
- A premarcação false acontece antes da gravação da versão Native, enquanto drafts privados conservam o estado canônico e editores autenticados mantêm sua seleção de drafts.
- W2 mantém o DTO exclusivamente na geração confirmada. A consulta SQL adicional conta uma condição técnica para classificar ausência; não busca o corpo editorial pendente nem concede mídia.
- Os testes usam Native Request/Response, sessão real, adapter oficial, PostgreSQL e falhas físicas de filesystem. Preservam controles autenticados, recuperação, geração anterior e estado legado persistido.
- A evidência distingue RED comportamental de erros de preparação e do timeout de runner, sem limpar o histórico de falhas.

## Fechamento dos achados

### W1 / P1 — ADDRESSED

**Implementação:** [publication-fields.ts:68](E:/a-design-for-life/src/helpers/payload/publication-fields.ts:68) normaliza draft para false em operação read anônima, antes dos hooks/queries Native, quando não há overrideAccess nem contexto local confiável. O filtro publicConfirmed passa a ser aplicado ao head atual. Isso impede que uma versão latest com marcador true herdado satisfaça sozinha a consulta pública. A mesma composição cobre as três collections versionadas.

Em [publication-fields.ts:111](E:/a-design-for-life/src/helpers/payload/publication-fields.ts:111), uma nova publicação recebe publicConfirmed=false antes de o Native salvar sua versão. Escritas privadas continuam preservando o marcador do head, e a seleção autenticada não é normalizada. Não houve alteração de leases, CAS, intenção transacional, grants ou protocolo raiz→ACK.

**Prova revisada:** [publication-native-boundaries.integration.test.ts:95](E:/a-design-for-life/src/config/publication-native-boundaries.integration.test.ts:95) parametriza Case, Perfil e Navegação. Cada cenário confirma a primeira publicação, segura o escritor público real, executa o PATCH Native seguinte, exige recibo pending e deixa o alvo com um marcador exclusivo. GET anônimo com draft=true deve retornar lista vazia/total zero e ID404, inclusive com where/sort; count mantém zero. O GET com cookie e Origin reais continua200 e contém o alvo (linha166). A raiz e os três DTOs permanecem iguais à geração anterior.

O teste persiste explicitamente publicConfirmed=true na última versão usando db.updateVersion do adapter oficial (linhas200–210), confirma sua persistência e repete as consultas anônimas. Elas continuam fechadas, enquanto o editor ainda lê o alvo. Essa fixture representa estado pré-fix já persistido; não é uma migração ou query simulada. Ao liberar o escritor, o retry confirma e a repetição preserva a geração (linhas222–225).

**Evidência de execução lida:** native-red3 registra três falhas W1 reais, com controles autenticados corrigidos; native-green2 registra sete testes aprovados no conjunto W1/W2. O primeiro red tinha argumentos invertidos e um controle posterior carecia de Origin: não os considero prova independente de W1. A cadeia causal da exposição está removida e o cenário original tem prova Native correspondente.

### W2 / P2 — ADDRESSED

**Implementação:** os handlers de [professional-profiles.ts:42](E:/a-design-for-life/src/features/professional-profile/content/collections/professional-profiles.ts:42) e [site-navigation.ts:39](E:/a-design-for-life/src/features/site-navigation/content/collections/site-navigation.ts:39) delegam a [published-read-response.ts:7](E:/a-design-for-life/src/helpers/payload/published-read-response.ts:7).

Para Result unavailable, o helper começa em503 e usa request independente para contar documentos do locale com latestPublicationIntent existente. Zero, em origem saudável, comprova ausência/never-public e permite404. Intenção existente ou erro de classificação conserva503. A classificação é conservadora porque uma intenção ainda pending pode ter atravessado o commit da raiz antes de um ACK falho. Documentos estruturais publicados não são excluíveis pelos caminhos do produto, premissa preservada pelo fix.

Não há consulta SQL quando o DTO confirmado está disponível; o corpo retornado continua sendo o Result recebido do leitor da raiz. As respostas do helper têm Cache-Control:no-store. Locale inválido conserva404 no handler. O catch não transforma falha da origem em prova de ausência.

**Prova revisada:** [publication-native-boundaries.integration.test.ts:228](E:/a-design-for-life/src/config/publication-native-boundaries.integration.test.ts:228) cobre raiz ausente, JSON inválido, diretório no caminho current.json (EISDIR) e remoção da dependência Perfil. Os dois endpoints publicados PT precisam responder503/no-store e não conter os marcadores de corpos pendentes. Controles EN ausente e draft nunca publicado permanecem404; locale inválido também404. O finally restaura o arquivo real, seguido de200 e igualdade integral com os DTOs anteriores (linhas295–307).

**Evidência de execução lida:** native-red2 registra as quatro falhas W2, antes404/sem no-store; native-green2 registra a aprovação dos sete cenários. Trata-se de Native handleEndpoints com Request/Response e PostgreSQL reais; não descrevo essa injeção física como um teste de socket Next. A suíte Next de25E2E é uma evidência separada.

### W3 / P3 — ADDRESSED

O diff registra dois renames com similaridade100%: implementação e teste de suggestSlug passaram de cases/lib para cases/helpers. [slug-suggestion.tsx:3](E:/a-design-for-life/src/features/cases/components/slug-suggestion.tsx:3) e [server/suggest-slug.ts:1](E:/a-design-for-life/src/features/cases/server/suggest-slug.ts:1) apontam ao novo destino. Assim, os consumidores identificados na revisão ampla seguem a convenção explícita helpers, nunca lib.

O extrato slug-green registra três testes em dois arquivos aprovados, incluindo o consumidor de UI. O rename não mudou o algoritmo; não há alegação artificial de RED funcional para uma movimentação estrutural.

## Novos achados e dívidas preservadas

- **Critical:** nenhum novo achado demonstrado no diff.
- **Important:** nenhum novo achado demonstrado no diff.
- **Minor:** nenhum novo achado acionável provocado pela onda.
- **I4 permanece deferred:** attempts não conta todas as falhas revertidas; não é auditoria completa de retries. O fix não o alterou nem introduziu uso decisório desse contador.
- **I5 permanece deferred:** quatro warnings de lint históricos, depreciação de pg client.query com origem não localizada e aviso NO_COLOR/FORCE_COLOR. Não houve supressão nem prova de compatibilidade futura com pg9.
- Riscos herdados e limites operacionais/FS+SQL/multi-host/power-loss Windows/upgrade do adapter permanecem os da revisão ampla e de A1. Esta revisão não os reclassifica como resolvidos.

## Evidências conferidas e limites

Li o índice do target, cujo SHA256 registrado no manifesto é **32eb62f7c52aa912ab9f30b6974b818b0a4e94e8773055e42522f82b560dce28**. Recalculei os hashes dos **11 pares original/exportado** da onda: todos correspondem ao índice. Li integralmente os 11 extratos saneados. Hashes verificam integridade/proveniência; não substituem o exame dos testes nem significam que reexecutei os comandos.

| Extrato whole-review | Resultado registrado |
| --- | --- |
| native-red / native-green | Falhas de preparação separadas: argumentos do wrapper / Origin do controle autenticado. Não são novos REDs de produto. |
| native-red2 | W2: quatro falhas físicas reais com404/sem no-store; prova W1 parcial, supersedida por red3. |
| native-red3 | W1: três falhas de exposição Native, incluindo marcador legado; W2 já com quatro passes. |
| native-green2 | 7/7 aprovados. |
| focused-green | 53 testes/6 arquivos, exit0; inclui W1/W2 e regressões anteriores de recibos, falhas, rota/geração e COMMIT. |
| slug-green / typecheck | 3 testes/2 arquivos, exit0; tipagem exit0. |
| verify | 461pass/1fail/1skip. Primeiro teste de arquitetura excedeu timeout5000ms, observado6750ms; não houve falha de asserção de regra. |
| verify2 | Repetição integral sem mudar fonte/regra/timeout:462pass/74arquivos+1skip Linux no Windows, exit0, incluindo checks e build. |
| e2e | 25 jornadas Next/CMS, exit0. |

O timeout inicial é um limite observado do runner, não um RED de produção. Não atribuo sua causa a carga da máquina sem prova nem afirmo ausência de recorrência. O diff não modifica arquitetura.test.ts, sua regra ou timeout para obter o segundo resultado.

Não executei as suites, não li integralmente os logs brutos nem revalidei os27PNGs; o handoff registra preservação byte a byte e não reivindica mudança visual. Esta re-review não reabre o upgrade legacy completo nem realiza auditoria de dependências.

**Gate externo ainda necessário:** a CI de a719cc1 (456+25) não certifica d4fd9fb. A CI Linux exata do target, incluindo o teste SIGSTOP, permanece sob execução/avaliação do coordenador. Nenhum resultado dessa CI é presumido aqui.

## Assessment

**W1/W2/W3: ADDRESSED. SPEC da onda: compliant. QUALITY da onda: Approved. Ready for technical A1: Yes, no âmbito desta revisão de código.** As correções eliminam as cadeias causais identificadas, conservam as fronteiras de confiança e trazem provas reais específicas sem mudar o protocolo central.

O coordenador deve concluir os gates do novo SHA antes de promoção e entrega final de A1. **A1 continua pendente de aprovação explícita do usuário; etapa1 permanece87,5%; parar antes da etapa2.**
