# A Design for Life

A bilingual Product Design and UX portfolio. Next.js serves the public site. Payload manages content and PostgreSQL stores it. The public UI uses Tailwind CSS, CVA, and seven components installed from the [official shadcn registry](https://ui.shadcn.com/docs/components). Figma defines the visual reference.

## Develop locally

Use Node 24.22.2, pnpm 12.10.1, and Docker with Linux containers. Follow the [local setup](docs/runbooks/ambiente-local.md) to configure an isolated environment, open `/pt`, `/en`, and `/admin`, and run `pnpm verify` and `pnpm test:e2e`.

## Release status

A4 was approved on 8 November 2026. Launch is deferred and requires explicit authorization. The approved staging revision is `befe22b`. Any promotion of that candidate must use its exact digest. See the [A4 record](docs/verification/A4.md) and [launch runbook](docs/runbooks/lancamento.md).

Final PT/EN content and résumés, the formal screen-reader review, and production configuration are pending. Analytics remains disabled. The A4 record lists all outstanding release gates.

## References

- [Approved product spec](docs/specs/2026-10-29-portfolio-spec-v1.md) and [CMS contracts](docs/specs/2026-10-29-portfolio-contratos-cms.md)
- [Figma inventory](docs/specs/2026-10-29-portfolio-inventario-figma.md) and [implementation plan](docs/specs/2026-10-29-portfolio-plano-implementacao.md)
- [Editorial workflow](docs/runbooks/cms-editorial.md) and [backup and recovery](docs/runbooks/backup-e-restauracao.md)
