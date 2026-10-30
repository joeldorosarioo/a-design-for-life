# E1.8 evidence index

Stage1 remains **87.5%**. E1.8/A1 await the independent gate. [evidence-index.json](evidence-index.json) records original and exported SHA256, observed command exit code, classification, behavior and exact export transformation. Text files are explicitly **sanitized extracts**, not complete logs. Original files remain unchanged under ignored `.work`; raw SQL/stacks/request bodies, authentication cookies, lease values and Playwright traces are not exported.

RED labels are reserved for observed behavioral assertions. Mixed runs, fixture/typecheck failures and incomplete gates are labeled separately. The invalid-auth first R1 attempt is not its proof; `native-transport-commit-red.txt` is the later valid real-auth201→503 assertion. The old E2E18/7 run contains setup failures and is not a collection of new-feature TDD REDs.

The [legacy harness](legacy-harness/README.md) exports exact scripts as non-executable .txt, guards, synthetic expected/captured/verified data and a separate source manifest. It omits the source archive, node_modules and environment secrets. The baseline and reproduction layout are documented there.

Native PNGs are actual CMS captures with synthetic content. They demonstrate persisted pending state, public confirmation, an obsolete retry, pending withdrawal and an illustrative Figma draft. They are not stage2 page designs or responsive layout acceptance. Screenshot hashes are recorded after the final E2E run, so historical paths from E1.4/E1.5/E1.6 are restored from verified originals rather than silently replaced.

The fresh final verify/E2E extracts and immutable source/CI/review manifests will complete this index after their respective gates. LinuxSIGSTOP cannot be approved by a Windows skip.

Round1 exports under `round1/` cover I1/I2/I3 and R-MEDIA, valid real Native/SQL/FS REDs, 46/5 focused GREEN, final verify455/73+1Windows skip and25E2E. Setup/typecheck failures and the intermediate454/1/1 fixture-cleanup failure are separate classifications. Prior evidence/hashes and all27tracked PNGs remain unchanged. The a78b2dd Linux CI passed but was not promoted; fixes require a new exact-SHA CI and scoped re-review. I4attempt accounting and I5warnings remain minor deferred.
