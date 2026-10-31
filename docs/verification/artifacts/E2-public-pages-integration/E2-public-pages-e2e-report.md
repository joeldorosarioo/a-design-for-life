# Public pages E2E — authored handoff

Stage 2 remains 16.7% (1/6 complete). This handoff contains authored test source only. No E2E, DB, Next server/build, Git, dependency change, or global verification was executed by this task.

## Files and reusable fixture

- E:/a-design-for-life/src/app/(portfolio)/[locale]/public-pages.e2e.test.ts
- E:/a-design-for-life/testing/fixtures/public-portfolio.ts
- SHA256/byte manifest: E2-public-pages-e2e-source-hashes.json in this work directory.

API: createPublicPortfolioFixture(key, { serialRunner }) returns the real editor fixture (payload/user/request), namespace, readingKeys, locales.pt/en (expected labels, paths, separate resume IDs/hrefs), cases.first/second/ptOnly (permanent ID and per-locale content ID/path/title/publication flag), and destroy(). Intended for the public-page journeys and later E2.5 reading-context tests.

Caller checks testInfo.config.workers === 1 and !testInfo.config.fullyParallel before passing serialRunner. The helper also guards APP_ENV=test, database pathname /adfl_test_*, local ports5432/55432 excluded, and the isolated publication directory. It calls the existing guarded clearStructuralFixture under explicit coordinator authorization, resetting only the four structural singleton fixtures and their structural usages/subjects. All unknown cases and their ordering/publication remain intact. It does not change product leases, steal a lease, truncate tables or delete unrelated cases.

The fixture uses createEditorialPayloadFixture, real mediaMetadataFixture uploads (one image and separate PT/EN PDFs), profilePublicationFixture/navigationFixture/casePublicationFixture, observedRequest, real Native publication and confirmTestPublication. Every structural update releases its own acquired lease in finally. Failures destroy the Payload instance; afterAll destroys it on success. Structural publications are prepared first, then three shared cases (manual order intentionally differs from creation order), five published translations and one private EN translation. The private EN parent remains featured while its PT translation is public, exposing accidental publication/locale leakage.

PT/EN versions explicitly share section/block/trajectory/method reading UUIDs. Their synthetic paragraphs differ in number/height (case narrative6 vs22 paragraphs; profile sections2 vs9), giving later language-reading tests meaningful layout variation. All content identifies itself as synthetic test material and makes no professional claim. Figma content/assets are not imported or published.

## Six authored journeys (not executed)

1. PT public Home/About/list/detail in a browser context with JavaScript disabled: HTTP200, visible single h1 and expected SSR copy, four header links in fixed order, locale-specific resume ID plus new-tab indication/rel, and Contact targeting the current footer without changing pathname. Detail also checks native contents anchors and pair image editorial order.
2. Same SSR/links/anchors checks in EN.
3. PT list count equals actual visible card count; owned first/second cases preserve relative manual ordering even among unrelated fixtures; current DTO paths open via named title links; PT-only case appears; Home contains owned featured cases in order.
4. Same EN count/order/highlights checks, excluding the private EN translation from list, HTML and featured content; its direct route must be404 without private title disclosure.
5. PT mobile390 with reduced motion: real Tab/Enter opens menu; four destinations remain correct; Escape closes and returns focus; keyboard Contact closes dialog, keeps the case path and focuses/scrolls the current footer target.
6. Same mobile keyboard/focus journey in EN.

No exact total-case assumption is used. Assertions operate on owned fixture titles/paths, relative order and actual card count. No mocked CMS/backend or route-status request header is used; navigation must pass the real Proxy/captured-generation composition.

## Review/verification status

Written only, not RED/GREEN. The coordinator owns execution against the isolated real PostgreSQL/production Next process and any necessary existing-suite expectation updates. No lint/typecheck/E2E was run for the two authored files. After explicit coordinator release, the two files alone were formatted with Prettier (exit0), raw E2-public-pages-e2e-format-final.log. An initial sandbox formatter write returned EPERM; raw E2-public-pages-e2e-format.log is retained and the authorized scoped rerun succeeded. Root typecheck feedback identified FullProject.fullyParallel as unsupported; the authored test now reads FullConfig.fullyParallel as requested. Source is frozen for the coordinator production build.

Shared-suite observation was reviewed with root: existing route E2E expects legacy negative-response copy. Root clarified that the current negative Proxy deliberately still uses the pure A1 renderer and its fallback, rather than published Navigation.messages; no current regression is claimed. Published negative-state copy remains future A2 composition work. Existing route tests were not edited. A separate legitimate fixture teardown proposal below prevents structural fixture copy/leases from leaking into subsequent serial files.

## Separate owned unit-fixture correction requested by root

Root typecheck found an incomplete IntersectionObserverEntry cast in the earlier Cases UI test. This task completed real DOMRect/required entry fields and a typed observer stub, removing both partial casts. Authorized focused rerun passed17/17 in five files (exit0), raw E2-cases-unit-observer-fixture-green.log. The15-file UI source hash manifest was refreshed. This focused result does not apply to the new E2E sources or the combined repository. No global typecheck was run by this agent.


## C-only teardown proposal requested during the source freeze

E2-public-portfolio-teardown.patch is prepared in this work directory (SHA256836673FC87C4E5975B9D55BDFF4859F526835900857061B65845BBA3BECFE0BF). After the coordinator released the next write window, its teardown changes were applied to the current formatted fixture and the guard additionally rejects every nonlocal database host. No database/test execution accompanied the patch. The two authored files were formatted, then E: was frozen immediately for the coordinator run.

The proposal captures the exact four provisioned structural IDs immediately after existing guarded cleanup/ensure. destroy() then rechecks serial/test/database/publication guards, the same database/origin, and both collections having exactly their two owned IDs. Any ownership mismatch refuses cleanup while still destroying Payload in finally. Success calls the existing writer-protected clearStructuralFixture before Payload.destroy, preserving every case. Dispose is idempotent. Setup failures retain both original and guarded-cleanup errors rather than masking the first failure.

This is authorized test fixture isolation, not a product behavior change or a means of hiding an HTTP/content defect. It does not bypass leases, change the 300-second lease policy, alter application source or modify any database during authoring. E: remains frozen after the authorized patch application. Current two-file manifest SHA256:61F1AA5549EDFAF05D0DB93EFB613B413DD4B861D2049B00D84E1EDEEED69E23. The C-only patch remains the historical reviewed proposal; current source also contains the explicit nonlocal-host refusal.

