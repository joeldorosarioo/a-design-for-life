# syntax=docker/dockerfile:1
FROM docker.io/library/node:24.22.2-alpine3.24@sha256:4eefa1bfce4197942661ef9148247d779ddf1bb0ee006d3294a467609de60724 AS node-base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM node-base AS qpdf
# Build the approved QPDF release for musl with the upstream tarball checksum.
RUN apk add --no-cache build-base cmake ninja pkgconf libjpeg-turbo-dev openssl-dev zlib-dev
ADD --checksum=sha256:8a58af5b6141319287c1883bec8bd1bd545b7567b7fc5e6ce5d25a1c85f36397 https://github.com/qpdf/qpdf/releases/download/v12.4.2/qpdf-12.4.2.tar.gz /tmp/qpdf.tar.gz
RUN mkdir /tmp/qpdf-source && tar -xzf /tmp/qpdf.tar.gz -C /tmp/qpdf-source --strip-components=1 \
    && cmake -G Ninja -S /tmp/qpdf-source -B /tmp/qpdf-build \
        -DCMAKE_BUILD_TYPE=MinSizeRel -DBUILD_SHARED_LIBS=OFF -DBUILD_STATIC_LIBS=ON \
        -DUSE_IMPLICIT_CRYPTO=OFF -DREQUIRE_CRYPTO_OPENSSL=ON \
    && cmake --build /tmp/qpdf-build --target qpdf --parallel 3 \
    && install -D -s /tmp/qpdf-build/qpdf/qpdf /opt/qpdf/bin/qpdf

FROM node-base AS backup-crypto
ADD --checksum=sha256:cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10 https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz /tmp/age.tar.gz
RUN tar -xzf /tmp/age.tar.gz -C /tmp && /tmp/age/age --version

FROM node-base AS dependencies
ARG TARGETARCH
RUN test "$TARGETARCH" = "amd64"
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate && test "$(pnpm --version)" = "12.10.1"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
# Synthetic configuration loads the schema only. Runtime settings are passed separately.
RUN APP_ENV=test \
    SITE_ORIGIN=http://127.0.0.1:3000 \
    PAYLOAD_SECRET=synthetic-image-build-only-not-a-runtime-secret \
    DATABASE_URI=postgres://synthetic:synthetic@127.0.0.1:9/adfl_test_image_build \
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
    HOSTNAME=0.0.0.0 \
    MEDIA_CHECKER_BINARY=/opt/qpdf/bin/qpdf
# Keep UID/GID 70 so existing PostgreSQL and application volumes retain access.
RUN apk add --no-cache ca-certificates libjpeg-turbo libstdc++ libcrypto3 zlib tar \
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
COPY --from=qpdf /opt/qpdf/bin/qpdf /opt/qpdf/bin/qpdf
COPY --from=backup-crypto /tmp/age/age /opt/adfl-age/age
COPY --from=builder --chown=70:70 /app/.work/next-build/standalone ./
COPY --from=builder --chown=70:70 /app/.work/next-build/static ./.work/next-build/static
COPY --from=builder --chown=70:70 /app/public ./public
COPY --chown=70:70 ops/image/health-probe.mjs ops/image/runtime-smoke.mjs ops/image/start-local-stack.mjs ops/image/staging-mode.mjs ./ops/image/
USER appuser
RUN node --input-type=module -e 'import { writeFileSync } from "node:fs"; const revision = process.argv[1]; if (!/^(?:[a-f0-9]{40}|draft-[a-z0-9][a-z0-9.-]{0,100})$/.test(revision)) process.exit(1); writeFileSync("ops/image/build-identity.json", JSON.stringify({ revision }) + "\n", { flag: "wx" });' "$SOURCE_REVISION" \
    && node ops/image/runtime-smoke.mjs
COPY --from=qpdf /tmp/qpdf-source/LICENSE.txt /opt/qpdf/LICENSE.txt
EXPOSE 3000 5432
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "ops/image/health-probe.mjs"]
ENTRYPOINT []
CMD ["node", "server.js"]
