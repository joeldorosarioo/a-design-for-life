# Estado atual

Atualizado em 15/11/2026. Este arquivo reúne entregas, evidências e condições ainda abertas. O lançamento público não está autorizado e o Analytics permanece desligado. A [especificação](specification.md) define os contratos; [arquitetura](architecture.md) explica a implementação; [operação](operations.md) contém os procedimentos.

## Entregue

- Portfólio PT/EN: Home, listagem, detalhe e Sobre; URLs e metadados por idioma, histórico de rotas e troca de idioma com preservação da leitura.
- CMS nativo do Payload com rascunhos, prévias autenticadas, versões, revisão e bloqueio de edição. Conteúdo, rotas, metadados e mídias públicas compartilham uma geração confirmada; atualizações pendentes preservam a edição anterior.
- Validação de uploads, derivados e PDFs; mídias privadas protegidas e acesso público revogado quando desaparece a última referência confirmada.
- Três bancos de aplicação fixos: produção, staging e local. Desenvolvimento, integração e E2E compartilham o banco local sob reserva exclusiva, com limpeza autorizada entre rodadas e checkpoint nos ensaios de recuperação.
- CI sem banco, imagem Linux, promoção por digest, backup criptografado e recuperação no escopo de homologação. Código sem consumidores e camadas redundantes foram retirados.
- Documentação consolidada em quatro arquivos em `documentation`, conforme decisão do usuário. Spec, contratos do CMS e referência do Figma passaram a uma única especificação; CMS, release e performance passaram a um único guia operacional. O plano de etapas concluídas e os registros detalhados ficam no Git.

## Verificação e limites

As evidências abaixo têm fontes e escopos próprios. Não aprovam automaticamente uma imagem posterior.

| Base                                   | Evidência                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aplicação local antes desta renomeação | `pnpm verify`: 2.360 testes Vitest aprovados, três skips exclusivos de Linux, 109 checks de scripts e build. E2E Chromium: 140/140. Recibos em `.work/shared-local-database-d5798ddc-66b2-4ea2-b828-1ddbcfbafb95`.                                                                                                                                                                                     |
| CI Linux do PR #9                      | [Rodada fria](https://github.com/joeldorosarioo/a-design-for-life/actions/runs/43769686783): 3min10s. [Rodada com cache](https://github.com/joeldorosarioo/a-design-for-life/actions/runs/43770174957): 1min55s. Passaram 1.998 unidades, 34 checks de arquitetura, 109 checks de scripts, tipos, lint, formato e build, sem skips. A variação do runner também contribui para os tempos.              |
| Publicação anterior                    | [PR #9](https://github.com/joeldorosarioo/a-design-for-life/pull/9) integrado em `a2d06a1ada1b1c1e6bb491776b025419c14a7401`. Local e remoto foram sincronizados. O check Linux do [push](https://github.com/joeldorosarioo/a-design-for-life/actions/runs/43770441483) passou, mas a imagem falhou: faltava `scripts/local-runtime.ts` na allowlist Docker. Nenhum deploy dessa execução foi iniciado. |
| Consolidação atual                     | `pnpm verify:ci` passou: 1.995 unidades, 34 checks de arquitetura, 110 checks de scripts e build, com três skips exclusivos de Linux no Windows. Os nove testes focados de backup/performance também passaram. A imagem Linux local foi aprovada em build, inspeção de identidade e smoke restrito.                                                                                                    |

Os três casos específicos de Linux — links de objetos, permissões dos snapshots e exclusão do escritor com SIGSTOP/SIGCONT — passaram no PR #9. Os oito avisos de lint em migrações geradas são preexistentes. A primeira rodada desta consolidação teve um timeout na importação do Payload; o teste isolado e a repetição completa passaram, sem mudar o limite.

A consolidação reduziu nove documentos/240.154 bytes a quatro arquivos. Links, âncoras e consumidores foram conferidos. A imagem local usa revisão `draft-documentation-20261115`; recibos em `.work/documentation-consolidation-20261115`. A renomeação e a correção Docker alteram código/configuração e exigem nova candidata, fora da exceção documental.

Os ensaios locais preservaram banco, contêiner e volume: OID `16384`, 17 migrações, sem usuários/cases/mídias de teste ou conexões restantes. Migração 16→17→restore16, primeiro acesso e snapshots A/B passaram. O smoke de desenvolvimento respondeu `/health` 200, encerrou a árvore de processos e permitiu readquirir a reserva. Isso comprova recuperação sequencial no banco fixo, não uma segunda cópia simultânea com a fonte online.

Antes da primeira limpeza, os dados locais foram preservados no backup criptografado `9cee8964-3145-45ec-bb00-545ebbdc3752`, SHA-256 `352d70b2fd64999496783ead6a5f54a2eb0bf6cf805dad64360848a8da8d28ac`; a descriptografia e os 31 membros foram conferidos. A prova normal posterior de `backup:local` foi `56511db9-7c6d-4dfe-a318-dfc12794d3fb`, SHA-256 `5104ff385287ac6f05fd670ecde92f1a7ce7fc5daeb34380f79c049c7e23ce90`. Os recibos completos, chaves e conjuntos ficam privados em `.work`; não são documentação versionada nem backup de produção.

## O que ainda falta

Os nove gates abaixo continuam abertos. Os IDs mantêm a ligação com os critérios históricos; uma alteração documental não conclui nenhuma condição.

1. **Conteúdo final — E4.1.3 / BLOCK-FINAL-CONTENT.** Responsáveis aprovarem apresentação, contatos, textos, alternativas das imagens, classificação dos cases e metadados PT/EN. Substituir os dois currículos temporários em branco. Exemplos não revisados ficam privados; apenas o conteúdo efetivamente publicado precisa estar pronto.

2. **Revisão da candidata — E2.3.5 / E4.2.1.** Um único aceite visual e de qualidade das páginas e estados afetados, com conferência PT/EN. Incluir listagem/detalhes e segundo exemplo EN quando afetados, teclado, foco, contraste, zoom, movimento reduzido, tablet e SSR/SEO/HTTP pertinentes. A mesma prova pode atender aos dois IDs. Ampliar a revisão quando não for possível delimitar o impacto.

3. **Fonte e imagem — E4.1.5 / BLOCK-PRODUCTION-SOURCE-TREE.** Obter CI Linux protegido da fonte corrente e vincular integração/E2E locais à fonte. Gerar e homologar a candidata quando houver alteração fora da exceção documental. Conferir marcador, revisão, digest e árvore de migrações; promover o mesmo manifesto sem rebuild. Os checks Linux já obtidos não homologam a imagem que falhou nem os consumidores alterados nesta rodada.

4. **Performance — E4.2.4.** Analisar o diff contra a referência medida antes de decidir sobre nova rodada. Mudanças de renderização, imagens, fontes, conteúdo pesado, dependências, cache ou infraestrutura exigem revalidação. Reaproveitar evidência exige identificar a referência, condições comparáveis e justificar a ausência de impacto; sem isso, medir. Seguir o [protocolo operacional](operations.md#performance): 12 cenários, três repetições por cenário, falhas, medianas e variação. LCP ≤2,5 s, CLS ≤0,1 e TBT ≤200 ms celular/≤150 ms desktop.

5. **Dossiê e decisão — E4.3.5.** Reunir uma vez checks, identidades, aceites, limitações, backup, rollback e recuperação da candidata. Solicitar decisão sobre essa evidência. A4 complementar e lançamento podem ser aprovados na mesma resposta se o lançamento for expresso e identificar digest, alvo, responsáveis e janela. Aceite técnico isolado não autoriza abertura pública.

6. **Configuração de produção — BLOCK-PRODUCTION-CONFIG.** Conferir domínio/DNS/TLS, origem HTTPS, capacidade, recurso, PostgreSQL/R2 e credenciais separados, volumes/namespaces, segredos, branch protegida, environment, operadores e flags. Inventário histórico não comprova configuração externa atual.

7. **Backup de produção — BLOCK-PRODUCTION-BACKUP-EXECUTOR.** Preparar e validar o executor do alvo, backup completo criptografado com releitura e ensaio de recuperação no banco local fixo com checkpoint. Manter 56 dias de histórico, agenda semanal e extras antes de atualizações/migrações, com identidade age separada. O executor embutido continua restrito a staging; não retirar a guarda para contornar a pendência.

8. **E-mail de produção — BLOCK-PRODUCTION-EMAIL.** Validar domínio/remetente, segredos e recuperação nativa no alvo real, em janela autorizada e com destinatário anuente. Captura local e entrega histórica em staging não comprovam entrega em produção.

9. **Dependências — BLOCK-DEPENDENCY-REFRESH.** Rever os avisos atuais antes do lançamento e resolver sua aplicabilidade. Correções necessárias repetem os checks pertinentes e renovam a candidata quando alterarem a aplicação. Triagem histórica não é liberação permanente.

## Exceções e ações condicionais

- **Leitor de tela — E2.6.2:** exceção aceita pelo usuário para o lançamento. A inspeção formal continua não executada e o NVDA permanece suspenso. Isso não declara conformidade WCAG geral; as outras verificações de acessibilidade continuam exigidas.
- **Ativação do GA4 — BLOCK-GA4-REPORT-LIMITATION:** bloqueia a ativação do Analytics, não o lançamento com Analytics desligado. Manter `loadScript=null`. A ativação exige decisão específica, revisão do SDK/ambiente efetivos e dos relatórios sob `analytics_storage: denied` permanente. Sem cookies analíticos, banner, identificadores persistentes alternativos ou tráfego sintético/editorial enviado ao Google.
- **Custos e serviços:** obter aprovação para compra de domínio, contratação, aumento de recursos ou serviço novo efetivamente necessário. Custo hipotético não bloqueia uma alteração que usa os recursos existentes.
- **Dados e migrações:** executar somente as migrações necessárias e aprovadas. DDL destrutivo, escrita/troca de conexão ou restauração sobre produção/staging exigem autorização e recuperação preparada. Ensaiar no banco local fixo, com checkpoint e execução exclusiva. A limpeza de dados locais entre rodadas está autorizada. Rollback de imagem não reverte dados.
- **INP de campo:** indisponível por falta de amostra real; não reprova automaticamente o lançamento. Referência p75 ≤200 ms, com celular/desktop separados quando houver dados. TBT de laboratório não comprova INP; coleta ou monitoramento adicional dependem de decisão própria.

## Promoção e abertura

Homologação privada segue `develop → staging`, com CI, registry privado, proveniência, digest e migrações conferidos; backup antes da troca, volumes preservados, saúde, negativas de acesso, `noindex` e Analytics desligado. Healthy não substitui aceite visual ou performance.

A exceção documental exige `APPROVED_STAGING_REVISION` e `APPROVED_IMAGE_DIGEST` aprovados explicitamente. O diff Git permite apenas `README.md`, `AGENTS.md` e arquivos regulares em `documentation/**`, com marcador, revisão e digest da candidata conferidos. Código, dependências, configurações, CI e operação ficam fora da exceção. Sem o par de variáveis, a seleção usa a árvore Git inteira. A migração desta pasta também altera consumidores executáveis e exige nova candidata.

Produção começa privada, após autorização: acesso restrito, `noindex`, `PUBLIC_SITE_ENABLED=false`, backup e catálogo/migrações conferidos. Verificar digest, TLS, saúde, PT/EN, URLs/SEO, PDFs/mídias, painel e negativas de drafts/prévias; e-mail somente na janela autorizada.

Abertura pública exige autorização expressa. Registrar horário/digest, retirar as restrições temporárias e conferir HTTP, canonical/alternates, sitemap e robots na origem final. Ensaios usam ambientes isolados e bloqueiam Google. A ativação do Analytics conserva sua decisão própria. Os passos completos ficam em [operação](operations.md).

## Referência de staging

Referência tecnicamente validada em 14/11/2026, anterior à fonte atual:

| Identidade             | Valor                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| Revisão                | `6788e7a9d4813bbda9128fb6df39cc2f69717cca`                                |
| Manifesto              | `sha256:eb0af8fcd4ecda691c4826cbb5400b984174f6bb8ecf5f1fbde653ec20fb9d24` |
| Configuração da imagem | `sha256:75924c70aa7eae13a1f182377c7a0acdb69f017d36116593c0ebbad31db2a86d` |
| Árvore Git             | `98e0fe5af219c5c4ffd0febb8caee5c06f82b054`                                |
| Árvore de migrações    | `863d5c13d017c3435b43a2e4e9cc36d68b06f89a`                                |

Essa imagem passou 2.352 testes Linux, 140 jornadas Chromium, 30 layouts/18 referências visuais e 12 cenários de performance em 36 medições. A aprovação complementar continua pendente; os resultados pertencem àquela imagem.

Rollback registrado: revisão `1640d9729d1bddaac2059b850e8124112aa9507a`, manifesto `sha256:d78eca0ad14ec38f99acae014f548c4d717cee415daf34e019a89821cf06bd5d`, mesma árvore de migrações. Estava saudável, mas falhou em LCP móvel da listagem. Conferir compatibilidade de catálogo e preservar volumes antes de usar.

Backup prévio de staging: `f0ea5c46-e830-404b-825b-5400d0d1a4a0`, concluído em `2026-11-14T18:12:45.815Z`, SHA-256 `bde4376582dc7beb3ea2e466caf19b214dbb899f8b6f34684a97b620c00d294a`. É histórico, não backup novo ou recovery point de produção. A prova A3 leu mídia do bucket existente; não comprova restauração em outro bucket nem SLA/RPO/RTO contratado.

## Histórico

Os critérios de produto vigentes estão na especificação consolidada; seus IDs históricos P01–P17 não criam tarefas novas. Os nove gates acima preservam as pendências efetivas. Percentuais, recálculo automático e aceites separados por etapa foram aposentados por decisão do usuário em 15/11/2026. A1/A2/A3 permanecem aprovadas nos respectivos escopos históricos; a A4 anterior não autoriza lançamento nem fonte posterior.

Os documentos anteriores completos estão no commit `a2d06a1ada1b1c1e6bb491776b025419c14a7401`. Para consultar o plano retirado:

```sh
git show a2d06a1:docs/specs/2026-10-29-portfolio-implementation-plan.md
```

Os registros mais antigos estão em `e8d7463` e `bee7667`. Não manter cópias ou arquivos de progresso paralelos. Atualizar este registro com evidência e escopo; uma regra mais simples não torna uma verificação pendente concluída. Dados e evidências privadas permanecem em `.work`.
