# Robots HTTP RED — metadata file discovery

Root's actual `.work/E2-private-language-seo-http-red.txt` preserves a real HTTP failure: lines 123–137 show `/robots.txt` expected 200 but returned 404. The three preceding HTML metadata tests passed (lines 87–89). This agent did not rerun HTTP or start Next/Native/build.

## Cause demonstrated before the move

The installed Next version is 16.4.3. `node_modules/next/dist/lib/metadata/is-metadata-route.js:165` constructs the robots matcher with a start-of-path anchor before `robots`; it receives the app-directory-relative filename. Therefore `/robots.ts` is recognized but `/(portfolio)/robots.ts` is not. `server/lib/find-page-file.js:106` delegates metadata discovery to this matcher.

The installed matcher was called directly, without invoking application modules or starting services. `metadata-file-matcher-proof.log` records:

| App-relative file | Recognized metadata |
| --- | --- |
| `/robots.ts` | true |
| `/(portfolio)/robots.ts` | false |
| `/sitemap.ts` | true |
| `/(portfolio)/sitemap.ts` | true |

This agrees with [Next's official robots convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots), which places the robots file at the root of `app` and documents `app/robots.ts` for programmatic policy.

Sitemap is different: `is-metadata-route.js:168–170` matches a sitemap suffix without the robots start anchor. `lib/metadata/get-metadata-route.js:58–63` explicitly documents normalizing a route-group sitemap to `/sitemap`, and lines 69–71 exclude sitemap from group hash suffixes. No claim is made that the original grouped sitemap failed discovery. [The official sitemap convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) also documents the root `app/sitemap.ts` entry for a single generated sitemap.

## Small authorized correction

Both existing files were moved to `src/app/robots.ts` and `src/app/sitemap.ts`. Root explicitly authorized both moves. Moving robots addresses the proven discovery failure; moving sitemap keeps these related root metadata entries together. The earlier route-group placement was an internal implementation choice, not an approved external URL or product-page requirement. The public resources remain `/robots.txt` and `/sitemap.xml`.

Before moving, both exact destination paths were verified absent and both resolved source/destination paths were checked inside `E:/a-design-for-life/src/app`. Native PowerShell `Move-Item -LiteralPath` moved the files without overwriting or source-content edits. `metadata-root-move-evidence.json` proves identical SHA256 before/after:

- Robots: `9351F785BA93806819A4B318799C90C99BF32912F671D12EB5F836CC99561A4A`
- Sitemap: `E1AB8B9A91E6E7099C386D6D2D78D23E78E7D81C07A149547000A9BC9245203F`

The reader and its six-test Native source hashes still match `installed-source-hashes.json`. The reader, builder APIs and their implementation were not changed. Both moved entries retain their existing `force-dynamic` configuration and runtime policies.

Sources are frozen and ready for root's next actual HTTP gate. This diagnosis establishes discovery behavior and a content-preserving move; it does not claim the HTTP regression has passed. No database, Next process, build, HTTP/test runner, Git operation or unrelated source edit was performed in this correction.
