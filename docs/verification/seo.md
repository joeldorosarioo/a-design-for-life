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

## Regressão atual — candidata 008

O gate agregado final 003 passou: `pnpm verify`, exit 0, 1.164 testes e 2 skips Windows, mais 2 testes CSS; `pnpm test:e2e`, exit 0, 113/113. Inclui os 4 HTTP de metadados e 9 HTTP de prévia privada. CI Ubuntu 24.04 no commit `c9be4dc23c12f45fadd27cafc05a599b8b3a0c44`, [run 41655739795](https://github.com/joeldorosarioo/a-design-for-life/actions/runs/41655739795): SUCCESS, 1.166 testes sem skips, 2 CSS e 113 E2E.

BuildID `XCwWNaSVVZ2kr6jeLy4Aa`, fonte local de 500 arquivos/digest `f49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784`. O CI identifica o SHA Git exato; não recalculou esse inventário local. Provas atuais em [A2](A2.md) e `artifacts/E2-A2-resumed/ci-implementation/`. O recibo externo final registra o commit documental e seu CI. Leitor formal continua incompleto por orientação do usuário; isso não reabre SEO nem representa conformidade WCAG. Nenhum ambiente público ou analytics foi ativado.

## Diagnóstico local de 05/11/2026 com Lorem Ipsum

As páginas auditadas apresentaram título, descrição, idioma, canonical próprio, duas alternates, um main e um h1. O diagnóstico identificou títulos temporários repetidos entre Sobre e Case. Após as medições, uma atualização somente de metadados produziu títulos e descrições únicos nas 10 URLs. Os fingerprints do texto visível das oito páginas iniciais permaneceram iguais.

O ambiente local devolveu robots com Disallow geral e sitemap sem URLs, conforme sua política. Rotas desconhecidas PT/EN responderam 404 com noindex e sem canonical. O login do painel manteve cache privado e noindex. O recibo associa a geração usada nas medições à revisão posterior dos metadados. [Resultados e vínculos](artifacts/E4-local-audit/local-placeholder-audit-2026-11-05.json)

## Etapa 4 — HTTP e SSR em homologação

A auditoria verificou canonical, alternates, título, descrição e Open Graph nas dez páginas PT/EN. Em staging, Basic Auth, noindex, robots e sitemap vazio preservam a exclusão de indexação. As respostas 410 e 503 foram verificadas com dados isolados. O domínio e o runtime de produção continuam pendentes. Consulte os resultados por rota no [relatório visual e de qualidade E4.2](E4.2-quality.md).
