# Persisted publication worker

The server starts one detached worker per Next process when `PUBLICATION_RETRY_WORKER_ENABLED=true` and migrated retry metadata is enabled. Ordinary isolated tests and existing environments keep the worker off. Instrumentation imports application composition before registering the timer. The timer invokes the shared Payload provider later. It schedules the next bounded drain after the active drain settles.

The drain uses the existing socket fence implementation with a separate drain identity. It scans Native due rows in `(nextAttemptAt, id)` order and wraps the cursor after a bounded read reaches the end. It hydrates the recorded real account before submitting the automatic attempt through `retryPublicationUpdate`. That entry point holds the claim and outcome responsibilities. Immediate write confirmation and the explicit retry endpoint select their respective modes. Shared case prerequisites use the same mode. Each scheduled attempt starts once, before filesystem promotion, and uses the persisted version when recording its result.

The worker independently reads outbox state before settling technical due metadata. Terminal operations, actorless rows and missing accounts cannot monopolize a batch. The conditional update matches the row, operation, started version and due instant. Native subject ACL remains part of each claim. An access-denied row stays pending while the cursor advances to eligible work.

An explicit retry of a terminal public receipt rechecks the existing fenced coordinator and root. The metadata retry budget stays closed. When an actual filesystem failure makes `current.json` unavailable, the retry returns pending. Restoring the fixture root allows the same operation to confirm again.

## Native and unit evidence

| Proof | Observed result |
| --- | --- |
| `publication-worker-native-red.*` and `publication-worker-native-green.*` | Expected Native RED on the committed pending outbox, followed by 1/1 GREEN with version 1, automatic count 1 and the same immutable target. |
| `publication-worker-maintenance-red.*` and `publication-worker-maintenance-green.*` | Five expected failures, then 6/6 pass covering terminal version zero, missing or NULL actors, stale reconciliation and immediate versus manual behavior. |
| `publication-worker-cursor-red.*` and `publication-worker-cursor-green.*` | A real Native access-denied row initially starved later work. Native cursor correction passed 7/7. |
| `publication-worker-terminal-reproof-red.*` and `publication-worker-terminal-reproof-green.*` | Actual unavailable fixture root produced stale public at RED. Fenced reproof passed 8/8, with no new scheduled version for terminal reproof. |
| `publication-worker-current-unit.*` | 105/105 units passed, exit 0. Includes clock/poll bounds, failure containment, sequential progress, stopping an active drain and opt-in validation. |
| `publication-worker-current-types.*`, `publication-worker-current-lint.*`, `publication-worker-current-format.*` | Exit 0 for each scoped static check. |
| `publication-worker-affected-native.*` | Initial combined run exit 1, 46 passed and 6 failed. All five prior suites passed. The worker suite's queue order depended on fixture rows left by earlier suites in the same disposable DB. |
| `publication-worker-affected-native-corrected.*` | Fresh combined run exit 0, 6 files and 52/52 tests. Includes the corrected worker fixture, persisted claims, Local/Native command receipts, failure boundaries and original migration capture. |

The worker integration fixture now uses a separate synthetic clock window and verifies that the window is empty before it queues its own rows. The actual Native query, actor checks and production ordering are exercised without an artificial filter.

The earlier persisted slice's 54-test stdout-only exit limit is documented in `publication-retries-report.md`. It remains separate from the explicit command and exit receipts in this worker slice.

## Production Next startup proof

`publication-worker-next-startup.json` records exit 0, the exact command and equal before/after hashes for the canonical Next references and selected worker sources. The build ran Next 16.4.3 under Node 24.22.2. The HTTP proof passed 1/1 in an 8.3-second test, 98.6 seconds including the build and runner lifecycle. The primary process on 3101 had the worker off. The owned child on 3102 used the same build `pc_Pwu3HX-zbD88jL9o-C` with explicit worker opt-in.

During confirmed disconnection of the owned PostgreSQL network, `/health` and the previously confirmed case returned 200. The case body contained the approved fixture title, and the public root generation stayed unchanged. After the same database reconnected, the same child processed the previously pending immutable target with the recorded account, started version 1 and automatic count 1. Native state and target revision matched, the technical due instant cleared, and the root held the matching operation and revision. The attachment records the worker's structured event. It did not observe a Native connection error in the captured child output.

The Playwright JSON, extracted proof attachment and raw build/test log are `publication-worker-next-startup-playwright.json`, `publication-worker-next-startup-evidence.json` and `publication-worker-next-startup.txt`. The run used `87a15345-37ae-46b7-9d7d-4f1f39f10907`, container `e12237850a316960b39c28352a77ad5099e12c55c82efab32024b2498ce702fd` and network `1a0fd50052000f29b725af21cccde6760eca12d9af30d934f8ae531b4a9db086`. The runner restored both canonical files after Next rewrote its generated references. `next-env.d.ts` SHA256 is `ec8fe87b409db846858ae7d48e4aa144f2ebcfebcb623c34da86d7688bb67d95`. `tsconfig.json` SHA256 is `64f3c9d6863fee9d3fd8707e5543bba29487d389b2e17117e8ec2cd451eb70ce`.

Next printed its standalone-start advisory and a filesystem tracing warning through the existing backup inventory import graph. The scoped proof used a real Next production build and HTTP process. The standalone image gate remains separate.

`publication-worker-cleanup.json` records zero owned disposable containers, networks, port listeners and lifecycle locks after teardown. The corrected Native run used PostgreSQL 17.11, run `21acb17f-fdd4-4d08-abdc-477dea980e76`, container `4627a9f5e6f923ecf38de0f799ab82277c3375b6fc50b14b53abb9f8f834e4d1` and network `ae256d323040c4665aaee901ec7c8f231bef8f257d72ae0751ea2620031d98fc`. PG 55434 and app ports 3101/3102 were explicitly released to root. The exact commands and original exit codes are in the respective JSON receipts. `publication-worker-source-freeze.json` records the worker sources handed off for further review.

## Remaining verification boundaries

HTTP acknowledgement is the next boundary. The read-only proposal is in `publication-http-ack-proposal.md`. The startup proof measures service readiness, confirmed cache delivery during the origin outage and recovery of persisted work. A worker killed between root promotion and SQL acknowledgement still needs its dedicated automatic restart proof. The A3 propagation target remains an operational proposal.

Follow-up review should exercise stale case-content reconciliation when the shared order prerequisite has no root coverage and its actor cannot run under the current automatic request. The tested stale case is the shared order operation itself. The current case-content closure still tries its shared prerequisite before calling the core stale reconciliation path. That can defer obsolete metadata settlement until the prerequisite becomes available. The subject fence still controls which target can publish.
