# Production Next HTTP acknowledgement proof

`publication-http-observer-next-002` passed 1/1 with exit 0. The Next 16.4.3 production build compiled in 23.6 seconds, TypeScript finished in 12.1 seconds and the HTTP scenario ran in 9.8 seconds. The Playwright run took 67.4 seconds including build and lifecycle. The primary child listened on 3101 with ordinary defaults. Three successive owned processes on 3102 used the same `BUILD_ID` `_g2yHAOASLIpc1-KsP9e-`. HTTP verification was explicitly enabled in those processes and the automatic retry worker remained off.

The run used Node 24.22.2, the acquired PG55434 namespace, run `a3e58da9-a4d2-480e-8328-1f5f5011cdee`, container `7675bb1a7dcfbad00661d39ffd7817cae6d4617c26aadef3e285f1eaf1ff5152` and network `df7f674e9865c2421a648aee3d9c16aca7ab50d8fa23031733ef799dcf3790d3`. All 16 migrations completed. The run receipt records equal before and after SHA256 hashes for 24 inputs, including `next-env.d.ts` and `tsconfig.json`.

## Real HTTP observations

- The first shared order confirmed from the empty public cards and featured DTOs in PT and EN. The PT profile, PT navigation and first PT case then obtained public Native receipts. Anonymous mounted endpoints emitted each captured generation and the first case detail returned 200 with its approved title.
- The test replaced the owned Next process with one from the same build configured to observe a bound 127.0.0.1 listener on an OS-assigned port. That listener recorded exactly one anonymous `GET /api/case-content/published/pt`, with no Cookie or Authorization header, and returned 503. The real Native retry endpoint returned `update-pending` for the saved rename. SQL independently retained that state and target revision. Retry metadata held the recorded editor, started version 1 and a durable next time. The newly promoted root held the same operation and revision.
- Both processes stopped. The replacement Next process from the same build observed its own real endpoints. Its authenticated status endpoint still returned the pending receipt before retry. The retry confirmed the same immutable operation and the identical root generation `cc74c9b2-54d5-48f3-a2df-a4f61fe69968`. Started version became 2 and next due time cleared.
- The historical slug returned 308 with the required canonical location and a 54-byte body equal to that location. The renamed detail returned 200 in the same generation. A subsequent withdrawal confirmed after both slugs returned 410, with noindex and the withdrawn title absent from the public body.

The evidence verifies the publication acknowledgement, status durability and route behavior. The media byte authorization gate and the automatic crash-between-root-and-SQL restart proof remain separate.

## First failure and correction

`publication-http-observer-next-001` built successfully and exited 1. It confirmed the empty bootstrap, profile, navigation and first case. With the real observer listener stopped, a Local attempt left the renamed operation pending after root promotion. The restored enabled Next process could not acknowledge the same root because the historical redirect observer expected an empty body.

The diagnostic launched only the original owned Next build `D_gnucU0XPA3_Vrn9heNR` and requested the historical route from the retained pending root. The actual response was 308 with the right generation and a 54-byte body exactly equal to the Location header. Installed Next 16.4.3's router sends the redirect destination as the response body in this middleware branch. The diagnostic used the exact build and fixture root, exited 0 and closed its own listener. Root corrected the matcher and recorded the planner regression checks. Run 002 proved the corrected wire behavior through the actual opted-in process.

## Receipts and teardown

The exact Playwright command, timestamps, exit and before/after hashes are in `publication-http-observer-next-001.json` and `publication-http-observer-next-002.json`. The matching `.txt` build/test logs, `-playwright.json` reports and extracted `-evidence.json` attachments retain both outcomes. The diagnostic source and stdout are `publication-http-observer-redirect-diagnostic.mts` and `.txt`.

The isolated harness requires an explicitly opted-in child and a bound distinct IPv4 loopback listener before it accepts the test observer override. It still owns only the returned Next child. The test owns and closes the synthetic observer separately. `publication-http-observer-harness-red.*` records the expected missing guard and `publication-http-observer-harness-green.*` records 18/18 units with exit 0. Scoped type, lint and formatting checks also exited 0.

Run 002 removed the previously observed dynamic filesystem tracing warnings from this build. Next's standalone-start advisory and the Node color-setting notice were still visible in the runner output.

`publication-http-observer-cleanup.json` shows zero disposable containers, networks, listeners on 3101/3102/55434 and lifecycle locks. The synthetic observer's close callback was awaited before restoration. PG and app ports were released to root. No production or visual resource was used.
