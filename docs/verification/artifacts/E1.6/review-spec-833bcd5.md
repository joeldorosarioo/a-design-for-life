# E1.6 — independent SPEC review

Target: `833bcd54e56e6a562614f470c253177ab04df5e5`  
Base: `a2741a295135be49d8408aced4cfa67f29af4c10`  
Repository: `E:\a-design-for-life`  
Stage 1: **75% (E1.1–E1.5 and E1.7 completed; E1.6 candidate; E1.8 and A1 outstanding).**

## Verdict

**No actionable SPEC finding identified: 0 findings.** The reviewed candidate implements the authorized E1.6 behavior, including the later explicit animation/PDF policy. This is a static requirements review supported by inspection of committed execution evidence, not a new execution or approval of the complete stage. Final completion remains conditional on the coordinator's exact-SHA CI/protected promotion gate.

No missing requirement, extra product restriction, unauthorized collection, or incorrect implementation was established with a concrete reproduction from the target. The asynchronous full-validator signature is an explained implementation adjustment: synchronous signature screening remains a candidate operation; real image/PDF validation is awaited before persistence and access. This strengthens the requested boundary rather than treating magic bytes as validated content.

## Authority and method

Read the exact approved task first: `work/stage1-briefs/E1.6-approved-task.md`. Requirements were checked against the full CMS contract, the media/security/publication sections of `docs/specs/2026-10-29-portfolio-spec-v1.md`, the explicit user decision `docs/decisions/2026-10-30-media-policy.md`, `AGENTS.md`, and current execution status. The plan does not override these authorities.

Read the review package inventory and relevant diff/source in bounded chunks. Production behavior was inspected using `git show 833bcd5:<path>`, including unchanged integrated foundations: preflight, object storage, processing gate, PDF checker, usage transition, presentation mapping and existing editorial transaction/restore/deletion protections. The earlier foundation review was read for scope and limitations and was not accepted as a substitute for this review.

No app source, Git state, service, database or build was changed. No tests were rerun. No new subagents or external services were used. The only write is this report in the authorized review workspace. Review and verification skills were read; existing logs are attributed to their recorded runs rather than claimed as independently executed tests. The coordinator's supplied 49-source/154-artifact hash verification was not independently repeated here.

## Requirements checklist

All source paths below are relative to `E:\a-design-for-life`; line references are at the fixed target.

| Requirement | Target implementation and relevant proof | Assessment |
| --- | --- | --- |
| Four real static image formats, real PDF, exact decimal limits, server SVG rejection | `server/preflight-upload.ts:10,35` identifies bytes and rejects >10,000,000 image / >5,000,000 PDF bytes. `validate-upload.ts:33` fully decodes/parses before admission. Preflight tests cover below/exact/above boundaries; native HTTP rejects disguised SVG, fabricated PDF, corruption and oversized inputs. | Present |
| Latest user policy: animated WebP accepted/preserved; APNG and animated AVIF rejected; opening-password PDF rejected; permissions-only encryption accepted | `validate-upload.ts` inspects PNG animation chunks, AVIF brands/pages and all accepted WebP pages; PDF inspection uses an empty opening password. Genuine animation fixtures and real HTTP encrypted-PDF controls are used. Original WebP bytes are compared and derivatives are decoded to inspect pages, timing, loop and distinct frames. | Present |
| Server authentication before heavy upload work, including privileged Local API | `content/hooks/native-intake.ts:29,35` requires a `users` session and an active transaction before validation/storage; Local override test confirms rejection without any decoder stats call. | Present |
| Native Payload collection/forms, safe alternate intake paths | `content/collections/media.ts` retains native transport/form. Hook rejects duplication, URL-only imports, crop/reprocess input and client technical fields. Actual browser journey creates and reloads the native record and preserves its label. | Present |
| Bytes immutable by MediaID; original and derived objects stored privately | Intake rejects replacement files and file metadata writes on update; receipt is server-owned through a WeakMap. `helpers/storage/object-storage.ts` captures bytes, exclusively writes opaque objects, and verifies byte count/SHA256 on read. Metadata DTO removes manifest, usages and guard. Native and HTTP tests compare genuine original bytes. | Present |
| Application image processing; no enlargement; useful widths 342/640/960/1280/up to2560; correct dimensions | `server/process-image.ts:33` deduplicates widths clamped to the source; uses Sharp, orientation correction and per-frame dimensions. Tests inspect real output dimensions, orientation, transparency, distinct frames and animation timing/loop. | Present |
| One processing job per process, capacity measured close to10MB | Shared global processing gate wraps validation, derivatives and storage (`native-intake.ts:103`); one queued job, excess recoverable503. Real native test holds storage while observing queue admission; failure releases the slot. Native resource evidence measures genuine near-limit JPEG/PNG plus a compressible12MP control and verifies all stored objects. | Present; measurement limitations disclosed |
| No silent new dimension/page/frame limits or external image service | No feature-specific pixel, dimension, frame or page ceiling added. Retained Sharp defaults and their acceptance limitation are explicitly presented in architecture/report for the gate. Processing/checking are local. | Present |
| Public access only with approved reference; authenticated private/no-store preview | `resolve-media-access.ts:13,30,39` checks session/state/current confirmed usage before any storage read. `media-response.ts:8,19,39` adds private/no-store preview headers and catches preparation/auth failures. Public bytes use no-store. Originals and variants use the same authorization path. | Present |
| Direct/native/thumbnail/HEAD/conditional/optimizer paths cannot expose drafts | Native file handler always supplies a Response and delegates to the same resolver; disabled local storage prevents filesystem fallback. Own routes are dynamic and support HEAD through the same path. Native HEAD stays unsupported404/no-store. `next.config.ts` disables optimization and local optimizer inputs. Actual anonymous GET/HEAD with conditionals/ranges, native file access and optimizer attempts are exercised. | Present |
| Publication PT does not expose unrelated private EN media; shared public file stays public when reused in draft | Explicit case/profile extraction includes only approved image/PDF slots, with UUID normalization and expected kind. `case-media-usage.ts:30` / `profile-media-usage.ts:6` synchronize native published snapshots separately from drafts. Integration demonstrates public PT + shared EN draft + separate EN-only media. Pure owner transition tests preserve another confirmed owner during withdrawal. | Present |
| Usage references by document/revision/locale; publication/deletion race protected in actual transaction | `track-media-usage.ts:14` requires editor and editorial transaction, serializes affected IDs and CAS-updates the actual Media row. Intake update/trash claims that same row and checks confirmed/pending usages (`native-intake.ts:76,83`). Deterministic PostgreSQL tests execute the real adapter and cover both row-holding orders plus later failure rollback. | Present |
| Versions/recovery/retention respected | Usage transitions retain superseded references. Media trash preserves physical bytes; permanent delete is blocked. Old trashed draft references may be removed without allowing new use. Existing restore protection produces a draft and reruns editorial hooks; inherited route history blocks deletion of formerly published case content. Real backup/cleanup execution remains stage3. | Present within E1.6 scope |
| No extra collections and feature-owned types/responsibilities | Existing Media gains technical JSON manifest/usages and guards; migration is additive. No media-usages collection. Explicit extraction stays in owning case/profile feature. New types are schema-derived within media-library. Generic storage makes no publication decisions. | Present |
| Actual isolated storage proof, recorded RED/GREEN, verify report and architecture | Read committed native/HTTP/race tests, current verify/E2E results, resource run and selected behavioral RED outputs. Required `docs/verification/E1.6.md` and `docs/architecture/midias-privadas.md` explain implementation and proof limits. | Present; final coordinator gate separate |

## Execution evidence inspected

The committed `e1.6-resume-verify-current.txt` records `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`, **347 tests in49 files**, followed by a successful Next production build listing both media routes. Its four lint warnings are unused generated migration parameters, with zero lint errors; this review does not describe the log as warning-free.

The committed `e1.6-resume-e2e-current.txt` records **22 passed**, including six named media journeys: native multipart/formats/private paths, public revocation, native UI, real object/database faults and recovery, approved upload policy, and animated-WebP delivery. Source inspection confirms fault tests modify only isolated owned resources with restoration in `finally`; private/public GET/HEAD failures are checked and native HEAD's unsupported404 is distinguished explicitly.

`e1.6-resume-usage-green.txt` records19 tests in3 files. The race tests intercept the adapter only to hold deterministic barriers while calling its original method; they check real row state, public availability and rollback rather than merely asserting mock calls.

Selected RED evidence was inspected directly: `policy-01-validation-red.txt` contains seven assertion failures around the later authorized policy; `e1.6-delivery-usage-red.txt` contains three behavioral access/publication assertion failures. These are distinguished from the report's preserved import/setup/typecheck attempts.

The resource run records native create times of approximately972ms /1512ms /588ms and whole-process maxRSS433,588 /466,904 /385,048KiB for the three controls. The report correctly limits these to three fresh Windows Native Local consumers and does not claim HTTP/R2/VPS capacity, an incremental allocation measurement, or universal10MB expansion safety.

## Remaining gate boundaries and unverified assumptions

- Exact-target Linux CI/protected promotion is the coordinator's ongoing gate. This review makes no claim about its outcome.
- E1.8's durable saved/pending/confirmed public-update protocol, cache coordination and retry remain outstanding. E1.6 currently confirms media against the native published snapshot inside its transaction; the documentation states that boundary explicitly.
- R2 real ACL/network delivery, production container/standalone packaging, physical orphan cleanup, and eight-week backup/restore operation remain stage3 work. Local proofs are not represented as those proofs.
- Native file HEAD remains unsupported and safely closed. Full PDF warnings may produce recoverable503; parsers do not certify universal semantic validity or malware absence. Decoder defaults may reject extreme compressed expansions; these limits are disclosed for the gate.
- No deployment/storage symlink or attacker-controlled filesystem topology was tested in this read-only review. Such a topology is not evidenced by this target or its logs and was not elevated into a speculative finding.

These limits do not establish a divergence in the authorized E1.6 candidate, and they must remain visible when the coordinator decides its gate. This review does not grant A1 or permission to begin stage2.
