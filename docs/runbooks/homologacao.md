# Homologação isolada e prova local da mesma imagem

E3 local foi retomada em 03/11/2026. Este runbook prepara a validação; não registra um deploy ocorrido. VPS/Coolify, registry e homologação reais permanecem indisponíveis/não verificados. A3/A4 e produção seguem pendentes.

## Prova local antes de contratar

O responsável coordena a execução para preservar compilação008, prévia atual, fixture V5 e PostgreSQL visual55433, além de5432/55432. Não iniciar serviços/gates globais em paralelo ou reutilizar bancos/containers existentes por conveniência. Reservar portas e nomes próprios após inspeção atual; não copiar `.env` do host para a imagem.

Usar o **mesmo ID da imagem local** em dois containers com nomes/portas, bancos, origens e volumes separados. Ambos usam `APP_ENV=local`, captura de e-mail local e armazenamento local; isso exercita configuração em execução sem chamar R2, Resend ou Google. Essas configurações locais não simulam aprovação de `staging`/`production`, que exigem integrações reais. Deixar `PUBLIC_SITE_ENABLED` ausente ou `false`, sem Analytics real.

Fornecer via `--env-file` privado somente a configuração de execução necessária: segredo Payload próprio, URI de banco isolado, `APP_ENV=local`, `SITE_ORIGIN` de loopback correspondente à porta publicada, `INTERNAL_HTTP_ORIGIN=http://127.0.0.1:3000`, bucket/local storage próprios. Não passar esse arquivo ao build ou incluí-lo no Git/dossiê. Não reutilizar credenciais/volume/namespace entre as duas configurações.

Montagens por container, com permissões UID/GID 70:

| Destino                              | Finalidade                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `/app/.work/publication`             | Publicação confirmada persistente, internamente separada por ambiente/origem/banco |
| `/app/.work/next-build/cache/images` | Cache do otimizador, exclusivo desse ambiente                                      |
| `/app/.work/private-media`           | Apenas prova local com armazenamento em disco                                      |
| `/app/.work/editorial-mail`          | Apenas captura de recuperação local, se usada                                      |

**Nunca montar `/app/.work` inteiro:** isso esconderia a aplicação compilada em `.work/next-build`. Não compartilhar caches/volumes entre ambientes. Na implantação real, mídias são privadas no R2; banco e bucket têm credenciais distintas por ambiente. As necessidades finais de persistência/recuperação seguem a prova E3.2, sem considerar o cache como autorização de acesso.

Executar primeiro o smoke sem rede descrito em [build e promoção](build-e-promocao.md). Depois, para cada container da mesma imagem:

1. Comprovar `/health`: HTTP200 com somente `{"status":"ready"}`. O probe Node usa timeout4s; proposta Docker30s/timeout5s/três falhas/start30s precisa ser medida. Não executar consultas de banco/R2 nesse endpoint.
2. Conferir usuário/processo real e registrar somente campos seguros. Sem migração automática na inicialização. Migração/provisionamento de fixture sintética ocorrem em etapa separada controlada, no banco próprio.
3. Exercitar `/admin`, API, CSS/JS estáticos, rotas públicas confirmadas, origens dos metadados/URLs e políticas `robots`/headers. Primeiro ambiente não pode aparecer nos HTML/manifestos/bundles/respostas do segundo, nem o inverso. Procurar também o valor sintético do build e marcadores de segredos de teste, sem anexar valores privados.
4. Testar mídia válida, acesso privado, derivados/otimizador autorizado e PDF pelo consumidor real. QPDF/sharp/canvas/PDF.js apenas importáveis não substituem a jornada completa. Confirmar negativa após revogação, inclusive com cache aquecido.
5. Inspecionar rede/cookies/storage: nenhum pedido real ao Google/Resend/R2 e nenhuma medição no ambiente local. Comparar o campo ID local dos dois containers; ambos devem apontar ao mesmo ID, sem rebuild.
6. Reiniciar cada container e repetir conteúdo confirmado/persistência e isolamento. Guardar recibos por configuração, imagem e dataset. Não declarar prova real de homologação ou encerrar E3.4 por esses resultados locais.

## Ensaio local observado

A imagem 004 passou 82 verificações HTTP em dois bancos descartáveis com `APP_ENV=test` e origens canônicas distintas. Os processos usaram redes e montagens do runner isolado. As origens 3103 e 3104 eram metadados e os contêineres de aplicação ficaram sem portas publicadas no host. As verificações foram repetidas depois de reiniciar cada instância com o mesmo ID de imagem. Painel, API, imagens, PDF e rotas confirmadas PT/EN passaram. Os quatro inícios tiveram estado saudável e probe embutido com saída 0. [Recibo do ensaio](../verification/artifacts/E3-image/http-973f5053-f16b-4c9a-b183-8470d9719ebf/run.json)

O Playwright local teve 116 testes aprovados com o Next compilado para produção. A prova do navegador usando a imagem Linux é uma execução própria. Os snapshots e resultados de cada consumidor seguem em seus recibos.

## Homologação real pendente

Depois de serviços/custos apresentados e recursos autorizados: TLS, acesso autenticado antes da aplicação, sem indexação nem Analytics, origem real própria e URL privada do painel. Health de loopback deve continuar acessível ao probe interno sem expor diagnósticos detalhados. Confirmar regra de autenticação para HTTP/E2E e ausência de vazamento de conteúdo antes de liberar qualquer acesso externo.

Staging e produção exigem R2 privado e Resend completos no ambiente privado; não preencher valores fictícios para passar validação. Nenhum envio real de recuperação está autorizado neste preparo. Não ativar `PUBLIC_SITE_ENABLED=true` em candidata privada. A configuração pública sai do servidor como DTO mínimo; origem/GA não usam `NEXT_PUBLIC_*` nem rebuild por ambiente.

Os logs vão para stdout/stderr com redaction da aplicação. Aplicar/medir a proposta de rotação Docker `json-file`, `max-size=10m`, `max-file=3` no ambiente real antes de aceitá-la; registrar logs de implantação e execução separadamente. Banco/R2 têm diagnóstico protegido separado da prontidão. Migrações, backup e rollback seguem os runbooks operacionais correspondentes e suas autorizações; sem migração destrutiva ou reversão de dados implícita.

Aceite futuro exige E2E contra a imagem Linux candidata, `pnpm verify` protegido, inspeção de processos/arquivos/camadas, digest imutável do registry autorizado e mesma imagem na futura produção. A pendência NVDA E2.6.2 permanece registrada e não implica conformidade WCAG.
