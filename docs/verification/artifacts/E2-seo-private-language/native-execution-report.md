# SEO confirmed public index — authorized Native execution

Executed 2026-10-30 under root's explicit exclusive PG55433 lease. Only these application files changed:

- `src/config/read-public-index.ts`
- `src/config/read-public-index.integration.test.ts`
- `src/app/(portfolio)/sitemap.ts`
- `src/app/(portfolio)/robots.ts`

Node was the repository-pinned 24.22.2 executable. No Next process, HTTP test, application build, global verification, Git operation, schema/field/helper change or original asset copy occurred in this lease. The isolated integration global setup ran official migrations and created only `postgres-test` on port 55433; its teardown stopped and removed that container. Ports 5432 and 55432 were not targeted. The Native lease was returned immediately after GREEN; subsequent checks did not access Native.

## Test-first evidence

The initial callable reader stub returned `{pages:{pt:false,en:false},cases:[]}`. The first actual assertion failure proves that an independently confirmed real Native PT case was absent from that result; no import or syntax failure is counted as RED.

Two preliminary setup failures are preserved separately and are not behavioral RED: default-shell Docker named-pipe permission denial (`native-setup-permission-failure.log`), then the installed Vitest 5 API rejecting removed `describe.sequential` (`native-setup-vitest-api-failure.log`). The owned suite now uses supported `describe(name,{concurrent:false},fn)`; the integration project already has file parallelism disabled.

The first executing suite also exposed an invalid fixture assumption: confirming EN Nav while EN Profile was private. The actual `navigationPublicationAdapter.apply` rejects publication without a confirmed Profile of the same locale. This product invariant was preserved. That full first run remains `native-first-assertion-red.log`; only the fixture sequence changed. Both EN structural documents stay private in the PT-only positive scenario, and both are genuinely confirmed in dependency order before the complete-root scenario. No claim is made that the impossible state was demonstrated through Native.

With fixture ordering corrected, the callable stub produced **5 assertion failures / 1 pass**, exit **1** (`native-red.log`). The minimum reader implementation then produced **6 passed / 0 failed**, exit **0** (`native-green.log`). The original draft-invariance check's pass against the empty stub is not independent proof; its useful positive assertions are established by the complete GREEN run.

## Behaviors demonstrated by the six real Native tests

1. Standalone confirmed PT case remains indexable while structural pages are never public; private EN case/alternates are absent.
2. Confirmed PT Profile/Nav make PT structural URLs eligible while EN remains private. Actual Native count metadata classifies missing EN Profile; Native body `find`/`findByID` calls are absent during this reader operation.
3. Genuine later Native draft edits to Profile text and the PT case slug leave the captured Root, index and sitemap output unchanged.
4. A complete captured Root continues to return its original case coverage after a newer real publication advances current. The complete positive path invokes the Native factory zero times. New Root case alternates include both actually confirmed translations.
5. Removing a real published structural subject from a clone of actual captured Root, while its actual Native public intent remains, throws unavailable instead of pretending never-public.
6. Null/malformed Root, duplicate structural locale, corrupt case subject and missing case aggregate throw; they never become an empty successful index or Native-body fallback.

The fixture uses real synthetic media/document publication, not Figma or professional claims. It preserves existing cases and verifies their ID/order/featured metadata at teardown. Structural cleanup verifies the exact four owned IDs before using existing guarded cleanup. Own acquired leases are released in `finally`.

## Installed composition

`readPublicIndex(root)` validates envelopes and uses only feature server getters with the same caller-supplied Root. Profile remains the first page dependency. Absent never-public structural owners use the existing metadata-only classification; present but invalid confirmed bodies throw. The complete positive path initializes no Native factory and never selects current.

Both natural metadata entries are in the `(portfolio)` route group, retaining external `/sitemap.xml` and `/robots.txt` paths. Both declare `force-dynamic`. Production sitemap reads current Root exactly once, requires valid coverage, then projects strict `{caseId,locale,path}` inputs into the unchanged builder. Nonproduction returns the builder's explicitly nonindexable output without Root/Native. Robots reads runtime origin/environment policy only and has no Root/Native dependency.

## Verification and limits

- Native integration file: **6 passed**, exit 0.
- TypeScript `tsc --noEmit --incremental false`: exit 0 (`installed-typecheck.log`).
- ESLint restricted to the four owned files: exit 0 (`installed-lint.log`).
- Prettier write restricted to the four owned files: exit 0 (`installed-format.log`); changes after Native GREEN were formatting only.
- Installed exact source hashes: `installed-source-hashes.json`; exact private copies have `.installed.ts` names, with the current test retained as `read-public-index.integration.test.ts`.

Actual sitemap/robots HTTP status, cache, XML/text, conditional/HEAD and production Next transport remain for root's next gate. No E2.6 task/checklist closure is claimed by this source/Native result. The previous authorship-only files and evidence are preserved as historical records.
