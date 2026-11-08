# Frame privado — autoria C-only, sem instalação

Este pacote foi preparado durante o freeze do gate integral do root. Nenhum arquivo em E: foi
escrito e nenhum teste, tipagem, formatter, lint, Next, DB, build ou Git foi executado aqui.
A única CLI executada foi scripts/recalculate-stage-progress.mjs --check, somente leitura,
exit0: 56,7% (17/30 itens; 1/6 tarefas fechadas). Este pacote não fecha um critério adicional.

Aplica o desenho já autorizado e TDD: primeiro instalar os tipos e o teste contra o comportamento
existente; observar assertions RED; só então aplicar a proposta after-red. Não há RED ou GREEN
executado neste pacote. Os testes só exercitam apresentação: não provam autenticação, permissões,
cache HTTP, noindex, Page reauth, isolamento de RSC ou acesso a mídia. Essas provas continuam nas
frentes Native/transporte/HTTP do root. Este pacote é separado de preview-transport-source.

## API completa para readPrivatePageModel

```ts
// src/config/portfolio-presentation.ts — type-only, nenhuma seleção de dados
interface PortfolioPresentation {
  locale: Locale;
  profile: ProfileDTO;
  navigation: NavigationDTO; // DTO de entrada, não navegação resolvida
  cases: CaseCardDTO[];
  featured: CaseCardDTO[];
  routes: { caseId: string; locale: Locale; path: string }[];
}

// src/features/site-navigation/contracts/navigation-presentation.ts
// Exportado apenas como type pelo index público da feature.
type NavigationPresentation = ResolvedNavigationDTO | PreviewNavigationPresentationDTO;

// Props exportadas do frame, consumidas apenas na composição servidor
interface PublicPageViewProps {
  locale: Locale;
  kind: 'home' | 'cases' | 'about' | 'case';
  portfolio: PortfolioPresentation | null;
  detail?: CaseDetailDTO;
  status?: 200 | 404 | 410 | 503;
  languageControl?: ReactNode;
  mediaMode?: 'published' | 'preview';
  targets?: { home: string; cases: string; about: string };
  navigationOverride?: NavigationPresentation;
  resolveLink?: CaseLinkResolver;
}
```

PublishedPortfolio é um superset estrutural e continua aceito sem conversão, sem nova geração,
sitemap, count ou canonical inventado. A composição privada monta PortfolioPresentation apenas
com DTOs dos getters autorizados, usa CaseCard/Detail.path e routes já privados, mediaMode preview,
targets pelo builder fechado, resolvePreviewNavigation real e callback servidor com o resolver
privado de contextual links. Native document, req, payload, sessão e grants não entram nas props.
As três props são seams de composição; não substituem validação/autorização na entrada ou Page.
Não passar callback pelo limite cliente: CaseDetail permanece componente servidor; MobileMenu
recebe somente os destinos/labels já resolvidos, como antes.

## Instalação antes do RED — responsabilidade do root após o gate

Copiar os arquivos nos caminhos abaixo, preservando outras alterações eventualmente posteriores:

- install-before-red/src/config/portfolio-presentation.ts → src/config/portfolio-presentation.ts
- install-before-red/src/features/site-navigation/contracts/navigation-presentation.ts → mesmo caminho
- install-before-red/src/app/(portfolio)/_components/public-page-view.preview.test.tsx → mesmo caminho
- install-before-red/src/app/(portfolio)/_components/public-page-view.tsx → mesmo caminho; esta versão
  troca apenas tipos/Props, mas IGNORA deliberadamente as novas props no runtime existente.
- Aplicar navigation-types.patch.txt: export type adicional e apenas type-imports/annotations de
  SiteHeader/SiteFooter/MobileMenu. Os três arquivos completos no diretório são referência da mesma
  mudança; não copiar cegamente sobre modificações posteriores do agente de leitura.

site-navigation-index.patch.txt contém a mesma linha export type como alternativa de merge; não
aplicar duas vezes. Nenhum novo runtime export de cases/server é necessário: o teste utiliza o
resolvePreviewNavigation real já público e um callback literal do tipo CaseLinkResolver.

Depois executar no app:

```text
pnpm exec vitest run --project unit "src/app/(portfolio)/_components/public-page-view.preview.test.tsx" "src/app/(portfolio)/_components/public-page-view.test.tsx"
```

São onze casos privados escritos (quatro shell/PDF, Home, About/list, callback do case e quatro
rasters) e os seis casos públicos existentes, sem alterar estes últimos. Esperado no baseline:
assertions de href privado/PDF/callback falham pelos destinos públicos ainda existentes. Os casos
de raster podem passar porque mediaMode preview já existe. Falha de import, setup, transformação,
serviço ou resolução de fixture não é RED comportamental. Guardar log/JSON e o motivo exato.

## Somente após observar RED real

Aplicar after-red/public-page-view.patch.txt, comparando com after-red/public-page-view.tsx.
O patch só consome targets, navigationOverride e resolveLink: usa a navegação resolvida recebida,
se presente, e conserva resolveNavigation e os destinos públicos como defaults. Não altera DTOs,
seleção, CSS, JSX de Header/Footer/MobileMenu, métricas do header, foco, reading keys ou idioma.
Os testes públicos originais permanecem sem mudança; usar a cópia reference-baseline só para
comparação. Depois executar o mesmo comando, tipagem/lint/format focados e as provas que root
julgar necessárias. A versão after-red é proposta não instalada e não verificada.

## Referências e integridade

reference-baseline contém fontes inspecionadas com newline LF normalizado. source-e-sha256.json
registra hashes dos bytes originais de E no momento da autoria, inclusive o teste público original;
sha256.json registra os bytes deste pacote em C. Não instalar reference-baseline. Se o source hash
mudar, reaplicar só as alterações mínimas sobre a nova fonte, preservando o trabalho alheio.

Não há páginas/layouts/modelo privado, auth/transporte, nova rota, Next config, conteúdo CMS,
publicação, canonical/sitemap, Download de imagem ou fixture visual neste recorte. Todos os18
frames/textos já obtidos ficam na frente de conteúdo do root, sem cópias inventadas neste pacote.
