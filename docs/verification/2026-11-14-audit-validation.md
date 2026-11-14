# Audit validation follow-up - 14 November 2026

The user authorized completing the remaining technical work: Linux CI, protected
review/merge into develop, a new private staging candidate, affected visual and
performance validation, and an updated dossier. This follows the instruction
"o que faltou tu faz". Production launch remains unauthorized. The previous
instruction suspending the formal screen-reader review remains in force; final
editorial content and final PT/EN resume PDFs remain external pending inputs.

The corrective commit is `30af67525d41aea93c23b885ff9aa6d649f7ebf9`.
Local verification passed 2,347 tests with three platform skips, 125 script
checks, the build and 140 Chromium journeys. These local gates do not replace
Linux or deployed evidence.

The actual staging predecessor is revision
`36f0ea65bbc2dca0de0f9ca8d7c45407fdbbdd00`, manifest
`sha256:04f6c20894a28d1803c0d408a0c20f2c89fbc219e606b2e6ee0283d4e74afaf6`,
not the older image recorded by A4. Independent SSH and registry reads confirmed
it healthy on appuser, 1 CPU and 2 GiB, with the same three volumes and confirmed
publication root. The migration tree remains
`863d5c13d017c3435b43a2e4e9cc36d68b06f89a`; no migration is needed.

The protected [PR #7](https://github.com/joeldorosarioo/a-design-for-life/pull/7)
passed both required Linux checks before merging. The deployed-candidate pipeline
is [43618818421](https://github.com/joeldorosarioo/a-design-for-life/actions/runs/43618818421)
for merge revision `1640d9729d1bddaac2059b850e8124112aa9507a`. Its Git tree is
`281c6a19d4a77230479eba7cba0d594677b71a14`, exactly equal to the corrective commit.
Local develop advanced by fast-forward, preserving unrelated local files.

## Initial candidate: exact CI and deployment proof

| Identity               | Value                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| Revision               | `1640d9729d1bddaac2059b850e8124112aa9507a`                                |
| Manifest               | `sha256:d78eca0ad14ec38f99acae014f548c4d717cee415daf34e019a89821cf06bd5d` |
| Config digest          | `sha256:9ae154f0743ec294b5f7b4aa7c4b998a698a45bf1501309df3dfdfe530456733` |
| Whole Git tree         | `281c6a19d4a77230479eba7cba0d594677b71a14`                                |
| Application `src` tree | `8729d4cfb3ae460c9fff605bee6c3209f10cf158`                                |
| Migration tree         | `863d5c13d017c3435b43a2e4e9cc36d68b06f89a`                                |
| Environment            | Coolify Atlas / a-design-for-life / staging / app                         |

The completed workflow passed **2,350 Linux tests in 238 files, without skips,
and all 140 Chromium journeys**, along with typecheck, lint, format, the script
checks and build. Both production jobs were skipped. The required checks and
strict branch protection were read again after the merge.
[Protected merge](artifacts/audit-fixes/validation-2026-11-14/protected-merge.json)
and [pipeline receipt](artifacts/audit-fixes/validation-2026-11-14/pipeline-43618818421.json).

The reviewed backup task completed fresh encrypted set
`95707314-d495-4500-9b2c-cc7e7fedf834` at `2026-11-14T17:14:44.627Z`, before the
new container started at `17:15:32.440Z`. The ciphertext is 2,898,824 bytes with
SHA-256 `7db35f7ddcbfba3e0f10eedde8ee76ba1467e0fadb3153a74a0825be00de9649`.
The pipeline validated completion, source, manifest and ciphertext readback
before applying the image by manifest.

Independent SSH, Coolify and GHCR reads matched the revision, source tree,
manifest, config and healthy tested marker. They confirmed the same three volume
identities, confirmed publication root, eight running containers, `appuser`,
1 CPU, 2 GiB and log rotation. Six authenticated routes returned 200 with
`noindex`; anonymous access returned 401 and Google scripts remained absent.
[Release binding](artifacts/audit-fixes/validation-2026-11-14/release-binding-43618818421.json),
[before](artifacts/audit-fixes/validation-2026-11-14/staging-before.json),
[after](artifacts/audit-fixes/validation-2026-11-14/staging-after.json) and
[independent registry resolution](artifacts/audit-fixes/validation-2026-11-14/registry-marker-after.json).

## Visual, accessibility and HTTP acceptance

All **18 original Figma exports** matched the previously recorded reference
hashes. An isolated presentation fixture used the exact candidate source,
production DTO mappers, page/layout components, CSS, tokens and five canonical
assets to render all 18 original-content views. The three case variants include
the comparison and learning sections. All captures had zero overflow and broken
images. Nine contact sheets were reviewed; the coordinator independently
inspected five page families and both final Case02 source PNGs.
[Per-frame review and hashes](artifacts/audit-fixes/validation-2026-11-14/figma-visual-review.json).

The review records the approved header/menu/contact changes, derived contents
labels, pre-existing texture and exact source objects that remained unchanged.
Only genuine authored PT line breaks recovered from the hash-verified original
JSX were restored to the fixture. Other Home/About/EN transcriptions normalize
line boundaries, so their wrap differences remain explicit projection limits.
This is a presentation comparison, with no claim of Figma pixel identity or
proof of Native authorization, hydration or navigation from isolated SSR.

Fresh deployed browser checks passed **30 layouts** across ten localized routes
and 390/820/1440 widths, **50 axe states**, menus, keyboard focus, skip links,
contents and contacts, ten SSR pages and nine HTTP states. Real Chrome zoom
changed 100% to 200% and back, halving the CSS viewport and doubling DPR while
preserving visible focus and contacts without horizontal overflow. There were
zero page errors, external requests or findings.
[Deployed visual/keyboard/zoom review](artifacts/audit-fixes/validation-2026-11-14/visual-validation.json).
Incomplete automated contrast and dialog-focus observations received explicit
computed-color and keyboard dispositions in that receipt; this is not a formal
screen-reader or blanket WCAG certification.

The actual predecessor `36f0ea` and candidate `1640d972` have identical dimensions,
RGB pixels and media geometry in **all 30 deployed captures**, without masks or
tolerance. Current staging has cover/card/profile media and no article/pair body
images. The new intrinsic article/pair behavior is proven by the separately
recorded twelve delayed-image browser scenarios and Native integration, rather
than attributing that coverage to absent live content.

## Fresh performance validation

The protocol was frozen before measuring this exact candidate. The heaviest
current case is payment flexibility in both locales and device profiles,
selected from fresh nonzero same-origin resource measurements. Its encoded
weight exceeds financing by 19,900 bytes in each locale. The fixed profiles,
budgets and tool calibration remain unchanged. The full **36-measurement round
completed: 10/12 scenarios passed and two failed**. No samples were removed or
retried, and the thresholds were unchanged. Independent before/after SSH reads
confirmed the same image, container, publication root and volumes throughout.
[All samples, medians, ranges and diagnostics](artifacts/audit-fixes/validation-2026-11-14/performance-candidate-001.json)
and [frozen config](artifacts/audit-fixes/validation-2026-11-14/performance-candidate-001-config.json).
[Fresh resource weights](artifacts/audit-fixes/validation-2026-11-14/resource-weights.json).

The measured failures are PT listing/mobile, median LCP **2,517.8 ms**
(2,462.5-2,584.8), and EN listing/mobile, **2,569.7 ms**
(2,530.4-2,574.6), above the approved 2,500 ms budget. Their median CLS and TBT
pass. All samples are retained and the original round continues with unchanged
conditions. E4.2.4 is reopened for correction and fresh candidate verification;
this image has not passed complete technical acceptance. The workflow's tested
marker records CI and healthy deployment, not completed performance acceptance.

All six mobile-listing Lighthouse reports identify the first card as LCP. It is
present in the initial HTML but has `loading="lazy"` and no priority hint. Its
request starts about 526-543 ms late in the PT samples. The listing composition
never passes the existing `CaseImage.priority` option. The bounded correction is
to make only the first listing cover eager/high priority, retaining lazy loading
for later cards and Home's featured grid, with no size, crop, style or asset
changes.

The three-file correction now forwards the existing priority option from
`CaseList` through `CaseGrid` and `CaseCard`. A test using actual Next.Image output
first failed with expected eager/received lazy. After the correction, all 20
CaseList/CaseImage/CaseDetail tests passed; Home and later cards stayed lazy.
Affected ESLint, TypeScript and Prettier checks exited zero, and an independent
review found no concrete issue. The original `CaseImage`, CSS, image sizes,
assets, migrations and dependencies are unchanged.
[RED/GREEN, commands, source and log hashes](artifacts/audit-fixes/validation-2026-11-14/listing-priority-verification.json).
The replacement source requires protected Linux CI, a new immutable staging
image, matching visual acceptance and fresh performance before closing the gates.

## Remaining gates and recovery

E2.3.5 is reopened for the replacement source's matching aggregate and visual
acceptance. E4.1.5, E4.2.4 and E4.3.5 remain open until the new candidate,
performance and dossier are complete. E2.6.2 and E4.2.1 retain the suspended formal screen-reader review;
E4.1.3 retains final editorial content and replacement PT/EN resume PDFs.

The compatible immediate staging rollback is revision
`36f0ea65bbc2dca0de0f9ca8d7c45407fdbbdd00`, manifest
`sha256:04f6c20894a28d1803c0d408a0c20f2c89fbc219e606b2e6ee0283d4e74afaf6`,
with the same migration tree. An image rollback retains the current volumes and
verifies the exact digest, health, routes, admin, media and access guards.
For data recovery, preserve the original data, verify and decrypt the complete
backup privately, restore to an isolated copy, and compare catalog, media and
publication roots before any separately authorized connection switch.
[Rollback](../runbooks/lancamento.md#rollback-and-recovery) and
[backup/restore procedure](../runbooks/lancamento.md#backups-and-recovery).

This dossier is written after the image. Its later documentation commit does not
replace the deployed revision or tested whole-tree marker. The historical A4
approval remains tied to its original image; this corrective candidate awaits
complementary A4 approval and explicit launch authorization. All production
preconditions in [A4](A4.md) remain applicable. Raw authenticated logs, Lighthouse
reports and new screenshots stay private under ignored `.work`; tracked receipts
contain results and hashes.
