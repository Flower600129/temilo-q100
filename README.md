# TEMILO · Time & Light

A private, mobile-first gift companion: remember people and dates, keep wishes and personal gift stock, prepare a gift, and record giving or undoing it with consistent stock accounting.

The current application uses **Expo SDK 54 / Expo Router 6 / React Native 0.81.5**. The earlier Next.js application is retained as a frozen legacy baseline with separate storage. Q100 night-run work repaired R3, unified the R2 UI and prepared/tested the local R4 server. **No public demo, public repository or formal competition submission has been created by the run.** The root MIT license names Liuyun. Active artwork has a checked provenance manifest; remaining release gates are listed below.

## Run locally

Use Node.js **24** (tested 24.15.0), npm and the supplied lockfile:

```sh
npm ci
npm run dev
```

Open [the application](http://127.0.0.1:8082/) and keep that terminal open. UI and `/api/taste/*` share the server. `npm run preview:status` checks local configuration without calling Qloo. `configured_unverified` means configured, not a fresh API health check. The launcher loads the existing ignored root `.env.local`; do not overwrite it with a template.

Stop only the owned server with Ctrl+C in its original terminal. An occupied port is reported without stopping another process or silently switching ports. Preserve the same hostname, port and browser profile to retain local records; `localhost`, `127.0.0.1` and another port have different storage origins.

## Try the fictional demo

Me → Data & help → Explore demo → Home. The header labels **FICTIONAL DEMO**. Avery/Jordan, one wish and four stock items come from `src/storage/demo-seed.ts`; demo reset cannot overwrite personal records. Screenshot reference time is October 30, 2026, 12:00 Asia/Shanghai; the actual app uses today's date, so reminders vary.

The normal journey is person → occasion → wishes/available stock/history/avoids → optional cultural exploration → review and save plan → explicit confirmation of giving. Name-only profiles are supported. Preparation windows are per occasion (including 30/60/custom days), continuous across months/years; February 29 is observed on February 28 in non-leap years. There are no background push/email claims.

Save leaves stock unchanged; giving deducts once; repeated confirmation does not deduct twice; undo restores once; external/experience gifts never deduct stock. Notes and post-gift feedback are separate. Saved sources remain readable after their original wish changes. Task URLs contain IDs and occurrence dates; private titles/notes/evidence remain in session drafts or saved records. Unsaved drafts expire on reload; save plans before closing. Forms and tasks guard actual unsaved edits.

## Optional Qloo workflow

1. Review recorded wishes, stock and known constraints first. A wish matched with owned stock can complete a plan with **zero Qloo calls**.
2. Confirm up to three public cultural interests. Resolve real entity candidates, then explicitly choose the intended category/entity.
3. Choose one cross-domain target, explore, and inspect at most three transparent template directions. Association scores retain their original field names and are not personal-liking probabilities.
4. Adopt/save only if useful. The exploration and typed source evidence are retained for the plan/history. Changes to relevant facts invalidate old directions and late success/error responses.

Real credentials belong only in server `.env.local` or deployment secrets. The event host is `https://hackathon.api.qloo.com`; other Qloo hosts require separately scoped keys. Only confirmed public cultural text or entity IDs and one target category go upstream. Names, exact dates, notes, wishes, stock and history stay local. No LLM, product SKU, price, marketplace inventory, popularity count, automatic ordering or guaranteed suitability is claimed.

The October 31 finite live matrix used **six upstream requests, no retries**: Radiohead → book and Studio Ghibli → book completed UI adoption/save/give/reload/source trace. Jane Austen was explicitly confirmed as an author from the actual search; its movie combination completed API-only validation, not a third full UI closure. Relevance is broad/uncertain in places. [Public response evidence and qualitative comparison](docs/evidence/q100-live-20261031.json) distinguish real responses from synthetic tests.

See the [2–3 minute judge guide](docs/judging-guide.md).

## Production output and release preparation

```sh
npm run build
npm run start:production -- --test-server
# http://127.0.0.1:8084/ — isolated production export, credentials blank
```

For an explicit local live-credential preview, use `--local-env` instead. Do not run that mode as part of ordinary tests. The older `npm start` preview still uses 8082 and requires stopping its development process first; use the independent 8084 production command for acceptance.

The build contains client **and server** output in `mobile/dist/web/`; uploading static HTML alone loses Qloo. `build` finalizes SDK 54's CommonJS API boundary. The legacy SQLite import stays in the eager bundle so its production worker remains self-contained; existing data migration/recovery is preserved.

The prepared [single-process container/host guide](docs/deployment.md) includes HTTPS origin checks, a durable quota volume, conservative daily/minute upstream budgets, a two-request concurrency cap and failure behavior. `Dockerfile` is prepared but unbuilt because Docker is unavailable on this host. There is no public deployment. Do not use this quota design with multiple instances or ephemeral storage.

`npm run release:prepare` creates a **private review draft** under `.local/releases/`, with SHA-256 file manifest, excluding secrets, personal databases, debug history, supplied design reference and original briefs. It is not permission to publish. Its root MIT LICENSE and 12-file asset allowlist are included; unused inherited template artwork is excluded. See [third-party notices](docs/third-party-notices.md) and [security triage](docs/security-review-20261031.md).

## Verification

```sh
npm test
npm run lint
npm run typecheck
npm run test:r1
npm run test:r2
npm run test:r3
npm run test:e2e
npm run test:temilo
npm run build
npm run test:production
npm run check:secrets
npm run check:assets
```

- Unit/integration tests cover dates, schema compatibility, repository/accounting, source evidence, Adapter failures and durable quota.
- R1 covers context/source continuity, failures and real two-tab stock contention. R3 covers response barriers, dirty input, radio keyboard behavior and successful fixture exploration through saved history. Fixtures are **not live API evidence**.
- R2 checks 320/390/430/1280 widths with 0/1/2/8 cards, long names, today, no-date friends, save/discard/navigation, synthetic 200% text scaling and a short viewport. These are not user visual approval or physical-device keyboard/screen-reader checks.
- Baseline and long-journey suites cover navigation, actual demo/reset isolation, refresh and missing-key behavior. `test:visual` additionally captures the shared demo.
- Production tests use the built export, real routes/assets/IndexedDB, API rejection states and restart-persistent quota. They intentionally use blank credentials.
- Fresh source/client secret scans inspect actual configured credentials without printing them.

Ordinary browser tests own **8083**, blank Qloo credentials and disable dotenv. Production tests own **8084**, with a short-lived owned 8085 process for quota restart tests. They refuse an occupied port and use fresh synthetic browser contexts. Run suites sequentially when they share a port. No test opens the user's browser profile or SQLite data. Test logs, traces, profiles, snapshots and builds are ignored.

## Storage, privacy and limitations

Six validated collections remain: Person, Occasion, Wish, InventoryItem, GiftRecord, TasteRun; schema version 1 is retained. Web uses IndexedDB `gift-memory-mobile-web`, separate personal/demo keys, Web Locks and BroadcastChannel. Native uses SQLite. Existing legacy SQLite values are validated/copied once, with the original retained. Before the first R1 write, the raw prior snapshot is retained as a technical recovery copy; read-time errors pause editing instead of presenting an empty space. Never delete databases to fix a loading/migration issue.

Storage is local and unencrypted; clearing browser/app storage can remove records. There is no cloud sync, payment, shipping, public sharing or forced friend account. Native source is retained, but APK/IPA builds and physical-device acceptance are outside this browser release preparation.

Current dependency audit remains non-clean: **zero high/moderate/critical, eleven low package entries**. SDK54-compatible decoder/image-parser packages resolve the former four high entries; 100 unit tests include six dedicated compatibility/security regressions. The remaining low entries propagate from deepmerge in reviewed Expo build configuration, excluded from the minimal runtime. See the precise [security report](docs/security-review-20261031.md). Local functionality is not equivalent to formal submission readiness.

## Preservation and source history

`npm run baseline:create` scans source, then copies tracked/unignored source to `.local/baselines/` with hashes; it excludes credentials/dependencies/builds/data. It is not a personal backup, Git commit or public repository. This repository currently has **main with no HEAD/commit**. The night run used verified source snapshots in the original checkout because a managed Worktree cannot be created from a nonexistent HEAD. No author identity was invented.

The legacy `legacy:*` scripts remain available for the previous Next application. They are not acceptance of the current Expo app. Portable verification and remaining gates are summarized in [release status](docs/release-status.md). The detailed local night report and command ledger are retained privately for the project owner.
