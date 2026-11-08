> **Atualização de 03/11/2026:** A2 aprovada pelo usuário com a pendência do leitor de tela registrada. E3 autorizada e depois pausada até reunir as informações necessárias. Estado atual em [retomada-etapa-3.md](retomada-etapa-3.md). O relatório abaixo preserva o snapshot anterior à aprovação.

> **Aviso histórico — atualização de 03/11/2026.** A pausa descrita abaixo foi encerrada pela autorização expressa de retomada de E2.1–E2.6. O texto antigo permanece como histórico; o estado atual está em [A2](A2.md) e no [progresso da etapa 2](progresso-etapa-2.json). A etapa 3 continua aguardando aprovação expressa de A2.
>
> A fixture privada V5 teve restauração ensaiada e restore real pós-gates 003, com 10 rascunhos, 7 mídias Native, Root nulo, 0 operações públicas e dados/objetos conferidos. O percurso atual inclui gates locais, CI Linux aprovado, capturas/auditorias V9, manual 008, desempenho 008 e smoke 008/004; não se reutilizam os snapshots antigos como se fossem atuais.
>
> Usar Node 24.22.2 da `.toolchain`, pnpm 12.10.1 e o lockfile validado. A prévia usa loopback 3100 e o PostgreSQL de teste isolado usa 55433; os serviços 5432/55432 foram preservados. NVDA permanece encerrado e o leitor formal não foi concluído a pedido do usuário. Checkpoints, originais, DPAPI e dados privados continuam nos arquivos técnicos privados, fora do pacote compartilhável.

---

# Retomada da etapa2 — pausa solicitada pelo usuário

O usuário pediu para concluir o item atual e parar para continuar em outra sessão. O item dos campos opcionais do card foi concluído; **não continuar trabalho nesta sessão**. A autorização de E2.1–E2.6 permanece registrada, mas a execução está pausada por solicitação explícita. A2 não foi entregue/aprovada; etapa3 não está autorizada.

## Estado do repositório e da entrega

- Aplicação: `E:\a-design-for-life`, branch `develop`, Conventional Commits coerentes em inglês. Originais aprovados em `docs/specs/` permanecem imutáveis. Consultar `AGENTS.md` antes de retomar.
- Progresso: [checklist recalculado](progresso-etapa-2.md), **80%,24/30 itens,3/6 tarefas fechadas: E2.1,E2.4,E2.5**. Recalcular com `node scripts/recalculate-stage-progress.mjs` antes de toda atualização. A ausência de crédito parcial é deliberada.
- Último item: `cardTitle` e `cardEyebrow`, opcionais/editáveis no Payload, com fallback independente para o detalhe quando ausentes/nulos/vazios. Título/identificação do detalhe, SEO e rotas preservados. Commit **c3b4860**.
- Nova publicação inclui projeção própria do card na raiz confirmada. Snapshots anteriores sem essa projeção continuam legíveis; projeções presentes inválidas ou com identidade/idioma/path divergentes são rejeitadas. Preview também seleciona os campos.
- Migração oficial `20261031_011109_e2_case_card_copy`: somente quatro colunas varchar nullable em conteúdo/versões. Aplicada apenas no novo banco técnico desse item. **Ainda não foi aplicada ao banco visual.** O usuário aprovou os campos e reforçou que os textos editoriais são editáveis; não pedir essa autorização novamente.

## Verificações e seus limites

- Item card: RED unit8fail/5pass → GREEN38/38; Native real RED4assertfail/2pass → GREEN6/6; tipos/lint/formato0. [Fontes, resultados e logs](artifacts/E2-card-copy/milestone-manifest.json).
- Encerramento do coordenador:44/44 unitários atuais em6arquivos (38card+6codec) e2/2 testes do emissor CSS, exit0. Registro final de pausa acompanha o repositório.
- Correção de grupos explicitamente nulos aceitos pelo schema:6unit+4Native, validação estrita antes do encoding; limpar é diferente de omitir. [Provas](artifacts/E2-native-null-groups/milestone-manifest.json). A carga visual depois passou, sem publicar modelos.
- Skip link dos negativos: RED4/4 por geometria → GREEN4/4 com CSS de scroll-margin, incluindo390/1440 e texto200%. [Provas](artifacts/E2-negative-skiplink/milestone-manifest.json).
- Build visual anterior aos campos do card: `ccsiqmNETvfpOo7SzlMIW`, Next16.4.3 em produção local/APP_ENV=test. Capturas e auditoria abaixo pertencem a esse build; não comprovam o código final dos campos novos.
- Gate integral1048pass/2skipsWindows, lote público63/63 e HTTPSEO/privado13/13 são milestones anteriores identificados por seus snapshots. **Falta pnpm verify, fullE2E e LinuxCI do candidato final.** Preservar/restaurar byte a byte os12screenshots históricos A1 quando as jornadas antigas os regravarem.
- Nenhum push novo nesta sessão; remoto protegido tinha `origin/develop` em84ce799. Conferir o remoto antes da próxima promoção e executar CI no SHA exato, sem bypass/force.

## Materiais privados preservados fora do Git da aplicação

Workspace C: `C:\Users\joeld\Documents\Codex\2026-10-29\quero-iniciar-a-implementa-o-do\work`.

- `stage2-reference/`: arquivo Figma,18PNGs de referência, JSONs editoriais e **cinco originais únicos**. Não baixar versões alternativas, não criar fotos substitutas nem mover esses originais para o público.
- `stage2-reference/private-visual-fixture/technical-test/`: bootstrap, estado Native técnico, sessão protegida por DPAPI, recibos e **18capturas reais** em `captures/`. Foram carregados10documentos em rascunho e7mídias (5originais+2PDFs claramente técnicos); duas aplicações foram idempotentes e não acrescentaram Root/intenção de publicação.
- Esses18PNGs e o banco visual ainda usam a cópia anterior dos cards. A carga C/mapeamento **não recebeu os overrides aprovados**. Revisar cuidadosamente checkpoints/fingerprints antes de mudar o plano: não contornar a detecção de edição externa nem substituir IDs arbitrariamente. Preservar histórico; usar namespace técnico novo se necessário.
- `stage2-briefs/E2-a11y-tooling/`: scripts/driver privados de auditoria e relatório real. Interop CJS do Playwright corrigida; validações de ambiente/origem ocorrem antes de descriptografar auth. Não gravar cookie/token em arquivo claro ou CLI.
- `audit-results/a2-visual-first/`: axe4.14.0 em18targets/27estados, **zero violações automatizadas e36incomplete**. Fila manual: contraste de glifos/setas e foco durante menus Radix. Não declarar WCAG a partir desse resultado.
- **Leitor de tela/manual não executado.** NVDA portátil oficial2026.3 foi preparado e nunca iniciado. O controle da janela de teste retornou `Computer Use app approval timed out`; o pedido de acesso expirou. Isso é bloqueio de ferramenta, não uma nova aprovação de escopo. Ao retomar, obter acesso normal à janela dedicada para a inspeção manual, sem interagir com janelas pessoais.
- **Lighthouse não foi executado.** Apenas pins/APIs foram conferidos. Diagnóstico inicial de desempenho continua pendente; não atribuir aprovação P12.

## Conferência visual já realizada, sem implementar correções adicionais

Os18pares foram inspecionados, mas o aceite visual continua aberto. As mudanças aprovadas de header sticky, quatro destinos e três contatos do footer devem ser preservadas; não impor a altura total do PNG.

| Página            | Altura referência → captura, CSS px |
| ----------------- | ----------------------------------- |
| HomePT/EN desktop | 3244→3169                           |
| HomePT mobile     | 4524→5033                           |
| HomeEN mobile     | 4388→4893                           |
| SobrePT desktop   | 4528→4363                           |
| SobreEN desktop   | 4544→4227                           |
| SobrePT mobile    | 5652→5386                           |
| SobreEN mobile    | 5436→5162                           |

Achados Home/Sobre: narrativa Sobre deve usar18/28, atualmente16/24; lead da introdução mobile18/28, preservando20/28 desktop; faixa rosa Home mobile16/24, atualmente afetada por18/28; padding inicial mobile Home24px e Sobre48px, atualmente64; início da faixa rosa e Abordagem mobile24px. A fronteira retrato→Projetos apresenta128px contra48 de referência. Preservar overrides desktop. **Crop do retrato desktop já coincide**, deslocamento interno medido zero; não corrigir com base no tamanho aparente das miniaturas. Títulos/ênfases/footer precisam de conferência de largura/quebras; os JSONs normalizaram algumas quebras para espaços, e30rem/40rem citados no review são candidatos a testar, não medidas Figma comprovadas.

Achados Cases detalhados em `work/stage2-briefs/E2-cases-visual-review.md` e JSON adjacente, no workspace C: margens de parágrafos colapsam pela cascata, comparação mobile deveria ocupar390px em vez342, faixa do segundo case deveria ser clara, quebras de título/footer se perderam. Lista desktop já coincide em cover352px/y540. As flags mostram o idioma de destino enquanto o Figma mostra o atual; registrar/corrigir conforme a referência sem alterar as regras de navegação. Warmup da captura pode deixar o último item do sumário ativo após salto direto ao topo; investigar antes de chamar isso de estado inicial fiel.

## Serviços ao encerrar e caminho de retomada

- Next3100 encerrado e nenhum listener; browser dedicado encerrado, zero processos próprios remanescentes. A sessão headed terminou por interrupção deliberada, exit1; não é uma auditoria falha ou prova manual.
- Somente o container **postgres-test** do projeto `a-design-for-life-local`, porta55433, foi pausado, preservando o estado. ID: `486e7f1e46bbe9402f5e0c208f10d19a3149d3984279bcb88e5f710506fc678f`. Não tocar em5432/55432 ou em serviços de outros projetos.
- Checkpoint técnico privado em `work/stage2-session-checkpoint/visual-20261031-0116.dump`,178810bytes, SHA256 `BCA1308A60326F38828616D5549FFF6B8B81519ED52E98CEB620014DB82BDD1D`; catálogo pg_restore legível, **restauração não testada**. Imagens continuam no armazenamento privado E e nos originais C. Isso não configura backup/produção da etapa3.
- Após o usuário pedir retomada: inspecionar Git/serviços, usar Node portátil24.22.2/pnpm12.10.1 e conferir o checkpoint. Se o mesmo container ainda existir pausado, validar projeto/serviço/porta e despausar somente ele. Se o tmpfs se perder, restaurar em banco técnico novo de forma controlada; não presumir durabilidade do tmpfs.
- Aplicar migração pendente somente no banco visual isolado antes de usar o código novo; atualizar a fixture privada autorizada e conferir idempotência/Root vazio. Depois corrigir visual por evidência, reconstruir o app e renovar capturas/auditorias afetadas.
- Fechar6caixas abertas somente com provas completas: E2.2.5,E2.3.5,E2.6.2–E2.6.5. Entregar A2 e aguardar aprovação, sem iniciar etapa3.
