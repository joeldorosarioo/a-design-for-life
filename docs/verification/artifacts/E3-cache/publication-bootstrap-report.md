# Public bootstrap projections

The profile and navigation `/published/:locale` handlers now capture `current.json` once and pass its explicit root to the existing DTO getter. Successful responses emit `x-portfolio-generation` from that same captured root. The existing structural absence and availability classification remains the response status policy. Invalid locales still return 404. Failures omit the marker. Navigation composes its profile dependency from the supplied root.

`GET /api/case-content/published/:locale` returns the anonymous, locale-specific aggregate as `{ok:true,value:{cards,featured}}`. It reuses the existing card and featured readers and their confirmed order. The Zod aggregate, cards and nested cover reject extra keys. A confirmed case order without public translations yields two empty arrays. Missing or corrupt roots, and roots with no case coverage, return 503. Invalid locales return 404. The successful response contains the captured generation marker and uses `Cache-Control: no-store`.

`@/features/cases/server` exports `getPublishedCaseAggregate(locale, root)` and `publishedCaseAggregateSchema` for the observer. Cards carry the existing public card fields for that locale. Historical routes, detail bodies, operation metadata and unpublished case identities are absent from the aggregate.

| Receipt | Observed outcome |
| --- | --- |
| `publication-bootstrap-red.json` and `.txt` | Exit 1. The existing structural handlers lacked the marker, and the aggregate handler was absent. Four expected failures and one existing status case passed. |
| `publication-bootstrap-green.json` and `.txt` | Exit 0. The three new real-handler suites passed 5/5. |
| `publication-bootstrap-unit.json` and `.txt` | Exit 0. Eight focused unit files passed 25/25, including the existing getter and card regressions. |
| `publication-bootstrap-types.json` and `.txt` | Initial scoped typecheck found that Payload's collection `endpoints` can be false. The fixture now narrows it before selecting the handler. |
| `publication-bootstrap-types-corrected.json` and `publication-bootstrap-green-current.json` | Exit 0 on scoped types and fresh 5/5 handler checks after the fixture correction. |
| `publication-bootstrap-lint.json`, `publication-bootstrap-format.json`, and the final fixture receipts | Exit 0 for scoped lint and format, with the corrected fixture rechecked. |

The cases capture test reads the real fixture file and atomically replaces it with a newer generation before the first read returns. The real handler emits the earlier marker and exact earlier ordered cards and featured subset. It accesses `current.json` once. The full JSON assertion also excludes the other locale, history, detail body and an order-only case's identifier. Profile and navigation tests call the configured handlers with anonymous requests and real fixture files.

The evidence covers the handlers and projections. The mounted Native HTTP and observer gates remain separate. This slice started no database, build or listener. The source hash list is `publication-bootstrap-source-freeze.json`.
