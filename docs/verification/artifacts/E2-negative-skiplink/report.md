# Negative document keyboard skip — actual browser TDD

Root authorized one bounded slice while another agent owned Native. Two application files changed: `src/features/cases/server/case-state-document.e2e.test.ts` and one added property in `src/features/cases/stylesheets/case-state-document.css`. The existing CSS emitter regenerated ignored `public/_portfolio/case-state.css` only after that CSS change. Renderer code was unchanged.

The adjacent Playwright test serves the **actual** `renderCaseRouteResponse` with an explicitly synthetic strict presentation plus the **actual** generated CSS and existing footer vector. A precondition rejects the A1 fallback. Its own Node HTTP listener binds `127.0.0.1:0`; afterAll closes it and all its connections. The C-only Playwright config has no global setup/teardown/webServer, starts only Chromium, selects only this file and disables trace/screenshots/video. Browser resources are closed by Playwright. It does not read/write Native, call Docker, touch port3100, start Next, build, install dependencies or overwrite any reference screenshot. This proves CSS/keyboard behavior only, not Native publication/privacy.

Node was pinned24.22.2. Real keyboard Tab→Enter focused the skip link and main successfully in all baseline scenarios; actual renderer and sticky CSS preconditions passed. **All four geometry assertions then failed**, exit1 (`red.log`):

| CSS viewport / text | Baseline H1 top | Sticky header bottom |
| --- | ---: | ---: |
| 1440 / 100% | 80 | 93 |
| 1440 / 200% | 160 | 185 |
| 390 / 100% | 80 | 133 |
| 390 / 200% | 160 | 385 |

The candidate is therefore reproduced rather than inferred from static review. The minimal fix adds `scroll-margin-block-start: calc(50svh + var(--space-8))` to `.case-state-main`, matching the existing sticky-header compensation for contact. It does not alter normal page layout, editorial text, HTTP status or transport.

After CSS emission, the same four actual-browser tests passed, exit0 (`green.log`). At390/200, H1 top545/bottom689 is below header385 and within viewport900. At1440/200, H1 top345/bottom441 is below header185. Focus still goes to main. Focused TypeScript, adjacent-test ESLint and both-file Prettier checks exited0. No full suite was run.

Source was frozen and root notified immediately after GREEN so its private visual rebuild could proceed. The normal full Playwright config can discover this adjacent `*.e2e.test.ts` later; this focused execution intentionally used the C config to avoid its DB/Next global setup. Final stage/visual acceptance remains root-owned.
