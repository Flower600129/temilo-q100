# Security and dependency review · October 31, 2026

Updated during the owner-authorized follow-up starting 05:35 Asia/Shanghai. This is a focused release review, not a complete security audit. **The four previously reported high package entries are resolved by verified compatible packages.** No framework major upgrade, public deployment or publication occurred.

## Actual audit results

| Point in time | `npm audit --omit=dev --json` | Exit |
| --- | --- | --- |
| Original R4 baseline | 5 high / 3 moderate / 7 low | 1 |
| First night-run PostCSS fix | 4 high / 0 moderate / 10 low | 1 |
| Follow-up security compatibility fixes | **0 high / 0 moderate / 11 low / 0 critical** | **1** |

The current 11 low entries all propagate from **one deepmerge advisory**. Router was previously classified high via its decoder; it is now low via Expo configuration, explaining the low count increasing by one. No new independent low flaw was introduced. The audit is still non-clean; it is not reported as exit 0. Private raw evidence: `.local/q100-followup/logs/audit.log`.

## Compatible fixes and verification

SDK **54.0.38**, Router **6.0.24**, RN **0.81.5** and all other existing dependency versions remain unchanged. The prior scoped Metro `postcss@8.5.31` fix remains. Installation used Expo's installer; its final online `expo install --check` passes.

- **decode-uri-component → query-string → expo-router (three old high entries):** the local workspace package contains the actual patched upstream **0.5.1** algorithm, with only its ESM default export converted into the callable CommonJS interface expected by query-string 7, plus the former `+` to space behavior. The upstream MIT copyright remains. `vendor/decode-uri-component/upstream.json` records its source hash; a test reverses only these documented compatibility edits and matches that hash. Both the exponential fallback and quadratic replacement defects are fixed by upstream's linear scanner/single replacement pass, not merely by changing the package version.
- **image-size (one old high entry):** a small CommonJS adapter delegates parsing to unmodified registry **image-size@2.0.4**, installed under `image-size-upstream`. It restores the synchronous path/Buffer and callback interface SDK54 Metro actually calls. File reads retain the 512 KiB limit. Tests exercise the actual Metro parent dependency path, `getAssetSize`, `getAssetData`, Buffer/file/callback/error behavior, and malformed zero-size ICNS/JXL/HEIF data. Parsing no longer uses 1.2.1.
- These are source-controlled local workspace packages with scoped npm overrides, not manual node_modules edits or claimed official upstream backports. They must accompany the lockfile. Docker copies them before `npm ci`; release packages include them. See `vendor/README.md`.
- **6 dedicated tests pass**, including time-bounded isolated child processes for the malformed decoder/parser regressions. Synthetic hostile fixtures never contact a real server. Full domain, browser and production regression results are recorded in the follow-up report.

The first attempted relative `file:` override produced broken parent-relative links; it was rejected after resolving the actual dependency paths. Workspace packages with parent-scoped version overrides replace that approach. The failed attempts are retained in the local command ledger. A fresh installation/build from the curated source package verifies portability.

References: [decoder exponential issue](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [decoder quadratic issue](https://github.com/advisories/GHSA-qr28-fpjm-wq7f), [upstream 0.5.1 code](https://github.com/SamVerschueren/decode-uri-component/blob/v0.5.1/index.js), [image JXL/HEIF issue](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [image ICNS issue](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).

## Remaining low finding: engineering disposition

[deepmerge 4.3.1 prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) has no published patched 4.x release reported by this audit. It is used by Expo configuration/prebuild tooling. TEMILO accepts no uploaded project configuration; only reviewed repository config is built. The minimal deployed runtime includes exported bundles and the server adapter, excluding Expo configuration/Metro/prebuild packages. No recipient data or API request is used as Expo project configuration.

For this single-process browser release preparation, this is a **documented, contained build-tool risk**, not a remaining high or a claim of a clean dependency tree. Build only reviewed source/config, avoid untrusted plugins/config, retain the lockfile, and review a compatible maintained fix when available. An SDK58 migration or `audit fix --force` is inappropriate for this SDK54 task. This scoped disposition does not authorize publication or certify arbitrary dependency paths safe.

## Runtime boundaries retained

| Area | Actual control / limit |
| --- | --- |
| Public upstream allowance | Durable shared single-instance day/minute ledger, conservative resolve 3 / explore 1 charge before forwarding, two active operations, upstream timeout and no automatic retries. Anonymous public users can still consume the chosen allowance; manual gifting remains available. |
| Request surface | URL ≤2048 characters with malformed URI rejection; JSON API bodies ≤4096 bytes; strict payload contracts, exact configured HTTPS origin/Host; no-store APIs. These remain useful controls alongside the actual dependency fixes. |
| Secrets and private records | Existing ignored server credentials remain unchanged; client/source scans inspect the real key without printing it. Release inputs exclude secrets, personal databases, supplied reference art and unverified unused template images. Live Qloo evidence contains public cultural signals only. |
| Filesystem | Serve only real files below the exported client; reject dot paths, server-directory paths and source maps. |
| Hosting | One process with a durable ledger and exclusive lock; fail closed on corrupt/unwritable state. Docker unavailable locally, so container/TLS/external topology remain unverified. |

The earlier production SQLite Worker/common-chunk defect remains fixed by the eager legacy-module import, preserving old data, schema and recovery semantics. Production regression again exercises actual synthetic legacy SQLite import and its untouched original.

Source MIT license and reviewed app assets are now prepared; public hosting, external real-Qloo production closure, public repository and formal submission remain separate, unperformed release steps.
