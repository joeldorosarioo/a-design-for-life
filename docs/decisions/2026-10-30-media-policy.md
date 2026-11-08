# Política de animação e senha de abertura de PDF

Data: 30/10/2026, America/Sao_Paulo. Escopo: E1.6 da etapa 1. Status: decisões aprovadas explicitamente pelo usuário neste chat; implementação e verificação em andamento.

## Decisões aprovadas

| Entrada                          | Política                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| JPEG, PNG, WebP e AVIF estáticos | Aceitar conforme os demais limites e validações aprovados.                                          |
| WebP animado                     | Aceitar e preservar a animação no original e nos derivados responsivos, sem achatamento silencioso. |
| APNG                             | Rejeitar, incluindo animação com imagem padrão oculta.                                              |
| AVIF animado                     | Rejeitar.                                                                                           |
| PDF que exige senha para abrir   | Rejeitar; não acrescentar importação com senha.                                                     |
| PDF que abre sem informar senha  | Validar normalmente, inclusive se houver criptografia para restringir edição ou impressão.          |

O usuário selecionou expressamente as duas opções recomendadas nas perguntas de esclarecimento sobre esses comportamentos. A decisão resolve os dois bloqueios editoriais antes identificados como pendentes. Não representa conclusão de E1.6 nem aprovação A1.

## Motivo e rastreabilidade

As provas preparatórias com Sharp 0.35.5 preservaram WebP animado e demonstraram perda de quadros em APNG e falha no controle AVIF animado. Não foi autorizado substituir essas animações por uma imagem estática. Um PDF protegido por senha de abertura não permite validar suas páginas sem acrescentar um novo fluxo de importação; o usuário escolheu a rejeição.

A implementação deve substituir as respostas temporárias de política pendente por validação explícita no servidor e demonstrar RED/GREEN dos comportamentos aprovados. A preservação dos quadros, tempos e repetição do WebP deve ser observada nos arquivos efetivamente produzidos. As evidências e limitações atuais serão consolidadas em [E1.6](../verification/E1.6.md).

Continuam os limites de imagens de até 10.000.000 bytes e PDFs de até 5.000.000 bytes, a proibição permanente de SVG, a privacidade de rascunhos e derivados e as demais garantias dos contratos. Esta decisão não introduz limite de dimensões, pixels, páginas ou quadros.

As quatro referências em docs/specs permanecem byte a byte preservadas. Este registro documenta somente o esclarecimento autorizado mais recente, sem substituir a spec ou antecipar as etapas 2–4.
