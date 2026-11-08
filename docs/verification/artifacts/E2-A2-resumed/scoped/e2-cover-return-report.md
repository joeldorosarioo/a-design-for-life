# E2 — closed cover presentation and independent return copy

Scope: remaining E2 reference corrections; no Stage 3 work, production, dependency change, commit or history mutation. Root retains the aggregate gate/A2 decision. Skills read: executing-plans, test-driven-development, writing-good-tests, verification-before-completion, vercel-react-best-practices and systematic-debugging. Existing approved spec/reference decisions remain authoritative.

## Reference and implementation

Source: private `work/stage2-briefs/E2-cases-visual-review.md`, items 3 and 9, plus canonical-assets.json. Case02 EN desktop has a complete pink1280x480 slot while current Case01 contain-over-cherry is explicitly correct. Detail return copy differs from the listing count noun. Neither bounded field existed before this work.

- `case-content.coverPresentation` is optional, with exactly `contained-cherry` / `contained-soft`, attached to each editorial locale document. Missing/null uses legacy cherry. Detail DTO/snapshot and authenticated preview preserve the choice; cards receive no new field. Arbitrary tokens, CSS/color strings and objects are rejected. Same original, contain fit, dimensions, sizes, caption, priority and private transport remain in CaseImage. Only the soft cover gets the CSS selector provided by the visual-corrections owner.
- `site-navigation.controls.backToProjectsLabel` is optional editable plain text. Listing count still uses casesLabel. Detail uses the independent nonblank return label, otherwise the exact localized Figma return copy. Optional absence/null/empty/whitespace does not prevent publication; the single validation exclusion applies only to this field, and missing required casesLabel remains rejected.
- Mapper heading-first TOC fallback was implemented from the other agent's observed RED. Actual heading wins when nonblank; otherwise actual eyebrow remains the fallback. UUID anchors/order remain unchanged.

No product clarification is needed for these two already evidenced, closed presentations and editable copy. This does not create an arbitrary layout control.

## Generated persistence

Official CLI generated `src/migrations/20261103_095414_e2_cover_presentation_and_return_copy.ts/.json`, migration index and Payload types. DDL: two closed enum types and four nullable columns (case current/version cover presentation; navigation current/version return label). No preexisting DDL/index/data/backfill alteration. Removed only unused generated argument bindings; Prettier formatting preserved the complete parsed JSON snapshot semantically. Historical legacySelect projections intentionally remain unchanged so earlier migrations never query future columns.

Applied only by this agent to the new technical DB `adfl_test_cover_return_20261103` on the inspected existing postgres-test loopback55433. No container start/stop/removal, visual DB mutation or teardown. Visual migration/v3 fixture application belongs to visual_fixture after explicit lease release. Ports5432/55432 untouched. No ordinary integration-global runner was invoked.

## Actual commands and results

Runtime: Windows/PowerShell, portable Node24.22.2, pinned pnpm12.10.1 / Vitest5.0.5, Payload3.92.1, PostgreSQL17.11. APP_ENV=test; synthetic isolated credentials and media bucket `adfl-test-cover-return`. No Analytics or screen reader launched.

| Command / evidence | Result |
|---|---|
| Four-file unit run before contracts (`unit-red.log`) | exit1;15failed/15passed, valid fields absent/rejected |
| After contract/mapping, before UI correction (`unit-after-contracts.log`) | exit1;5failed/34passed, real detail link still rendered count noun |
| Optional publication guard (`optional-publication-red.log`) | exit1;5failed, new optional copy incorrectly required |
| Seven-file focused unit run (`unit-green.log`) | exit0;47/47 |
| Migration chain before collection implementation (`technical-db-migrate-before.log`) | exit0 in new own DB |
| Native controlled config before collection implementation (`native-red.log`) | exit1;9 assertion failures: Native dropped unmapped fields, setup/import succeeded |
| generate:types / migrate:create (`generate-types.log`, `generate-migration.log`) | exit0, official artifacts generated |
| New migration in own DB (`technical-db-migrate-after.log`) | exit0 |
| Native focused after implementation (`native-green.log`) | exit0;9/9 |
| Final Native + real legacy pin/signed context (`native-final.log`) | exit0;10/10 |
| `pnpm typecheck` (`typecheck-first.log`) | exit0 |
| Scoped ESLint (`lint.log`) | exit0;0errors,1warning because explicitly selected generated payload-types.ts is ignored |
| Scoped Prettier (`format.log`, `format-final.log`) | exit0; generated JSON parse equivalence checked |

Controlled Native command: `pnpm exec vitest run --config .work/E2-cover-return/vitest.native.config.ts`, with TEST_DATABASE_URI selecting only the new own DB and TEST_MEDIA_BUCKET selecting only its namespace. This custom config uses the normal integration setup file but no globalSetup/Compose lifecycle. Tests remain adjacent in src and will also be discovered by the regular aggregate gate.

Final real Native checks include private content/versions/preview, anonymous preview refusal, confirmed publication independence PT/EN, draft edits and null clears preserving old Root, explicit republish fallback, invalid-input rejection without revision advance, and independent optional navigation publication. The legacy characterization starts from a real Native-confirmed case, removes only the optional field from its stored detail, validates SHA256 pin, prepares a signed200 render request and consumes it through readPublicRenderContext/getPublishedCase. It checks the stored projection remains unchanged, tampered HMAC is rejected and an explicitly invalid choice fails closed. That characterization is not presented as a newly observed preimplementation RED.

## Remaining coordinator checks

Root owns final build, full verify/E2E/CI, capture/geometry verification and A2. CaseImage variant CSS/CaseDetail prop are coordinated with visual_corrections; source is ready for root build. All ordinary global runners must continue respecting the preserved/restored visual base. No complete A2 or WCAG/P12 claim is made by this report. No commits created. The technical DB is intentionally left available for verification; provider temp roots are cleaned only by each test's own lifecycle.

## Scoped review fix — CVA ownership

Independent review identified that the closed image variants were conditionally assembled inside JSX. Reorganized CaseImage into module-scope typed CVA variants for kind/coverPresentation and a compound variant applying coverSoft only to covers. This is a structural refactor preserving the exact visual/authentication behavior. Focused actual CaseImage tests3/3 passed; Prettier and scoped ESLint exit0, no errors/warnings. Logs: cva-format.log, cva-case-image-green.log, cva-lint.log. Unchanged Native tests were not rerun. Root owns the combined rebuild/final gate; reviewer was notified for scoped re-review.
