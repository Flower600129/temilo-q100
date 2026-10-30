FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY mobile/package.json ./mobile/package.json
COPY vendor ./vendor
RUN npm ci
COPY . .
RUN npm run build

# Only the SDK 54 server adapter and exported bundles are needed at runtime.
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080 TEMILO_BIND=0.0.0.0 TEMILO_QUOTA_FILE=/data/qloo-quota.json
COPY --from=build --chown=node:node /app/node_modules/expo-server ./node_modules/expo-server
COPY --from=build --chown=node:node /app/mobile/dist/web ./mobile/dist/web
COPY --from=build --chown=node:node /app/scripts/serve-production.mjs ./scripts/serve-production.mjs
COPY --from=build --chown=node:node /app/src/qloo/quota.server.ts ./src/qloo/quota.server.ts
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('node:http').get({hostname:'127.0.0.1',port:process.env.PORT,path:'/healthz',headers:{Host:new URL(process.env.TEMILO_PUBLIC_ORIGIN).host}},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "scripts/serve-production.mjs"]
