# SEO e exclusões de indexação — E2

O HTML do servidor contém canonical próprio por idioma e alternates apenas das traduções confirmadas. Títulos/descrições/OG são projetados dos DTOs da mesma geração da página. Erros não recebem canonical de conteúdo; prévias não recebem canonical/alternates/OG e exigem sessão Native.

O sitemap de produção captura o Root uma vez e consulta as interfaces públicas das features com esse mesmo objeto. Erro/ausência de cobertura não vira uma lista vazia. Uma ausência estrutural só exclui páginas após classificação real de metadados; não busca um corpo Native para completar a publicação. Cases confirmados podem existir sem páginas estruturais. A projeção para o formatter contém somente identidade/idioma/path atual; histórico não vira URL de sitemap.

Em `APP_ENV=test/local/staging`, a política retorna sitemap sem URLs e robots com `Disallow: /`. Essa exclusão não substitui autenticação. A configuração final da homologação pertence a A3. Não foi acessado ou publicado um host de produção/homologação, nem inventado domínio final.

## Verificação executada

- Metadados:46testes; formatter de sitemap/robots:17testes, com RED/GREEN próprio.
- Leitor real Payload/PostgreSQL:6/6, com publicação PT e EN privada, drafts posteriores, cobertura ausente/corrompida e Root capturado durante avanço de current. Não usa mocks de publicação.
- HTTP de produção local:4/4, dentro do lote13/13com prévias. Confere canonical próprio/alternates/OG no HTML semJavaScript PT/EN, exclusão da tradução privada e endpoints robots/sitemap fechados no ambiente de teste.

Os relatórios, falhas preservadas e hashes estão no [milestone SEO/idioma privado](artifacts/E2-seo-private-language/evidence-manifest.json). A seleção do sitemap de produção foi provada com Root Native real e formatter; o HTTP local testou a política não indexável. Não se apresenta isso como medição em produção.

O primeiro HTTP encontrou404 em `/robots.txt`: o matcher do Next16.4.3 só reconhece `robots.ts` na raiz de `app`. Foi movido para `src/app/robots.ts`, mantendo a URL aprovada. `sitemap.ts` também ficou na raiz por organização; o Next aceita sitemap em grupos. Essa correção interna do caminho ilustrativo do plano está [documentada](artifacts/E2-seo-private-language/metadata-root-move-diagnosis.md).

A primeira fixture Native tentava confirmar NavegaçãoEN com PerfilEN privado; o adapter real exige o Perfil confirmado. Essa montagem impossível foi retirada do teste, preservando as guardas do produto. O RED limpo posterior falhou por asserção e passou6/6 após implementar o leitor. Falha de instalação/Docker e falha de fixture não foram contadas como RED.

O gate agregado da fonte posterior às adições ainda será repetido antes de A2. Acessibilidade, comparação visual, diagnóstico de desempenho e CI atuais permanecem pendentes.
