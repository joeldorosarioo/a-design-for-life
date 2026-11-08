# Portfolio architecture

Next.js and Payload share one application. PostgreSQL stores editorial data, the file store holds media, and a private publication volume holds confirmed generations. Public routes compose feature presentation contracts. Architecture checks enforce feature entry points and keep server-only data access out of the browser.

## Editorial model and concurrency

- `cases` holds shared project identity, ordering, and featured status. `case-content` holds one editorial document per project and locale. Navigation and professional profiles publish independently by locale.
- Draft saves, publication, withdrawal, and restoration use native Payload operations guarded by revision and lease. PostgreSQL enforces identity and route uniqueness. A stale revision or competing slug produces an explicit conflict. Restoring a historic version creates a draft. Published navigation and profiles are protected against withdrawal.
- A route reservation belongs to one project and locale. Explicit saves reserve slugs. Historical public slugs redirect to the current slug in one hop. A withdrawn public route returns 410. An unknown or private-only route returns the same 404. A required unavailable dependency can produce 503.
- The signed-in preview reads private draft content and media through authenticated requests with no shared cache. The public edition reads confirmed content. [CMS contracts](specs/2026-10-29-portfolio-contratos-cms.md) · [Editing guide](runbooks/cms-editorial.md)

## Publication and rendering

The native write stores a durable publication intent in the same transaction. After commit, a serialized coordinator confirms the complete public generation and reconciles the receipt. Public requests capture `current.json` once and use the same generation for content, metadata, route history, and public media. Private render snapshots pin the captured generation for consumers in separate request graphs.

Readers see the previous confirmed generation while an update is pending. If the root advances before SQL acknowledgement, retry reconciles the same intent. An older attempt cannot replace a newer confirmed generation. Persist the private publication directory across restarts and preserve it in backups. [Operations](runbooks/lancamento.md#publication-and-health)

## Media and private access

The server validates upload bytes and builds responsive derivatives. Static JPEG, PNG, WebP, and AVIF are accepted up to 10,000,000 bytes. WebP animation is preserved. Animated PNG and AVIF and SVG uploads are rejected. PDFs up to 5,000,000 bytes must open without an opening password. Public original and derivative access follows a confirmed reference. Withdrawal of the last public reference revokes access.

The Payload dashboard uses native authentication and password recovery. R2 credentials, storage roots, and publication snapshots stay outside public paths. [Security evidence](verification/evidence-index.md#security)

## Presentation and design

Figma supplies the layout, tokens, and asset references. The public interface uses Tailwind, CVA, and shadcn. English and Portuguese have separate content and canonical URLs. Language changes preserve an equivalent reading position where a shared section exists. Missing equivalents use the approved fallback and notice. [Figma inventory](specs/2026-10-29-portfolio-inventario-figma.md) · [Product spec](specs/2026-10-29-portfolio-spec-v1.md)
