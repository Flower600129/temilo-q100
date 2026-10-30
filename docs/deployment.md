# Production deployment preparation (Netlify selected; not deployed)

The current output is **Expo SDK 54 server output**: `mobile/dist/web/client` plus `server`. A static-only upload drops the Qloo API. The selected topology is now [Netlify Functions plus anonymous transactional quota storage](netlify-deployment.md), using the existing Free account; the public release passed cloud initialization, publish and bounded live-Qloo acceptance. The following single-process Node24/container topology remains an alternative. The approved Netlify site is live; Render/container resources remain unprovisioned.

## Paused Render alternative

`render.yaml` prepares a paid `0.5c-512mb` Node web service with one 1 GB persistent disk, one instance, manual deploys and `/healthz`. Apply only after the owner approves publication, the hosting account and its actual displayed price. No Render resources have been provisioned by writing this file. Free ephemeral hosting does not preserve the quota ledger.

Use the repository root as the service root. Node is pinned to the locally tested 24.15.0. The build installs development build tools and explicitly blanks Qloo credentials for the export. `scripts/start-render.mjs` uses Render's `RENDER_EXTERNAL_URL` as the exact HTTPS origin and invokes the existing production launcher; it does not load `.env.local`. Enter the existing event key only in Render's private `QLOO_API_KEY` environment setting. Never upload the original environment file or put the key in a URL/build argument/client variable.

The 1 GB disk at `/var/data` stores only aggregate quota counts, not recipient records. Browser IndexedDB remains on the user's device. The health-check Host header must match the service's `onrender.com` hostname; do not add a custom domain until its exact origin and health behavior are deliberately configured. Confirm the service and disk prices in the creation review before any charge. Keep auto-deploy off during judging so a later repository push cannot silently change the evaluated version.

Official references: [Node services](https://render.com/docs/deploy-node-express-app), [persistent disks](https://render.com/docs/disks), [platform environment](https://render.com/docs/environment-variables), [health-check Host behavior](https://render.com/docs/health-checks), [Blueprint specification](https://render.com/docs/blueprint-spec).

## Reproduce locally

```sh
npm ci
npm run build
npm run start:production -- --test-server
# http://127.0.0.1:8084/ (isolated, blank Qloo key)
```

For the already configured local server credentials, use `npm run start:production -- --local-env` instead. This explicitly uses the existing root environment loader, without printing or copying credentials. The ordinary `npm run dev` preview remains on 8082. Stop only the production process in its own terminal before switching modes. The server refuses an occupied port.

`npm run test:production` starts/owns its own blank-key 8084 process after a build. Do not leave another 8084 server running when using that command. It uses new browser contexts and separate quota files.

## Prepared container recipe

`Dockerfile` builds the export, then copies only the generated client/server, the installed `expo-server` adapter, the small Node launcher and quota module into the runtime stage. The SDK 54 API bundles need a CommonJS package boundary; `build` generates it. A build toolchain is not exposed by the runtime image. `.dockerignore` excludes secrets, local evidence, data, dependencies and supplied reference artwork. Docker is unavailable on the development host: this recipe is **prepared, not container-build verified**.

Before running on a public host, configure:

| Variable | Value / requirement |
| --- | --- |
| `QLOO_API_KEY` | Server secret in the host's secret store; never a build arg or public variable |
| `QLOO_BASE_URL` | `https://hackathon.api.qloo.com`, subject to the event key's permission |
| `TEMILO_PUBLIC_ORIGIN` | Exact HTTPS origin, e.g. `https://<your-approved-domain>`; no trailing slash/path |
| `TEMILO_BIND` | `0.0.0.0` in the container; defaults to loopback for local use |
| `PORT` | Unprivileged internal port; container default 8080, local default 8084 |
| `TEMILO_QUOTA_FILE` | `/data/qloo-quota.json` on a persistent volume writable by UID 1000 |
| `TEMILO_QLOO_DAILY_UNITS` | Default 60 conservative upstream units per UTC day; set lower to fit actual event quota |
| `TEMILO_QLOO_MINUTE_UNITS` | Default 12 conservative units per minute |

The TLS proxy must preserve the public `Host` header, limit incoming URLs/headers and bodies, and route all paths to this one process. The app explicitly compares API Origin with the configured HTTPS origin; SDK 54's HTTP adapter otherwise constructs internal HTTP request URLs. A public binding without the HTTPS origin fails startup. Do not configure a wildcard or trust arbitrary forwarded host/origin values.

Reserve units **before** API execution: resolve costs 3 (the allowed maximum signals), explore costs 1. Even failed/invalid requests may consume this conservative allowance; there are no automatic retries. Both API routes share the same ledger. It survives graceful restart, applies a persisted minute window, and fails closed on corrupted/unwritable state. Concurrent upstream-bearing requests are capped at two; request bodies are capped at 4096 bytes; adapter calls retain their eight-second per-call timeout. The ledger stores counts/timestamps only, no IPs, interests or recipient records. Daily exhaustion returns 429 with a manual-gifting path.

Only one process may own a ledger. An exclusive lock rejects a second process. After a crash, the lock is deliberately **not automatically deleted**: an operator must verify that its recorded process is gone before removing the stale lock. Never delete the quota JSON to restore allowance. Do not horizontally scale or use ephemeral storage with this design; those require a shared transactional quota backend before launch. Exhaustion is a deliberate graceful degradation, not permission to increase a real provider limit.

## Public release gate

1. Review the [security triage](security-review-20261031.md) and [third-party notices](third-party-notices.md). Root MIT LICENSE now names Liuyun; active assets have a hash-checked permission allowlist. Use the curated source package, which includes the local security compatibility workspaces and excludes unverified unused template artwork.
2. Verify the Docker recipe on the chosen host, create a persistent volume and HTTPS origin, configure secrets privately, and deploy only with explicit human authorization.
3. In a fresh external browser/device, test demo isolation, direct links/refresh/fonts, a finite real Qloo direction, plan/give/undo/persistence and quota fallback. Localhost testing is not this gate.
4. Publish the reviewed source package to the public repository; record its URL/commit and the actual demo URL. Complete Devpost before the documented deadline and save the confirmation.
5. Keep the demo available during judging. Monitor aggregate quota/health without logging personal request payloads. Avoid deleting browser storage or quota history during rollback.

Rollback: retain the previous reviewed export/image and its compatible storage schema, stop the owned server, replace only the code image/export, then restart against the same quota volume. This is a source/runtime rollback, not a personal-data restore. Do not run an old incompatible build against new records or restore a snapshot over current browser data.

Implementation reference: [Expo API routes](https://docs.expo.dev/router/web/api-routes/). The implementation also checked the actually installed `expo-server@1.0.7` HTTP adapter and the SDK 54 CLI's server handler; newer SDK examples are not assumed compatible.
