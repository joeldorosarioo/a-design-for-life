# E1.8 — re-review da correção Round1

## Spec Compliance

- **I1 / P1: ADDRESSED.** Perda da segunda autenticação produz 503 explícito e não promove nem devolve sucesso Native indiferenciado.
- **I2 / P1: ADDRESSED.** Falhas das leituras preliminares ficam contidas; antes de observar intenção comitada há indisponibilidade segura, e após essa prova há recibo parcial recuperável.
- **I3 / P2: ADDRESSED.** Reserva comprovadamente pública sem cobertura do assunto produz 503; assunto coberto em geração anterior conserva a classificação daquela geração.
- **R-MEDIA: ADDRESSED.** Uso SQL confirmed sem cobertura do proprietário produz 503 sem conceder bytes; proprietário coberto com mídia revogada conserva 404 mesmo com ACK SQL falhado.
- **SPEC da rodada: compliant. QUALITY da rodada: Approved.** Nenhum achado novo Critical/Important identificado no diff da correção. Esta aprovação é estritamente escopada, não substitui revisão ampla, R1/R2/D1 ou CI exata, nem concede A1.

## Escopo e proveniência

- Base: `a78b2ddda26176bf7b93d7ab8ab1588b2023cb54`.
- Target: `a719cc1a4fda619aadad45576af034cdcaa7f208`.
- Pacote obrigatório: `e1-8-round1-review-a719cc1.diff`, 57741 bytes; SHA256 conferido: `9b69d5f59d794fbb0cf4c5f352660fca6b15efea99dec85ef35c1042cf86f592`.
- Lido o handoff da Round1, comandos/saídas e todo o pacote textual em partes, sem truncamento. A revisão anterior foi usada somente para delimitar I1–I3; R-MEDIA foi incluído conforme follow-up do root.
- A análise cobriu os cinco arquivos de produção alterados, os dez casos novos de integração, a correção da fixture e a documentação. Não reabri os demais contratos da tarefa inteira.

## Strengths e fechamento dos achados

### I1 — segunda autenticação perdida

**Implementação:** `src/helpers/payload/publication-transport.ts:84`, `:91`. A resposta reconhecida como editorial passa por um limite explícito de indisponibilidade. Usuário ausente devolve 503 com orientação para nova sessão e consulta do documento antes de repetir a gravação. Nenhum recibo é inventado a partir do envelope Native; nenhum retry é executado sem usuário.

**Prova revisada:** `src/config/publication-failure-boundaries.integration.test.ts:120` faz POST Native real, verifica 201, encerra a sessão via logout Native e confirma que `native.auth` devolve null antes de chamar o wrapper. Depois exige 503, mensagem específica, raiz anterior intacta, operação SQL pendente e recuperação com repetição sem troca adicional de geração (`recovered`, linha101). A revogação e a persistência não são simuladas.

**Conclusão:** elimina a cadeia causal de I1. O 503 não afirma que a publicação foi confirmada nem sugere repetir cegamente o save.

### I2 — leituras preliminares e retorno parcial

**Implementação:** `src/helpers/payload/publication-updates.ts:95–130`, `src/helpers/payload/publication-coordinator.ts:31–44`, `src/helpers/payload/publication-transport.ts:87–113`. A criação do request independente e a primeira leitura ficam dentro de `try`. Sem operação independentemente observada, o retry retorna `Result` unavailable, o coordenador retorna null e o transporte produz 503 seguro. Após observar a operação, o recibo pendente é construído antes de acessar raiz/dependências. Exceção posterior ou null do segundo leitor conserva esse recibo; o transporte aplica a mesma distinção.

**Provas revisadas:** no mesmo teste de integração, linha149 renomeia a tabela depois do POST comitado e verifica que transporte, Result e coordenador resolvem com seus resultados seguros, sem rejeição bruta. Linha188 provoca falha real na leitura da dependência `cases`. Linha223 usa `current.json` temporariamente substituído por diretório, provocando erro real de FS, e exige recibos pendentes tanto Native quanto Local. Linha347 deixa a primeira leitura real terminar antes de renomear a tabela, cobrindo a segunda leitura do coordenador. Linha384 deixa o COMMIT real terminar antes de retirar a disponibilidade da tabela e exige Result seguro do comando Local, além de conferir o conteúdo/intent duráveis após restaurá-la.

Os wrappers de temporização chamam e aguardam o método real antes de renomear tabelas; não retornam linhas, sucesso de COMMIT ou erros fabricados. A restauração usa `finally`; a recuperação confere idempotência e preservação da raiz anterior.

**Conclusão:** I2 está fechado sem enfraquecer a exigência de prova de COMMIT. Um save cujo primeiro read-back não pôde ocorrer não vira sucesso presumido. Uma intenção já comprovada mantém operationId, targetRevision e estado parcial quando a confirmação pública não conclui.

### I3 — rota pública sem cobertura

**Implementação:** `src/features/cases/server/resolve-case-route.ts:44–58`. A classificação SQL agora é consumida. `everPublished` só leva a 503 quando falta o assunto correspondente entre os snapshots confirmados; a existência de uma geração que cobre o assunto ainda permite negar um slug que só apareceu numa geração posterior. O código não usa SQL para reconstruir corpo ou redirecionamento público.

**Prova revisada:** `src/config/publication-failure-boundaries.integration.test.ts:270` cobre raiz ausente e raiz incompleta. Cria publicação, histórico e retirada reais; depois exige 503 para corrente/histórica/retirada sem cobertura e 404 para desconhecida e reserva privada nunca publicada. Restaura o arquivo e exige 308 para histórico, 200 com o título confirmado e 410 para retirada. O foco de 46 testes também inclui as corridas de requisição com geração anterior e os regressivos de ciclo de vida de rotas.

**Conclusão:** I3 está fechado preservando a coerência da geração capturada, sem converter o alvo privado em resposta pública.

### R-MEDIA — cobertura do proprietário e retirada confirmada

**Implementação:** `src/features/media-library/server/resolve-media-access.ts:40–62`. O fallback lê e valida os usages exclusivamente para classificar indisponibilidade. Se algum uso confirmed não possui proprietário coberto na raiz, retorna 503. Se a raiz cobre o proprietário e sua lista pública não concede a mídia, retorna 404. O fallback sempre retorna erro; não lê bytes nem usa o manifest SQL para conceder acesso público.

**Prova revisada:** `src/config/publication-failure-boundaries.integration.test.ts:448` executa os modos missing/incomplete. Antes das verificações, confirma mídia pública e instala CHECK SQL real que rejeita o ACK da retirada. Confere explicitamente usages SQL ainda confirmed e 404 para o proprietário já revogado na raiz. Ao remover cobertura, exige 503; mantendo apenas a cobertura do proprietário retirado, exige que este continue 404. Controles de mídia privada/desconhecida ficam 404; restauração da raiz e retry repetido recuperam os estados consistentes.

**Conclusão:** o follow-up está fechado; FS continua sendo a autoridade dos grants e da revogação, inclusive no intervalo raiz→ACK.

## Regressões e qualidade

- **Critical:** nenhum novo achado demonstrado.
- **Important:** nenhum novo achado demonstrado.
- O diff do coordenador altera somente o limite da primeira leitura. O escritor global, CAS/fence do head, commit da raiz, reconciliação de pins e confirmação SQL não foram substituídos. O foco registrado inclui os testes anteriores de R1/R2/D1; a revisão escopada não os trata como dispensáveis nem como reexecutados por este revisor.
- `testing/fixtures/editorial-payload.ts:51–72` continua removendo todos os documentos dos dois tipos estruturais e passa a aposentar somente usages desses mesmos tipos, preservando usages de Cases e outros proprietários. A atualização do guardRevision acompanha a mudança. Isso corrige a inconsistência de teardown identificada pelo gate anterior sem flexibilizar a expectativa 404 ou alterar comportamento de produção.
- **I4 e I5 permanecem minor deferred**, conforme a decisão de escopo: contador de tentativas falhas, quatro warnings históricos de lint, aviso de query concorrente do pg e aviso do reporter. Foram documentados, não corrigidos ou silenciados. Não identifiquei agravamento novo provocado pelo diff. A revisão ampla ainda deve triá-los.

## Evidência conferida

O índice `docs/verification/artifacts/E1.8/evidence-index.json` corresponde ao SHA256 `b97be38776a881063e002a164fefa19ce629afe58c90893bb5ca291cfc36224a`. Recalculei os hashes dos **13 pares originais/exportados da Round1**: todos correspondem ao índice. Li os cinco extratos abaixo; os hashes verificam sua proveniência e integridade, não substituem a leitura dos testes reais feita acima.

| Artefato em `docs/verification/artifacts/E1.8/round1/` | Resultado registrado | SHA256 exportado |
| --- | --- | --- |
| `boundaries-red3.txt` | Exit1; seis falhas de comportamento dos limites originais | `1cee439afa3d426310fc29d6a231e2c4ed3c94664ffd39977e7d74be8a4911f2` |
| `media-red2.txt` | Exit1; duas falhas 404/503 e oito casos aprovados | `f99d5ff8490b3d1a11d97b75190d37fef6a56105d9dfcfefc424f8f1d66b657f` |
| `focused-green.txt` | Exit0; 46 testes em cinco arquivos | `d503b805c5383f13176879513c6b80208975ca66ff00e313b69390bab4bdfe92` |
| `verify3.txt` | Exit0; 455 testes/73 arquivos, um skip Windows; checks e build aprovados | `d74fb923db85a6cdda6b7c182579790e4011431cd06f1618b470eb266f81d9f5` |
| `e2e.txt` | Exit0; 25 jornadas Next/Native | `a29125864dbfd6f9f2b70f501ede0363a20b9c8866df17be485ad617799185cb` |

Os extratos identificam os comandos executados. Os erros anteriores de setup/DDL/tipagem e o gate 454pass/1fail/1skip estão classificados separadamente no índice; não os contei como novos REDs funcionais. Não executei novas suites, DB, build, Next ou harness nesta rodada. Não reli fonte alterada fora do pacote, não usei subagentes e não alterei checkout/index/HEAD. O único arquivo escrito é este relatório.

## Assessment

**I1: ADDRESSED. I2: ADDRESSED. I3: ADDRESSED. R-MEDIA: ADDRESSED.**

**SPEC da correção: compliant. QUALITY da correção: Approved.** O diff fecha os limites identificados com resultados distintos para falta de prova, pendência comprovada e ausência pública coberta, sustentados por testes reais e controles de recuperação. Não há novo Critical/Important a devolver ao implementador nesta rodada.

**Limitação de gate:** a CI de a78 não certifica a719. A CI Linux do target desta revisão permanece sob execução/avaliação do root; este relatório não afirma seu resultado. **Etapa 1 permanece 87,5%; A1 pendente; etapa 2 não autorizada.**
