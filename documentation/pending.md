# Pendências

Atualizado em 15/11/2026. O lançamento público ainda depende dos nove gates abaixo. Analytics continua desligado. Concluir uma tarefa técnica não autoriza lançamento nem aprova uma candidata.

Este arquivo acompanha o que falta. Entregas e provas ficam no Git e no índice privado `.work/verification/evidence/index.json`. Ao concluir um item, registre a evidência e retire a tarefa desta lista. Os IDs preservam a ligação com os critérios originais.

## Gates de lançamento

1. **Conteúdo final — E4.1.3 / BLOCK-FINAL-CONTENT.** Aprovar apresentação, contatos, textos, alternativas das imagens, classificação dos cases e metadados PT/EN. Substituir os dois currículos temporários em branco. Exemplos não revisados ficam privados; somente o conteúdo que será publicado precisa estar pronto.

2. **Revisão da candidata — E2.3.5 / E4.2.1.** Fazer um único aceite visual e de qualidade das páginas e estados afetados, com conferência PT/EN. Incluir listagem, detalhes e segundo exemplo EN quando afetados, teclado, foco, contraste, zoom, movimento reduzido, tablet e SSR/SEO/HTTP pertinentes. A mesma prova pode atender aos dois IDs. Ampliar a revisão se o impacto não estiver delimitado.

3. **Fonte e imagem — E4.1.5 / BLOCK-PRODUCTION-SOURCE-TREE.** Obter CI Linux protegido da fonte atual, incluindo os casos específicos de plataforma, e vincular integração/E2E locais à fonte. Gerar e homologar uma candidata quando houver mudança fora da exceção documental. Conferir revisão, digest, marcador e árvore de migrações. Promover o mesmo manifesto, sem rebuild.

4. **Performance — E4.2.4.** Comparar o diff com a referência medida. Mudanças em renderização, imagens, fontes, conteúdo pesado, dependências, cache ou infraestrutura exigem revalidação. Para reaproveitar uma prova, identificar a referência, as condições comparáveis e justificar a ausência de impacto. Sem essa evidência, medir os 12 cenários/36 medições conforme o [protocolo](operations.md#performance), preservando falhas, medianas e variação.

5. **Dossiê e decisão — E4.3.5.** Reunir checks, identidades, aceites, limitações, backup, rollback e recuperação da candidata. Solicitar a decisão sobre essa evidência. A4 complementar e lançamento podem ser aprovados juntos se o lançamento estiver expresso e identificar digest, alvo, responsáveis e janela. Aceite técnico isolado não autoriza abertura pública.

6. **Configuração de produção — BLOCK-PRODUCTION-CONFIG.** Conferir domínio/DNS/TLS, origem HTTPS, capacidade, recurso, PostgreSQL/R2 e credenciais separados, volumes/namespaces, segredos, branch protegida, environment, operadores e flags. Usar a configuração externa efetiva; inventário antigo não comprova o estado atual.

7. **Backup de produção — BLOCK-PRODUCTION-BACKUP-EXECUTOR.** Validar o executor do alvo, um backup completo criptografado com releitura e um ensaio de recuperação no banco local fixo, com checkpoint. Seguir retenção, agenda e guarda de chaves do [guia operacional](operations.md#backup-e-recuperação). O executor embutido aceita somente staging; produção precisa de executor próprio.

8. **E-mail de produção — BLOCK-PRODUCTION-EMAIL.** Validar domínio/remetente, segredos e recuperação nativa no alvo real, em janela autorizada e com destinatário anuente. Captura local e entrega anterior em staging não comprovam entrega em produção.

9. **Dependências — BLOCK-DEPENDENCY-REFRESH.** Rever os avisos atuais e resolver sua aplicabilidade antes do lançamento. Repetir os checks pertinentes após correções e renovar a candidata quando houver mudança na aplicação. A triagem anterior não é uma liberação permanente.

## Decisões e ações condicionais

- **Leitor de tela — E2.6.2:** o usuário aceitou a exceção para o lançamento. A inspeção formal não foi executada e o NVDA continua suspenso. Isso não declara conformidade WCAG geral; os outros requisitos de acessibilidade continuam exigidos.
- **GA4 — BLOCK-GA4-REPORT-LIMITATION:** a pendência bloqueia a ativação do Analytics, não o lançamento com ele desligado. Manter `loadScript=null`. A ativação exige decisão específica, revisão do SDK/ambiente e validação dos relatórios sob `analytics_storage: denied` permanente, sem cookies analíticos, banner, identificadores alternativos ou tráfego sintético/editorial enviado ao Google.
- **INP de campo:** falta amostra real suficiente. Isso não reprova automaticamente o lançamento. Referência p75 ≤200 ms, com celular/desktop separados quando houver dados. TBT e interações pontuais de laboratório não substituem INP; coleta adicional depende de decisão própria.
- **Dados e custos:** migrações e operações em produção/staging precisam do escopo e da autorização previstos em [operação](operations.md). A limpeza de dados locais entre testes está autorizada. Compras, contratação, aumento de recursos e novos serviços exigem aprovação quando forem necessários. Rollback de imagem não reverte dados.

## Referência para a próxima decisão

O [workflow de staging](https://github.com/joeldorosarioo/a-design-for-life/actions/runs/43772695834) da revisão `0fa301c7ae5bf32ed4036cdf75c6a4a27fa7ea54` passou em 15/11/2026 e confirmou saúde e marcador no manifesto `sha256:5f94d047d01a54b81c71c5dc4d87c06a835b897f784e53a8e260cee60a7a38d9`. Essa prova técnica não conclui os gates de conteúdo, revisão visual, performance ou lançamento.

As medições visuais/performance anteriores pertencem à revisão `6788e7a9d4813bbda9128fb6df39cc2f69717cca`. As provas preservadas estão em `.work/audit-follow-up/candidate-002` e `.work/local-audits/e4-audit-fixes-2026-11-14-candidate-002`. A fonte alterada nesta rodada precisa dos checks e da candidata pertinentes.
