# Prévia visual privada — prova intermediária de E2

Não é a entrega A2. O gate integral, as comparações renderizadas, acessibilidade completa e o diagnóstico de desempenho continuam abertos. A etapa3 não está autorizada.

As quatro páginas de rascunho PT/EN agora usam os componentes da apresentação pública, com DTOs e destinos privados. O Proxy autentica e verifica a composição antes de permitir streaming. A Page autentica novamente; não recebe conta, documento Native, sessão ou autorização do Proxy. Rascunhos não recebem geração pública, sitemap, canonical ou OG.

O botão nativo do Payload abre a apresentação correspondente por coleção/UUID/idioma, inclusive case sem slug. A entrada `/preview` sem `page` conserva o fluxo A1. Os links privados permanecem em `/preview-ui`, currículos e imagens em `/preview-media`; a prévia não usa o otimizador anônimo. A otimização pública continua pelo `Image` do Next.

## Evidência atual

`pnpm test:e2e private-pages.e2e.test.ts`: **exit0,8/8**, build de produção local `HqSsC4h2NmoWBbjHU3mLo`. Node24.22.2,Next16.4.3,Payload3.92.1,React19.3.1,PostgreSQL17.11real isolado em55433/tmpfs. Next3100 e o banco próprios foram encerrados. Prova:

- HTML das quatro páginas em cada idioma sem JavaScript, destinos privados e currículo em nova aba.
- Negação anônima antes de HTML,HEAD ou Flight; respostas privadas sem cookie de preferência.
- Documento,HEAD,Flight de navegação e prefetch de segmentos com proteção de cache/indexação.
- Bytes PNG/PDF reais autenticados; arquivos privados inacessíveis pelo caminho público e pelo otimizador anônimo.
- Origem externa, idioma incompatível, query ambígua e métodos de escrita recusados.
- Novo rascunho lido na mesma URL sem alterar o PublicRoot; sessão revogada recusada nas páginas e mídia.

O backend passou20/20unit e50/50Native em execução focada (50 inclui39 anteriores). O frame passou17/17 e46regressões relacionadas; o Proxy passou35/35unit e1/1Native. A tipagem completa passou. Essas contagens são de conjuntos sobrepostos, não uma soma de testes únicos nem um gate global.

## RED e falhas preservadas

1. Frame:7falhas/10passantes por destinos públicos em vez dos privados; mínimo implementado→17/17.
2. Transporte/modelo: assertions Native falharam com stubs fechados, depois passaram com sessão,permissões e banco reais.
3. Proxy: fonte autorizada incompleta retornava continuação200; passou a recusar503 antes de Next.
4. Primeiro HTTP descoberto: anônimo401 passou; editor recebeu404 em vez de200 porque a Page ainda não existia. É o RED de comportamento.
5. A chamada anterior com caminho completo não descobriu testes. Não é RED.
6. Após implementar, uma fixture havia substituído todo o grupoHome ao trocar o título, removendo seu retrato. Corrigida apenas a fixture, preservando a exigência de imagem.
7. Outra execução confundiu prefetch de segmentos com o Flight de navegação completo. As duas requisições agora são verificadas separadamente, mantendo a exigência de título no documento/Flight completo.

Todos os logs,resultados e hashes estão em [evidence-manifest.json](artifacts/E2-private-preview/evidence-manifest.json). O [snapshot de fonte](artifacts/E2-private-preview/source-snapshot.json) registra474arquivos,SHA256`4c32e141442f9a545f8bb4d0287de1b15244eafeafabe2110329fbc829f8481e`,antes de liberar a próxima janela de testes. As mudanças ainda não formam um commit validado integralmente.

## Limites que permanecem

O seletor de idioma da prévia ainda não foi composto; as URLs privadas dos dois idiomas funcionam separadamente. O modelo lê drafts frescos e não promete snapshot transacional entre consultas Native. Uma falha posterior à decisão do Proxy é recusada pela Page com erro genérico; não se promete503 em todo ponto posterior ao início do streaming.

A última suíte integral parou em970passantes/1falha/2skipsWindows. A falha de isolamento foi reproduzida e corrigida em execução focada; ainda é necessário repetir o par final com o caminho correto do teste legado e executar o gate global da fonte atual. A matriz pública ampliada está em execução separada. Os modelos Figma e suas cinco imagens originais continuam privados; o loader Native visual ainda não foi executado.
