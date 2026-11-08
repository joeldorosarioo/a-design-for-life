# A Design for Life

A bilingual Product Design and UX portfolio. Next.js serves the public site. Payload manages content and PostgreSQL stores it. The public UI uses Tailwind CSS, CVA, and seven components installed from the [official shadcn registry](https://ui.shadcn.com/docs/components). Figma defines the visual reference.

## Develop locally

Use Node 24.22.2, pnpm 12.10.1, and Docker with Linux containers. Run commands from the repository root.

1. Run `pnpm install --frozen-lockfile`.
2. If `.env` is absent, copy `.env.example`. Set a private `PAYLOAD_SECRET` of at least 32 characters and a `DATABASE_URI` for the local database on port 5432. Use local storage and captured email for isolated work.
3. On a fresh machine only, create the external PostgreSQL volume with `docker volume create a-design-for-life-rebuild-postgres-data`. Reuse the existing volume on this checkout.
4. Start the existing image with `docker compose -f compose.local.yaml up -d --no-build --wait`. For the first image build, replace `--no-build` with `--build`.
5. For a fresh database, run `pnpm migrate` and `pnpm provision:structural` from the host. The latter creates draft profiles and navigation. Publish both for the public pages to resolve.

Open [Portuguese](http://localhost:3000/pt), [English](http://localhost:3000/en), or the [Payload admin](http://localhost:3000/admin). With a local database available and port 3000 free, run `pnpm dev` to develop outside the application container.

Use the existing editor account where available. To provision an editor locally, set `APP_ENV=local`, `LOCAL_EDITOR_EMAIL`, and `LOCAL_EDITOR_PASSWORD` in the private environment, then run `pnpm provision:editor`. This command preserves an existing account with the same email.

The Compose stack binds both ports to loopback. It uses `appuser` (UID/GID 70), 1 CPU, and 2 GiB by default. Keep existing volumes attached. See [backup and recovery](docs/runbooks/lancamento.md#backups-and-recovery) for local backups.

## Verify

Use `pnpm setup:media-checker` if the PDF checker is missing. Set `READING_E2E_FONT_FILE` to a readable TrueType font, for example `C:\Windows\Fonts\arial.ttf` on Windows. Leave `VITEST_MAX_WORKERS` unset for the full suite.

```sh
pnpm verify
pnpm exec playwright install chromium --only-shell
pnpm test:e2e
```

Integration and browser tests use a disposable PostgreSQL instance on `127.0.0.1:55434` with synthetic storage and email. Keep that port free and leave the local database on 5432 and the historical visual database on 55433 intact. The test runner creates a separate Next.js build under `.work/next-tests`. See the [isolation evidence](docs/verification/artifacts/E3-isolation/) for the resource ownership and cleanup checks.

### Stop the local stack

```sh
docker compose -f compose.local.yaml stop portfolio
```

This retains the data volumes. After an interrupted test run, check the port lease and resource ownership before removing anything. Keep `.env`, `.work`, and `.toolchain` private.

## Release status

A4 was approved on 8 November 2026. Launch is deferred and requires explicit authorization. The approved staging revision is `befe22b`. Any promotion of that candidate must use its exact digest. See the [A4 record](docs/verification/A4.md) and [launch runbook](docs/runbooks/lancamento.md).

Final PT/EN content and résumés, the formal screen-reader review, and production configuration are pending. Analytics remains disabled. The A4 record lists all outstanding release gates.

## Project guides

- [Architecture and behavior](docs/architecture.md) · [Editing the portfolio](docs/runbooks/cms-editorial.md)
- [Approved product spec](docs/specs/2026-10-29-portfolio-spec-v1.md) · [CMS contracts](docs/specs/2026-10-29-portfolio-contratos-cms.md) · [Figma inventory](docs/specs/2026-10-29-portfolio-inventario-figma.md) · [Implementation plan](docs/specs/2026-10-29-portfolio-plano-implementacao.md)
- [Verification evidence and archive](docs/verification/evidence-index.md)
