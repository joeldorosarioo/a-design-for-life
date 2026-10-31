# E2.6 — projeção pura de metadata entregue

30/10/2026. **Etapa2:16,7% (1/6)**. Somente `src/config/build-localized-metadata.ts` e teste adjacente foram criados nesta tarefa. Fonte congelada em `E2-seo-helper-frozen/` com SHA256 conferido. Não houve alteração de Pages/rotas/configuração/DTOs, DB, Next/build, Git ou gate global por este agente.

## Interface final

```ts
buildLocalizedMetadata({
  locale,
  page: {kind:'home'|'cases'|'about'} | {kind:'case',path},
  origin,
  profile: ProfileDTO | null,
  detail?: CaseDetailDTO,
  publishedAlternates: Partial<Record<Locale,string>>,
  indexable: boolean,
  status?: 200|404|410|503,
}): Metadata
```

`LocalizedMetadataInput` é exportado. O helper é uma projeção pura de DTOs já confirmados; não lê ambiente, filesystem, raiz, CMS, rede ou relógio. A composição Root continua responsável pela seleção/autorização da geração e por vincular alternativas de case à mesma identidade permanente.

- Canonical próprio: /pt e/en, /pt/cases e/en/cases, /pt/sobre e/en/about; case usa exatamente o caminho validado da própria tradução. O helper nunca acrescenta EN por presunção nem fixa tudo em PT.
- Alternates contêm somente chaves PT/EN efetivamente fornecidas. Origem externa, caminho de outro locale/tipo de página e self-alternate contradizendo canonical são erros. Para case estrangeiro o helper valida estrutura/locale/slug; a prova de mesma identidade pertence ao chamador, que fornece os paths do mesmo root/caseId.
- Origem HTTP(S) precisa ter só autoridade: sem credenciais, caminho, query ou hash. Não existe domínio final padrão. Testes usam apenas origem controlada de loopback.
- Título/descrição usam SEO editorial e depois heading/description da própria Home/list/About. Home combina título e ênfase publicados; case usa seu título/summary. Não há preenchimento de profissão, nome de outra página, texto de outro idioma ou copy inventada. Campos sem copy ficam undefined.
- OG usa type website, URL própria, mesmo título/descrição e somente imagem original `/media/{mediaId}/original`. Caso usa SEO image e depois cover; páginas estruturais usam a imagem SEO do perfil. Alt vem do próprio DTO. Não gera/baixa arquivos ou variantes.
- status404/410/503 sempre usa título técnico localizado, description:null, robots noindex/nofollow e alternates/openGraph/twitter:null para limpar metadata editorial herdada. Status200 com indexable:false também tem noindex/nofollow, preservando canonical próprio e alternativas fornecidas; esse é o contrato de local/staging/preview combinado com o root.
- Caso200 pode existir com profile:null, preservando independência A1. Caso200 sem detail, DTO de outro locale ou detail.path divergente é erro. Estados negativos não usam conteúdo editorial de profile/detail.

O helper entrega strings de texto ao Metadata API, sem montar HTML nem fazer escaping manual duplicado. A renderização/escape efetivos no HTML pertencem ao Next e serão verificados no gate integrado; o unitário verifica que as strings permanecem dados, não HTML previamente serializado.

## RED/GREEN e checks

| Artefato em stage2-briefs | Resultado |
| --- | --- |
| E2-seo-helper-red.txt / red-assertion.txt |25 falhas/21 recusas já satisfeitas pelo scaffold; assertion explícita de geração sem erro e canonical/alternates antes da implementação |
| E2-seo-helper-green-final.txt |**46/46**,1 arquivo, exit0 |
| E2-seo-helper-lint.txt |ESLint dos2 arquivos, exit0 |
| E2-seo-helper-format.txt |Prettier dos2 arquivos, exit0 |
| E2-seo-helper-typecheck.txt |TypeScript no-emit/sem incremental com raízes somente nos2 arquivos, exit0 |

Cobertura: publicação PT sem EN, self-canonical PT/EN das quatro famílias, equivalência fornecida, fallback próprio, copy ausente sem invenção, imagem original, texto contendo caracteres HTML preservado como string, estados negativos localizados e noindex de ambiente; recusas de origin/path/alternate/DTO inválidos. Não se afirma sitemap pronto, HTML SSR medido, indexação, ranking, CDN, preview autenticado ou aceite A2.

## Referências consultadas

Lidos E2.6 aprovado integralmente, spec10.1 e trecho E2.6 do plano; skill SEO. [Metadata API oficial Next](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) confirma a composição por Metadata, metadataBase, alternates, OG e robots; a seleção editorial/publicação e as restrições de idioma vêm dos contratos aprovados do projeto. Não se interpretou documentação de SEO como autorização para inventar domínio ou anunciar tradução privada.

SHA256 produção: `97089DF6490DF219E2651855EB6E267C06C9E8C0B3D320388223054DCE8CDB10`.
SHA256 teste: `12E6A3899B9B59A8A7FC540B2320D804729097F6FF626132E214ECB78C270B49`.

Root foi avisado do freeze antes de iniciar seu build real do optimizer. A partir desse aviso este agente não fez novos runners nem escritas em E:.
