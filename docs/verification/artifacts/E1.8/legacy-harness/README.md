# True pre-migration upgrade harness

Stage 1 remains 87.5%; this is executed local evidence, not A1 approval. The original run is preserved under `.work/e1.8-legacy-routes-green-0fa4958-20261030`. Files with `.txt` suffix are content-preserving source evidence with LF-normalized line endings and trailing whitespace removed, deliberately not executable in the artifact directory. Their guards depend on a two-level `.work/<harness>` layout. Never run them from this artifact directory or against another database.

Baseline: `0fa495864cfefcf3489856d66444b81fdf1f730e`. To prepare an equivalent fresh guarded layout, archive the original source (no checkout of the active worktree):

```powershell
git archive --format=tar --output=.work/<new-harness>/baseline.tar 0fa495864cfefcf3489856d66444b81fdf1f730e src testing tsconfig.json package.json next-env.d.ts
# Extract that tar into .work/<new-harness>/source, preserving the source tree.
```

The source tree resolves dependencies through the existing root node_modules. `run.cjs inspect` and `resolve-aliases.cjs` verify that old config and @ aliases resolve inside the old source. The archive was compared byte-for-byte before execution. No source archive or node_modules is exported here. This harness pins Node24.22.2 and requires the existing synthetic test environment before app imports; its guard rejects non-loopback/non55433/non-adfl_test databases.

The sole lifecycle owner ran `node --conditions=react-server --import tsx .work/e1.8-legacy-routes-green-owner.ts <phase>` from the app root. Sequential phases and observed exit codes: start0, old-migrate0, old-seed0, current-migrate0, captured0, bootstrap0, verify0, stop0. The owner uses the repository test environment, starts/removes only postgres-test and clears only its validated test public-root namespace. No existing local55432 or unrelated5432 service is touched. The inner run.cjs never changes database/container lifecycle.

`expected.json` was generated before the new migration, after information_schema proved new columns/outbox absent. `captured.json` proves canonical bodies/revisions were captured after the additive migration. `verified.json` proves A308B/B200/C404, withdrawn410, never-public404, revoked private media, retained old versions/reading keys/public SHA and unchanged public generation after Native restore-as-draft. These are synthetic fixture IDs and public expected values; they contain no credentials.

The source comment saying its preparation author had not executed it records the helper's handoff. The lifecycle owner subsequently executed the source files corresponding to these exports (original/exported hashes and whitespace transformation are explicit); the manifest and logs identify that execution. The earlier route404 RED and failed fixture attempts remain separately preserved, never overwritten by this GREEN clone.
