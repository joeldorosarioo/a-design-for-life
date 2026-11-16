# Pendências

O lançamento público ainda depende das nove condições abaixo. Analytics continua desligado. Concluir uma tarefa técnica não autoriza lançamento nem aprova uma candidata.

Este arquivo acompanha o que falta. Quando todo o critério de um item tiver evidência, registre-a no índice privado `.work/verification/evidence/index.json` e retire a tarefa desta lista.

## Condições de lançamento

1. **Conteúdo final.** Aprovar apresentação, contatos, textos, alternativas das imagens, classificação dos cases, currículos e metadados PT/EN. Currículos temporários ou em branco precisam ser substituídos. Exemplos não revisados ficam privados; somente o conteúdo que será publicado precisa estar pronto.

2. **Revisão da candidata.** Fazer um único aceite visual e de qualidade das páginas e estados afetados, com conferência PT/EN. Incluir listagem, detalhes e segundo exemplo EN quando afetados, teclado, foco, contraste, zoom, movimento reduzido, tablet e SSR/SEO/HTTP pertinentes. Ampliar a revisão se o impacto não estiver delimitado.

3. **Fonte e imagem.** Obter CI Linux protegido da fonte atual, incluindo os casos específicos de plataforma, e vincular integração/E2E locais à fonte. Gerar e homologar uma candidata quando houver mudança fora da [exceção documental](OPERATIONS.md#promoção-e-lançamento). Conferir revisão, digest, marcador e árvore de migrações. Promover o mesmo manifesto, sem rebuild.

4. **Performance.** Comparar o diff com a referência medida. Revalidar mudanças em renderização, imagens, fontes, conteúdo pesado, dependências, cache ou infraestrutura. Para reaproveitar uma prova, identificar a referência, as condições comparáveis e justificar a ausência de impacto. Sem essa evidência, seguir o [protocolo de medição](OPERATIONS.md#performance).

5. **Decisão de lançamento.** Reunir checks, identidades, aceites, limitações, backup, rollback e recuperação da candidata. Solicitar uma decisão expressa que identifique digest, alvo, responsáveis e janela. Aceite técnico isolado não autoriza abertura pública.

6. **Configuração de produção.** Conferir domínio/DNS/TLS, origem HTTPS, capacidade, recurso, PostgreSQL/R2 e credenciais separados, volumes/namespaces, segredos, branch protegida, environment, operadores e flags. Usar a configuração externa efetiva; inventário antigo não comprova o estado atual.

7. **Backup de produção.** Validar o executor do alvo, um backup completo criptografado com releitura e um ensaio de recuperação no banco local fixo, com checkpoint. Seguir retenção, agenda e guarda de chaves do [guia operacional](OPERATIONS.md#backup-e-recuperação). O executor embutido aceita somente staging; produção precisa de executor próprio.

8. **E-mail de produção.** Validar domínio/remetente, segredos e recuperação nativa no alvo real, em janela autorizada e com destinatário anuente. Captura local e entrega anterior em staging não comprovam entrega em produção.

9. **Dependências.** Rever os avisos atuais e resolver sua aplicabilidade antes do lançamento. Repetir os checks pertinentes após correções e renovar a candidata quando houver mudança na aplicação. A triagem anterior não é uma liberação permanente.

## Decisões e ações condicionais

- **Leitor de tela:** o usuário aceitou a exceção para o lançamento. A inspeção formal não foi executada e o NVDA continua suspenso. Isso não declara conformidade WCAG geral; os outros requisitos de acessibilidade continuam exigidos.
- **GA4:** a pendência bloqueia a ativação do Analytics, não o lançamento com ele desligado. Manter `loadScript=null`. A ativação exige decisão específica, revisão do SDK/ambiente e validação dos relatórios conforme a [política de Analytics](SPECIFICATION.md#seo-e-analytics).
- **INP de campo:** falta amostra real suficiente. Isso não reprova automaticamente o lançamento. TBT e interações pontuais de laboratório não substituem INP. Aplicam-se a [meta](SPECIFICATION.md#qualidade-e-operação) e o [protocolo](OPERATIONS.md#performance); coleta adicional depende de decisão própria.
