# Audit fixes ? 14 November 2026

The user authorized the four repository-audit fixes. Work stays on `develop`.
The existing `next-env.d.ts` changes and two backup evidence files are preserved.
No deployment or production launch is part of this work.

## Changes

- Payload and private preview authorization use canonical browser origins. The
  raw configured `SITE_ORIGIN` still selects the same publication directory;
  existing content does not move to a different namespace.
- New local backup repositories, sets and completion markers stage outside active
  listings and publish by rename under the existing mutex. Retention validates
  every file before moving an expired set out of the active namespace. Partial
  working directories remain available for inspection; malformed pre-existing
  data is preserved and still rejected.
- Published case article/pair images receive dimensions from their pinned media
  manifests. Authenticated previews populate native media dimensions. Old
  snapshots remain readable, and media without dimensions uses a contained fixed
  slot. Cards and covers retain their existing presentation. No migration or
  dependency change is needed.
- The unused synchronous backup verifier is removed. Its tests now exercise the
  streaming verifier used by both repositories.

## Regression evidence

All commands use the repository's Node 24.22.2 and pnpm 12.10.1.

| Scope                       | Before the fix                                                                           | Focused result after the fix                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser origins             | Six new assertions failed for slash, default port and host casing                        | 12/12 origin tests; expanded related run 126/126; literal historic publication directory IDs unchanged                                                                  |
| Local backup interruption   | Repository/set/marker/retention interruption assertions failed against the old lifecycle | 22/22 repository tests, including concurrent initialization and overwrite protection                                                                                    |
| Article/pair image geometry | A delayed square image reserved 337.5px then grew to 600px in a 600px column             | 15/15 image unit tests; 12/12 real Chromium scenarios using the exact React server runner, including public/preview, square/portrait and missing-dimension legacy cases |
| Streaming verifier refactor | Existing 26-test retention suite passed                                                  | All 26 cases passed on the stream verifier before and after deleting the unused implementation; combined retention/R2 run 61 passed, three platform skips               |

The full native suite also passed the populated preview image dimension assertion
in `get-preview-case.integration.test.ts`.

## Aggregate verification

The first aggregate run found a new test helper using `Promise.withResolvers`,
which is outside the configured TypeScript library. The helper now uses the
existing captured-resolver pattern; the compiler configuration is unchanged.

A later startup failure was a stale test lease from 9 November. Its stopped
container, exact run label, checkout paths, synthetic credentials, tmpfs storage,
port 55434 and empty network were verified with the repository ownership guards
before removing that fixture and its unchanged lease. Local port 5432 and the
historical visual database on 55433 were preserved. An installed Vite/Vitest
stack-trace formatter masked the original lease error; dependencies were not
changed.

The first complete test run returned 2,346 passed, three platform skips and one
failure in `backup-set.integration.test.ts`. The R2 delivery test had left its
remote-only media row in the shared synthetic database after shutting down its
server. The backup correctly refused the missing local bytes. A native absence
assertion reproduced this leak, then passed after exact-ID fixture cleanup.
Runtime, HTTP server and Payload teardown remain protected by nested `finally`
blocks. Backup inventory and integrity checks were not weakened.

Final local gates passed: **pnpm verify exit 0** with 238 test files, 2,347 passed
and three platform skips; 125 script checks; type checking, formatting, build
and lint with eight existing migration warnings. **pnpm test:e2e exit 0**,
140/140 Chromium journeys, including the 12 new delayed-image scenarios.

[Machine-readable receipt](artifacts/audit-fixes/2026-11-14.json) records the
log hashes, native encrypted backup proof, runtime and generated-file checks.
The wrapper restored the original next-env.d.ts and tsconfig.json bytes.
Independent source review found no concrete regression.

The run used synthetic local storage, captured email, ephemeral PostgreSQL on
55434 and fresh output under .work/next-tests. It did not use production data,
run fresh Linux CI, perform formal Figma/screen-reader acceptance or deploy.
No dependencies or migrations changed.

## Gates

E2.3.3 is closed by the corrected dimensions and regression evidence. E2.3.5
remains open until affected visual and aggregate acceptance is refreshed;
E2.6.2 remains open for the formal screen-reader review.

E4.1.2 is closed by the observed behavioral RED/GREEN checks. E4.1.5 and E4.3.5
remain open for fresh aggregate and candidate evidence. The accepted A4 image and
its historical evidence remain identified in A4.md. These source changes do not
inherit that image's validation or authorization to launch.
