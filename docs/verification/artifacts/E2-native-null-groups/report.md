# Accepted null groups — Native boundary fix

The real visual bootstrap exposed an accepted-input defect: strict profile schemas allow null named groups, but installed Payload3.92.1 traverses `null` as an object during beforeValidate. A child field dereference throws TypeError before normal validation. This affects both creating null groups and clearing existing ones; it is not fixed by omitting fixture fields.

## Implementation and API

`src/helpers/payload/encode-native-group-clears.ts` exports:
`encodeNativeGroupClears<T extends Record<string, unknown>>(data:T, fields:readonly Field[]):T`.

`validatedWrite` invokes it only after the existing strict `validateInput` succeeds, using actual sanitized `collection.fields`. An explicitly null named group becomes complete declared child clears: checkbox false, arrays/blocks empty arrays, other persisted leaves null; nested groups are cleared recursively. Omitted fields are untouched; scalar/upload nulls are preserved. Groups within array/block rows and layout fields are traversed. Virtual/UI/join fields are not fabricated during group clearing. No originalDoc merge, schema widening, ACL bypass, publication mutation, Payload patch or new dependency is introduced.

The generated Local API document type describes groups as objects rather than nullable groups; the Native test deliberately casts only the accepted wire payload containing null groups. The strict runtime input validator remains the authority. Technical Media receipts use typed `db.findOne<Media>` and direct assertions, preserving helper→feature import boundaries.

## TDD observed

- Unit callable stub RED:4fail2pass/6, exit1, `.work/E2-native-null-group-unit-red.txt` + result JSON.
- Adjacent Native RED before production changes:2fail2pass/4, exit1, `.work/E2-native-null-group-native-red.txt` and `.work/E2-native-null-group-red-result.json`. Setup/account/media succeeded. Exact failures: null reading name during create; null reading media while clearing a populated image group.
- Unit GREEN/final:6/6, exit0; `.work/E2-native-null-group-unit-green.txt`, `-unit-final.txt`, `-focused-final-result.json`.
- Adjacent Native GREEN final:4/4, exit0,2.72s; `.work/E2-native-null-group-native-green.txt`, `-green-result.json`. The earlier successful four-test attempt was repeated after test-only typing/import corrections; the runner reused the GREEN filename. Both successful command outputs remain in tool history. All failed raw logs are retained unchanged.
- Full `pnpm exec tsc --noEmit`:exit0, `.work/E2-native-null-group-typecheck-final.txt` + result JSON.
- Focused ESLint/Prettier:exit0, `.work/E2-native-null-group-{lint,format}-final.txt` and focused result JSON.

Initial focused checks failed on generated Local API null-group types, generic db receipt typing and one helper test feature-schema import. These test-only issues were corrected without changing production behavior. Initial check logs/result are retained; no setup failure is used as the behavioral RED.

Four Native tests prove: accepted null groups create through real protected Native APIs; clearing populated seo.image removes media/alt/caption and retires actual draft media usage while retaining unrelated SEO title; stale observed revision rejects409; omitted image preserves the original and current draft usage; unknown fields reject through strict ValidationError and the saved draft is retained. Root remains absent in this isolated unconfirmed fixture. Ordinary `.integration.test.ts` discovery means the tests also run later under normal CI/global setup.

## Dedicated database and lease

Pinned Node24.22.2. A new database `adfl_test_null_groups_a2_001` was created within the existing `a-design-for-life-local-postgres-test-1` container. Official Payload migrations exited0. A C plain-object Vitest config reuses normal E aliases and `testing/setup/integration.ts`, with NO globalSetup/teardown. Test database/bucket are exact fixed dedicated values; no Docker up/down/rm, volume operation, database drop or visual-data cleanup was run.

The pre-existing visual database `adfl_test_visual_a2_20261031_001` remained present. Read-only verification during this lease observed7media,2cases and0profile/navigation/case-content/publication operations. Container ID was checked unchanged around setup and both Native runs. New null-group database and its own test media remain for root review; no attempt was made to delete them. The service was intentionally kept alive so root retains visual state.

Native lease returned explicitly before final source checks. Root may resume bootstrap/Next/visual work. This agent did not run Next/build/full suite, and this fix adds no stage-progress credit itself. Actual visual loader replay and its idempotent fingerprint adapter remain a separate root/loader-agent integration proof.

## Frozen sources

Four source files are copied under `null-group-source/frozen`; `sha256.json` records their exact hashes. Runtime helper+validatedWrite were frozen before returning the lease; subsequent changes affected only the Native test's typing/import assertions, followed by its real GREEN repeat. No production edits followed the handoff.
