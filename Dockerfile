# syntax=docker/dockerfile:1
FROM docker.io/library/node:26.13.1-alpine3.24@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS node-base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM node-base AS backup-crypto
ADD --checksum=sha256:cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10 https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz /tmp/age.tar.gz
RUN tar -xzf /tmp/age.tar.gz -C /tmp && /tmp/age/age --version

FROM node-base AS dependencies
ARG TARGETARCH
RUN test "$TARGETARCH" = "amd64"
RUN npm install --global pnpm@12.10.1 && test "$(pnpm --version)" = "12.10.1"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
# Synthetic configuration loads the schema only. Runtime settings are passed separately.
RUN APP_ENV=test \
    SITE_ORIGIN=http://127.0.0.1:3000 \
    PAYLOAD_SECRET=synthetic-image-build-only-not-a-runtime-secret \
    DATABASE_URI=postgres://synthetic:synthetic@127.0.0.1:5432/a_design_for_life_rebuild \
    MEDIA_BUCKET=adfl-test-image-build \
    pnpm build \
    && node ops/image/assemble-standalone.mjs . .work/next-build/standalone \
    && node ops/backup/build-runtime.mjs . .work/next-build/standalone

FROM docker.io/library/postgres:17.11-alpine3.24@sha256:e4cb93687b062cd25a0e8f672d85a7708235009d70d31f8a7698d9370092a9c4 AS runtime
WORKDIR /app
ARG SOURCE_REVISION=draft-uncommitted
LABEL org.opencontainers.image.title="A Design for Life" \
      org.opencontainers.image.revision="$SOURCE_REVISION"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Keep UID/GID 70 so existing PostgreSQL and application volumes retain access.
RUN apk add --no-cache ca-certificates libatomic libstdc++ tar \
    && apk add --no-cache --virtual .account-tools shadow \
    && test "$(id -u postgres):$(id -g postgres)" = "70:70" \
    && usermod --login appuser --shell /sbin/nologin postgres \
    && apk del .account-tools \
    && test "$(id -u appuser):$(id -g appuser)" = "70:70" \
    && if [ ! -e /usr/bin/tar ]; then ln -s /bin/tar /usr/bin/tar; fi \
    && /usr/bin/tar --version | head -n 1 | grep -Fx 'tar (GNU tar) 1.35' \
    && mkdir -p .work/publication .work/private-media .work/editorial-mail .work/next-build/cache .work/backup-private .work/backup-sets \
    && chown -R 70:70 .work \
    && chmod 0700 .work/backup-private .work/backup-sets
COPY --from=node-base /usr/local/bin/node /usr/local/bin/node
COPY --from=backup-crypto /tmp/age/age /opt/adfl-age/age
COPY --from=builder --chown=70:70 /app/.work/next-build/standalone ./
COPY --from=builder --chown=70:70 /app/.work/next-build/static ./.work/next-build/static
COPY --from=builder --chown=70:70 /app/public ./public
COPY --chown=70:70 ops/image/health-probe.mjs ops/image/runtime-smoke.mjs ops/image/start-local-stack.mjs ops/image/staging-mode.mjs ./ops/image/
USER appuser
RUN node --input-type=module -e 'import { writeFileSync } from "node:fs"; const revision = process.argv[1]; if (!/^(?:[a-f0-9]{40}|draft-[a-z0-9][a-z0-9.-]{0,100})$/.test(revision)) process.exit(1); writeFileSync("ops/image/build-identity.json", JSON.stringify({ revision }) + "\n", { flag: "wx" });' "$SOURCE_REVISION" \
    && node ops/image/runtime-smoke.mjs
EXPOSE 3000 5432
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "ops/image/health-probe.mjs"]
ENTRYPOINT []
CMD ["node", "server.js"]
