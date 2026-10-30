# TEMILO on Netlify

Status: public release live at **https://temilo-q100.netlify.app**. Production deploy `6ae5261ded99e2640df0b621` completed on October31 07:20 Asia/Shanghai. Public core and a separate two-request real Qloo closure passed. Source: https://github.com/Flower600129/temilo-q100. Render is paused. Use the existing Flower600129 Free credit-plan team; do not upgrade, buy credits, enable recharge, or replace its three unrelated sites. The owner reported 299.5/300 remaining credits and $0.00 on October 31, 2026. This is an observation, not a reserved budget or future usage guarantee.

## Architecture

- Expo SDK54 client assets are served by the CDN from `mobile/dist/web/client`.
- A modern Functions entry uses the installed `expo-server@1.0.7` Netlify adapter with `mobile/dist/web/server`. Static assets win before the catch-all function. Dynamic links and refresh use the same exported route manifest.
- The existing three `/api/taste/*` handlers and Qloo Adapter are reused. Only explicit cultural signals/IDs and target categories reach Qloo; never recipient records.
- Browser IndexedDB, six business collections, personal/demo separation and legacy SQLite preservation are unchanged. Native SQLite stays on the device. A new domain has a separate browser origin; localhost records are not automatically transferred.
- Netlify Database stores one anonymous aggregate quota row. It contains UTC day, spent units, rolling-minute timestamps/costs and random expiring lease tokens. It contains no IPs, cultural text, names, dates, gift notes or business records.

`netlify.toml` includes all server output and explicitly includes Expo's CommonJS runtime. Do not upload the server directory as CDN assets. Static response security headers are in the configuration; the function sets the same headers on its own responses, including COOP/COEP for the retained SQLite Worker path.

## Limits and failure behavior

Before the API runs, a SQL transaction locks the shared quota row. Resolve reserves three conservative upstream units; explore reserves one. Default limits are 60 per UTC day, 12 per rolling minute, and two active upstream-bearing operations across instances. Costs are never refunded after failures or cancellation. No retries are automatic. The adapter retains its eight-second per-upstream timeout and strict schemas.

Lease release is idempotent. Crashed functions leave a lease for at most 90 seconds, longer than Netlify's 60-second synchronous execution cap. Database connection/statement/lock waiting is bounded. Missing, malformed, inaccessible or corrupted quota storage returns an honest unavailable response without running the API. The database can sleep between uses; a cold-start failure is not permission to bypass quota.

A Free-supported code rate rule also limits dynamic function invocations to 120/minute per domain+IP. Edge enforcement can lag and does not replace the SQL provider budget. The platform meters requests/compute even when applications reject requests; its account credit hard limit remains the final hosting-spend boundary.

## Reproduce local acceptance

```sh
npm ci
npm run build:netlify
npm run test:netlify
npm run package:netlify:test
npm run test:netlify:e2e
npm run lint
npm run typecheck
```

`build:netlify` explicitly blanks Qloo credentials and disables dotenv for the Web export. Never add a real key to build arguments, public variables or `netlify.toml`.

For ZIP acceptance, `package:netlify:test` reads the configured `included_files` and Node24 settings and uses the pinned official packaging library. Then `npm run test:netlify:e2e` extracts `.local/q100-netlify/functions/temilo.zip` to a fresh temporary directory outside the project, invokes its actual entry with a simulated Netlify context, uses an isolated local SQL engine, and opens a new browser context on owned loopback8084. It uses blank credentials and no Qloo network. This is packaging/browser evidence, not hosted acceptance.

CLI27.16.1's standalone `functions:build` was found to omit TOML bundle options; its default ZIP missed Expo CJS files. The documented official `@netlify/zip-it-and-ship-it` API with the actual TOML options is used for the local configured ZIP. Full `netlify build --offline --filter mobile` also failed in DB setup with `Cannot read properties of undefined (reading 'createSiteDatabase')` before a network API exists. No cloud DB was created; do not invent internal API/token workarounds. The subsequent connected production pipeline successfully provisioned the database and applied the migration; actual public resolve/explore requests passed. The offline error remains historical tooling evidence.

## Approve and publish

Before publishing, ask the owner to approve a new dedicated `temilo-q100` project (or its available returned name), Free-plan Database for anonymous quota, private Functions-scoped Qloo credentials, and the reviewed source update. Do not create the site twice or publish before approval. No paid services/upgrades/recharge are permitted.

Use the repository root as base and the existing `mobile` workspace as the CLI filter. Use Node24.15.0. Disable implicit legacy Next.js detection/adapter setup: this deployment is the explicitly configured Expo output. Do not alter unrelated sites.

Create/link the approved empty project using documented tools/CLI. Let the standard deployment pipeline provision the detected `@netlify/database` dependency and apply the committed `netlify/database/migrations` file. Do not apply DDL through direct SQL or reset hosted data. If provisioning fails, record the exact error/deploy URL and stop that operation; do not extract tokens or invoke internal endpoints.

Free cannot select per-site Functions scopes (that feature needs Pro); the scoped API attempt returned403 before any key was sent. This release instead uses the official CLI **per-deploy** `--env` and `--secret-env` options, which apply only to the deployed Functions. The Qloo key is secret/masked and never enters build variables. The approved deployment passed without upgrading. Supply all these values to each later production publish; they are not persistent site variables:

| Name | Value |
| --- | --- |
| `QLOO_API_KEY` | Existing event credential, loaded securely from the original local configuration without logging/copying that file |
| `QLOO_BASE_URL` | `https://hackathon.api.qloo.com` |
| `TEMILO_PUBLIC_ORIGIN` | Exact approved HTTPS site origin, without trailing slash/path |
| `TEMILO_QLOO_DAILY_UNITS` | `60` conservative units, or a lower confirmed provider allowance |
| `TEMILO_QLOO_MINUTE_UNITS` | `12` conservative units |

Use platform-injected database credentials; never commit or log them. Runtime environment changes need a new deployment. Public access is enabled for judges. Do not enable continuous deployment while the release is under review. Plan one production publish (15 credits); troubleshoot locally first, not through repeated production deploys. Free credits cover Functions/DB compute and bandwidth; preserve judging availability and monitor remaining shared credits.

## Public acceptance and handoff

Record actual site/deploy IDs, URL, source commit, build logs and publish time. In a fresh public browser verify routes, navigation, demo isolation, fonts/Worker, direct links/refresh, plan/give/undo/stock and reload persistence. Make at most one Radiohead resolve plus one book explore through the public backend, no automatic retries or private signals; then adopt/save/give/reload/trace the result. Record the real request count, statuses, timing and candid relevance judgment. Local six-call evidence does not substitute for this.

The hosted API succeeded using the shared SQL ledger, but concurrent load/cold-start distributions and edge-limit thresholds were not stress-tested. The single-process local engine does not establish those properties. Do not stress-test Qloo to trigger provider throttling. Keep UI/manual gifting available when exploration is unavailable. Leave formal Devpost submission and its receipt to the owner, before October31 11:45 Asia/Shanghai.

References: [Expo Netlify adapter](https://docs.expo.dev/router/web/api-routes/#netlify), [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/), [rate limits](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/), [pricing](https://www.netlify.com/pricing/).

The default optional Powered by Netlify badge intercepted the mobile Friends navigation. It was disabled only for this project using the documented project setting, with no redeploy or plan change. Four actual navigation links were then rechecked.
