# Audit validation follow-up - 14 November 2026

The successor **`6788e7a` is technically validated in private staging**: 2,352
Linux tests, 140 Chromium journeys, fresh visual acceptance and all 12 performance
scenarios across 36 measurements passed. Its exact image and recovery point are
recorded in [Listing-priority successor](#listing-priority-successor). Formal
screen-reader work, final editorial materials and launch approval remain open.

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
pass. All samples are retained and conditions remained unchanged throughout the
round. E4.2.4 is reopened for correction and fresh candidate verification;
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

## Listing-priority successor

The correction was committed as `0d0d90749fa9898ea45fbd756bb9dd9549cff946` and
merged through protected [PR #8](https://github.com/joeldorosarioo/a-design-for-life/pull/8)
as `6788e7a9d4813bbda9128fb6df39cc2f69717cca`, after both required Linux checks
passed. The exact whole tree is `98e0fe5af219c5c4ffd0febb8caee5c06f82b054` and
the `src` tree is `83c5b71576d1c20ede051ceadaf25ef51043c25f`; public assets,
package/lock objects and migrations remain unchanged.
[Protected merge receipt](artifacts/audit-fixes/validation-2026-11-14/candidate-002/protected-merge.json).

All eighteen original-content presentation captures were regenerated for the
corrected source. Every PNG is byte-identical to the previously reviewed frame;
the compiled CSS and tokens also match. Exact Git object equality binds the
capture commit to the actual merge revision.
[Fresh frame/source review](artifacts/audit-fixes/validation-2026-11-14/candidate-002/figma-visual-review.json).

The [new develop pipeline](https://github.com/joeldorosarioo/a-design-for-life/actions/runs/43623742431)
passed **2,352 Linux tests in 238 files, zero skips and all 140 Chromium
journeys**, plus the required checks/build. Both production jobs were skipped.
The exact successor is now independently confirmed healthy in private staging:

| Identity               | Value                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| Revision               | `6788e7a9d4813bbda9128fb6df39cc2f69717cca`                                |
| Manifest               | `sha256:eb0af8fcd4ecda691c4826cbb5400b984174f6bb8ecf5f1fbde653ec20fb9d24` |
| Config digest          | `sha256:75924c70aa7eae13a1f182377c7a0acdb69f017d36116593c0ebbad31db2a86d` |
| Whole Git tree         | `98e0fe5af219c5c4ffd0febb8caee5c06f82b054`                                |
| Application `src` tree | `83c5b71576d1c20ede051ceadaf25ef51043c25f`                                |
| Migration tree         | `863d5c13d017c3435b43a2e4e9cc36d68b06f89a`                                |

Fresh encrypted backup `f0ea5c46-e830-404b-825b-5400d0d1a4a0` completed at
`2026-11-14T18:12:45.815Z`, 23,956 ms before the new container started. Its
2,898,824 ciphertext bytes have SHA-256
`bde4376582dc7beb3ea2e466caf19b214dbb899f8b6f34684a97b620c00d294a`.
Independent SSH/API/HTTP and GHCR reads preserve the three volumes, publication
root, eight running containers, quotas, log rotation, migration tree and access
guards. [New pipeline](artifacts/audit-fixes/validation-2026-11-14/candidate-002/pipeline-43623742431.json)
and [release binding](artifacts/audit-fixes/validation-2026-11-14/candidate-002/release-binding-43623742431.json).

Fresh initial-HTML checks confirm the first listing image is eager/high priority
in PT/EN, while later listing and Home images remain lazy. The successor passed
all 30 deployed layouts, 50 axe states, twenty menus and 240 keyboard samples,
ten SSR pages, nine HTTP states, contents/contact flows and real 200% Chrome zoom.
All 30 captures have identical RGB pixels, dimensions and media geometry to
`1640`; the eighteen regenerated original-content frames are also byte-identical
to the prior reviewed captures. No page errors, external attempts or findings
were observed. [Successor visual/SSR/zoom receipt](artifacts/audit-fixes/validation-2026-11-14/candidate-002/visual-validation.json).

Fresh successor weights still select payment flexibility as heaviest in each
locale/profile; its advantage is 19,895-19,900 encoded bytes, independently
recorded rather than inherited from the earlier round.
[New resource weights](artifacts/audit-fixes/validation-2026-11-14/candidate-002/resource-weights.json).
The successor passed **all 12 scenarios across 36 fresh measurements**, with the
original profiles and thresholds unchanged and no samples discarded or retried.
Every median CLS is zero; the highest median LCP is 1,880.847 ms and the highest
median TBT is 84.278 ms. The independent BEFORE/AFTER inspections confirmed the
same image, container, publication root, volumes, limits and access guards for
the complete measurement window.
[All 36 samples and 12 medians/ranges](artifacts/audit-fixes/validation-2026-11-14/candidate-002/performance-summary.json),
[frozen config](artifacts/audit-fixes/validation-2026-11-14/candidate-002/performance-config.json),
[calibration](artifacts/audit-fixes/validation-2026-11-14/candidate-002/performance-calibration.json)
and [AFTER inspection](artifacts/audit-fixes/validation-2026-11-14/candidate-002/performance-staging-after.json).

The mobile-listing improvement is recorded under those same conditions:

| Listing/mobile | Initial median LCP | Successor median LCP | Successor range    |
| -------------- | ------------------ | -------------------- | ------------------ |
| PT             | 2,517.8 ms         | 1,383.4 ms           | 1,379.1-1,399.3 ms |
| EN             | 2,569.7 ms         | 1,348.0 ms           | 1,326.3-1,442.7 ms |

Their median CLS and TBT pass as well. All six comparisons retain the same image
URL, 46,692-byte WebP and painted slot; eager/high priority is now present. Median
load delay fell from 531.5 to 109.9 ms in PT and 548.1 to 100.9 ms in EN, without a
relevant TTFB improvement. [Request and LCP comparison](artifacts/audit-fixes/validation-2026-11-14/candidate-002/listing-lcp-comparison.json).

These remain laboratory results for the private origin through the documented
relay, with cold browsers, a warm server, fixed throttling and Analytics off.
Field INP p75 remains unavailable; TBT and individual lab interactions do not
establish field INP. No RUM or Google measurement was enabled.

## Remaining gates and recovery

E2.3.5, E4.1.5 and E4.2.4 have the successor's fresh aggregate, visual and
performance acceptance. This dossier and its recovery procedure provide the
E4.3.5 handoff. E2.6.2 and E4.2.1 retain the suspended formal screen-reader review;
E4.1.3 retains final editorial content and replacement PT/EN resume PDFs.

The original checklists now record **stage 2: 29/30 (96.7%), five of six tasks
wholly closed; stage 4: 14/16 (87.5%), one of three tasks wholly closed (E4.3)**.
These are evidenced delivery counts, not elapsed effort or human approval.

The compatible immediate staging rollback for the successor is revision
`1640d9729d1bddaac2059b850e8124112aa9507a`, manifest
`sha256:d78eca0ad14ec38f99acae014f548c4d717cee415daf34e019a89821cf06bd5d`,
with the same migration tree. It is operationally healthy with the documented
mobile-listing LCP failure. The earlier `36f0ea` predecessor remains in the first
candidate's receipt. An image rollback retains the current volumes and
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
