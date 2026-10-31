# E2.3 Cases UI — preparation and implementation plan

Status: read-only app preparation. Stage 2 remains 16.7% (1/6 completed); E2.3 not started. Root coordinator owns the current global verification gate and releases app edits/tests explicitly.

## Authorized scope and sources

Use approved A1/stage 2 spec, Figma inventory, CMS contracts, implementation plan, AGENTS and stage ledgers in E:/a-design-for-life. The approved E2.3 task brief and official high fidelity PT desktop context are in this chat workspace. User has already approved design and normal Figma editor fallback after MCP quota; do not repeat product interview.

Application edits after release are limited to src/features/cases/components/{case-card,case-list,case-detail,case-section,case-text,case-image,case-image-pair,case-contents}.tsx and adjacent component tests, cases/stylesheets/*.module.css and cases/ui.ts. No app routes/config, schema/Native fields/migrations, shared helpers, dependencies, locks, DB/Docker/build/Next/global verify/E2E/Git. Root owns public HTTP statuses, captured PublicRoot, Proxy/Pages replacement, SEO and composition.

## Composition boundary

- `CaseCard`: public CaseCardDTO, editable CTA label, optional heading level, closed published/preview media mode.
- `CaseList`: ordered CaseCardDTO[] supplied by composition, editable CTA label and empty title/description. Count is cases.length (locale/publication filtering remains the validated captured Root operation). No local sorting or CMS read. May expose list-only presentation for Home and list page composition.
- `CaseDetail`: public CaseDetailDTO, typed minimum labels `{ back, contents, role, scope, newTab }`, validated projectsHref and contextual-link resolver bound by root to the same captured PublicRoot. No document or Root object reaches client code.
- `CaseContents`: derived from effective sections (readingKey plus eyebrow/heading), never independent manually maintained contents. Anchor `section-${readingKey}` exactly matches article section id; optional unpublished/empty labels skipped coherently. Small client island is required by official Case contents documentation: native anchors with active state and aria-current updated from visible section/hash. Client props contain only stable readingKey/label/anchor entries; no whole case, Root or resolver callback. Preserve native keyboard/history navigation, 44px targets and immediate native scrolling without animation.
- `CaseSection`: closed narrative/process/comparison/learnings preset, all editorial blocks rendered in input order. Comparison is TWO text cards from the two text blocks already validated at publication, never image metrics or fabricated results.
- `CaseText`: closed rich-text contract inferred from CaseDetailDTO text content; render paragraphs, bullet/number lists, line breaks, strong/emphasis bitmask, contextual links. No raw HTML. Resolver returns `{ href, newTab? } | null`; absent target renders child text. If a new tab is returned, use editable indication plus rel noopener noreferrer.
- `CaseImage` and `CaseImagePair`: ImageUseDTO only, plain captions and explicit decorative alt. One original `/media/{mediaId}/original`, Next.Image width/height or reserved fill container, sizes aligned to real layout; preview sets unoptimized and retains authenticated source access. No extra image versions or downloads.
- `CaseState` may live in case-list/detail module if needed: approved published Navigation messages for empty/404/410/503 and safe composition-provided links. Actual status/cache/metadata remain root responsibility. No private error/correlation metadata.

The callback type proposal has been sent to root for agreement. It stays server-side and synchronous if root precomputes available destinations from its captured Root. No slug translation, fresh CMS reads, or server callback serialization into client island.

## Visual authority and layout

Official existing PT desktop detail context confirms 1280px opening cover on Cherry 700, 480px high with object-fit contain, opening spacing 48px, desktop title 72/72, editorial serif emphasis, article 1008px beside 208px TOC and 64px gap, prose 768px. Existing inventory confirms desktop two-card list and one-column mobile. Mobile TOC is two columns before article; use fluid layout with 24px gutters, desktop 80px at 1440 and max width 1280, responsive intermediary widths and no fixed page heights. Card slot 624x352 uses CSS crop. Shared tokens and existing button primitive are required. Approved static dividers use public/figma assets rather than inline paths/redraws.

Existing local baseline files cover Home/About only. On 2026-10-30 this agent viewed actual normal-editor screenshots of original PT detail desktop 123:838 (1440x4654), PT detail mobile 123:954 (390x5848), PT list desktop 125:2472 (1440x1638) and PT list mobile 125:2595 (390x1770). Supported IAB entry returned unavailable; a dedicated Chrome session tab opened the authenticated Figma editor successfully. Screenshots were viewed inline at fit-to-selection zoom; no screenshot files, asset downloads, exports or duplicate image versions were created. They prove visual reference inspection, not pixel acceptance. List title is serif, desktop list uses two columns and mobile one; cards read cover, eyebrow, title, summary, CTA. Detail mobile places two-column TOC ahead of article; comparison stacks text cards in editorial order. Full four-frame list/detail and second EN case comparison remains A2 acceptance evidence. Save at most one original PNG per frame if useful later; never use a page screenshot as a code asset.

## Test-first sequence after release

For each behavior create callable placeholder only as necessary to obtain a genuine assertion failure; import/runtime errors do not count as RED. Preserve command/output evidence in chat work directory, not a fabricated pass statement.

1. TOC tests with reordered arbitrary UUID sections: links and ids match only effective received sections; no five hardcoded labels; native hash navigation and observed visible section update aria-current, initial hash is respected, event/observer cleanup occurs, and stale entries cannot remain current after reorder/removal.
2. Card/list tests: stable input order, real count, correct DTO destination and editable CTA, one locale's supplied data, empty state distinguishes an explicitly empty list from unavailable error state, safe escaped text and headings.
3. Text tests: paragraph/list/nested-list order, line breaks and bold/italic combinations, typed external/page/case/resume/contact destinations, missing target stays text, new-tab indication/rel, malicious plain content stays text.
4. Image tests with real Next.Image component: single original source path, explicit informative/decorative alt and escaped caption, reserved dimensions/sizes, preview bypass; pair images preserve editorial DOM order and labels. No mock-image test IDs.
5. Section/detail tests: title parts, role/scope/context note, UUID data-reading-key on sections/blocks, three block types, closed presets and comparison two text cards, reordered sections update TOC/reading identities.
6. Focused green unit run for changed files; targeted eslint and prettier. Root runs combined typecheck/architecture/full tests/build/E2E and visual comparison after integration. Report partial coverage and any errors without claiming global success.

## Remaining coordination

- Root accepted the server callback boundary; no callback goes to client. User approved unavailable contextual case target in current locale => preserve child text without link, separately from language-switcher list + toast behavior. Root records this business decision and owns its captured-Root resolver. Required labels remain validated at composition.
- Root releases app mutations/focused tests after its gate.
- PT original Case/list screenshots have now been viewed directly; full A2 visual comparison remains pending.
- Root composes listing copy from ProfileDTO.listing and count labels where available; no invented professional text or new CMS fields by this task.


