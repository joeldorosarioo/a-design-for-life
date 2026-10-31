# E2.3 Cases UI — implementation handoff

Stage 2 remains 16.7% (1/6 plan tasks complete). This is a component handoff, not completion of E2.3 or A2.

Implemented 15 new files confined to Cases components (eight modules and five adjacent tests), feature stylesheet and public ui.ts. No app/config/routes, Native fields, schemas, migrations, shared helpers, dependency/lock, index.ts/server.ts or Git edits by this task. Root owns the HTTP/Pages/Proxy/SEO composition and captured PublicRoot operations.

## Behavior

- CaseGrid reuses ordered public CaseCardDTOs for Home, without listing opening/count. Card titles always link to the DTO path. Nonblank editable CTA is optional; confirmed legacy content with a null label keeps a named title link and full body.
- CaseList composes published listing copy, supplied home destination/label, cases.length plus supplied countLabel, and the same grid. Empty and failure content are distinct and supplied from approved published messages. CaseState renders root-selected copy and safe links; it does not select or emit HTTP status.
- CaseDetail renders title parts, introduction, cover/context note, public role/scope, and sections/blocks. Contents derives from effective sections, never stale independent contents. UUIDs remain data-reading-key on sections/blocks and section anchor IDs.
- Tiny client CaseContents receives only label and readingKey/label/anchor entries. Native anchors support current hash/history and active aria-current from an intersection observer. Other rendering remains server-default; whole DTO/Root and link callback never enter the client island.
- Closed rich text renders paragraphs, nested ordered/bullet lists, line breaks, bold/italic and typed links resolved by composition. Null target preserves formatted text without an anchor as explicitly approved for unavailable current-locale case links. New-tab destinations include the supplied accessible indication and noopener noreferrer. No raw HTML.
- Three block types retain editorial order. Comparison is two text cards from the section preset; process and learnings keep fixed presentation. No invented metrics, professional copy or new animation.
- Next.Image uses one original: published /media/{id}/original; preview /preview-media/{id}/original with unoptimized. Informative/decorative alt and plain captions come from public ImageUseDTO. Cover/card/pair dimensions are reserved; sizes match existing fluid portfolio-container and actual grid/sidebar widths. Only detail cover is eager/high priority. Static approved dividers use public/figma source files through Next.Image unoptimized, preserving their dimensions rather than inline/redrawn paths.

## Public UI entry

src/features/cases/ui.ts exports CaseCard, CaseGrid, CaseList, CaseState, CaseDetail, CaseContents, CaseSection, CaseText, CaseImage, CaseImagePair and their useful prop/types. Public index.ts remains pure contract-only.

CaseDetail accepts caseDetail, projectsHref, labels {back,contents,role,scope,newTab}, resolveLink and optional mediaMode. Resolver signature is (ContextualLink) => {href,newTab?} | null, bound by composition to the captured generation. CaseGrid/List caseLinkLabel is string|null; root normalizes absent legacy value to null. Count label comes from existing navigation controls.casesLabel, per coordination.

## Fresh focused verification

Portable Node 24.22.2; cwd E:/a-design-for-life. Final unit command:

`node node_modules/vitest/vitest.mjs run --project unit src/features/cases/components/case-contents.test.tsx src/features/cases/components/case-text.test.tsx src/features/cases/components/case-image.test.tsx src/features/cases/components/case-list.test.tsx src/features/cases/components/case-detail.test.tsx`

- Final authoritative run: exit 0, 17/17 tests in five files; E2-cases-unit-final-authoritative.log.
- Targeted ESLint of the eight named component modules/tests plus ui.ts: exit 0, no errors or warnings; zero stdout so Tee-Object did not create the named delivery log. The tool execution transcript records exit 0. Initial static img warnings in E2-cases-lint.log were removed by consuming the original vectors with Next.Image; this is not a claim about the wider repository lint.
- Final Prettier --check of all 15 files: exit 0; E2-cases-format-delivery.log.
- Source SHA256/byte manifest: E2-cases-ui-source-hashes.json (15 files).

Raw assertion REDs retained: contents3, rich text4, images3, list3, detail3; legacy title-link regression2; sizes/container regression1. Each corresponding component was callable at RED, rather than failing due to missing imports. Text first-green attempt caught missing separation in the accessible link name (1 failure), fixed and rerun. A Vitest wildcard filter produced no tests; raw E2-cases-unit-green.log is retained as a command error, never counted as coverage. First Vite cache write failed under sandbox (EPERM); focused commands were rerun with the allowed cache-write escalation. That first startup output remains in the tool transcript rather than a separate file because the RED filename was reused for the actual assertion run.

Rejected banner diagnosis: root initially requested outer div to section and a whole-tree RTL banner assertion. Test reproduced two queried banners, but remained red after the section candidate. Root then checked the primary HTML/ARIA rule and withdrew that diagnosis as a testing query/context issue; the candidate and invalid regression were reverted. E2-cases-list-banner-red.log and E2-cases-unit-delivery-banner-fixed.log preserve those rejected attempts; neither proves a browser accessibility defect. Root handles scoped composition queries and actual browser accessibility inspection.

No typecheck, full test suite, architecture suite, Next server/build, DB, Docker, E2E or Git was run by this task. The coordinator must include this snapshot in combined verification. Focused success does not establish global success.

## Visual reference and remaining acceptance

Actual original PT Case/list desktop/mobile frames were viewed inline in the normal authenticated Figma editor, using supported dedicated Chrome tabs after IAB was unavailable in this agent. No asset export/download, screenshot file/version, cropped image or duplicate original was made. Current normal-editor properties additionally confirmed mobile detail opening padding24/gap32, cover342x192, listing opening padding24/gap24, and single-line title boxes48high. Existing high-fidelity Case desktop context supplies cover1280x480 contain on Cherry700, reading width768, article1008, TOC208/gap64 and preset typography/composition. One original image per asset stays intact.

Rendered public-page comparison remains pending: four list frames, four detail frames, second EN example, tablet/zoom/long copy, keyboard/native hash/history, real section intersection, image delivery/optimizer access and source revocation, browser AX, actual HTTP statuses and metadata. Root integration must validate required labels/captured-root consistency and the same-generation resolver. No A2 pixel-match or WCAG completion claim is made.

Case source is frozen after the final run/manifest pending coordinator feedback. Ordinary source/output artifacts are in this chat work folder; no application service is running from this task.

## Coordinator-requested observer fixture follow-up

The root typecheck exposed a partial IntersectionObserverEntry assertion in case-contents.test.tsx. The fixture now supplies real DOMRect values, all required entry fields and a typed complete observer object. Its authorized focused rerun passed17/17 in five files, exit0: E2-cases-unit-observer-fixture-green.log. The15-file source hashes were refreshed afterward. This changes test support only and is not global typecheck/build evidence.
