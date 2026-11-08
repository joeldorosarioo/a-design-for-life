# syntax=docker/dockerfile:1
FROM docker.io/library/node:24.22.2-trixie-slim@sha256:54f84b4cf8432b21aaffd5d3ce8d41e12cea0d10d33c09d2f3c9879d49d6b446 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
ARG TARGETARCH
RUN test "$TARGETARCH" = "amd64"
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate && test "$(pnpm --version)" = "12.10.1"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile && rm -rf .work/pnpm-store

FROM dependencies
ARG POSTGRES_CLIENT_VERSION=17.11-0+deb13u1
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates "postgresql-client-17=$POSTGRES_CLIENT_VERSION" \
    && rm -rf /var/lib/apt/lists/*
COPY testing/setup/install-age.mjs ./testing/setup/install-age.mjs
RUN node testing/setup/install-age.mjs \
    && install -D -m 0755 .toolchain/age-1.3.2-linux-x64/bin/age /opt/adfl-age/age \
    && /opt/adfl-age/age --version \
    && /usr/lib/postgresql/17/bin/pg_dump --version \
    && /usr/bin/tar --version \
    && rm -rf .toolchain .work/age-downloads
COPY tsconfig.json ./
COPY src ./src
COPY ops/backup ./ops/backup
COPY ops/migrations/controlled.ts ./ops/migrations/controlled.ts
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p .work/backup-private .work/backup-sets .work/publication .work/private-media \
    && chown 10001:10001 .work .work/backup-private .work/backup-sets .work/publication .work/private-media \
    && chmod 0700 .work/backup-private .work/backup-sets
ARG SOURCE_REVISION=draft-uncommitted
ARG SOURCE_SHA256
ENV NODE_ENV=production \
    OPS_SOURCE_REVISION=$SOURCE_REVISION \
    OPS_SOURCE_SHA256=$SOURCE_SHA256
LABEL org.opencontainers.image.title="A Design for Life operational backup" \
      org.opencontainers.image.revision="$SOURCE_REVISION"
USER 10001:10001
ENTRYPOINT ["node", "--conditions=react-server", "--import", "tsx", "ops/backup/job.ts"]
CMD ["backup"]
