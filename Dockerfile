# syntax=docker/dockerfile:1
# The verified QPDF distribution currently supports linux/amd64 only.
FROM docker.io/library/node:24.22.2-trixie-slim@sha256:54f84b4cf8432b21aaffd5d3ce8d41e12cea0d10d33c09d2f3c9879d49d6b446 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
ARG TARGETARCH
RUN test "$TARGETARCH" = "amd64"
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate && test "$(pnpm --version)" = "12.10.1"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
RUN apt-get update && apt-get install --yes --no-install-recommends ca-certificates unzip && rm -rf /var/lib/apt/lists/*
COPY . .
RUN node testing/setup/install-qpdf.mjs
# Synthetic configuration loads the schema only: no live credentials or production DB.
# These values are scoped to this RUN and never become final image environment defaults.
RUN APP_ENV=test \
    SITE_ORIGIN=http://127.0.0.1:3000 \
    PAYLOAD_SECRET=synthetic-image-build-only-not-a-runtime-secret \
    DATABASE_URI=postgres://synthetic:synthetic@127.0.0.1:9/adfl_test_image_build \
    MEDIA_BUCKET=adfl-test-image-build \
    pnpm build && node ops/image/assemble-standalone.mjs . .work/next-build/standalone

FROM base AS runtime
ARG SOURCE_REVISION=draft-uncommitted
LABEL org.opencontainers.image.title="A Design for Life" \
      org.opencontainers.image.revision="$SOURCE_REVISION"
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MEDIA_CHECKER_BINARY=/opt/qpdf/bin/qpdf
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin app
COPY --from=builder --chown=10001:10001 /app/.work/next-build/standalone ./
COPY --from=builder --chown=10001:10001 /app/.work/next-build/static ./.work/next-build/static
COPY --from=builder --chown=10001:10001 /app/public ./public
COPY --from=builder /app/.toolchain/qpdf-12.4.2-linux-x64 /opt/qpdf
COPY --chown=10001:10001 ops/image/health-probe.mjs ops/image/runtime-smoke.mjs ./ops/image/
RUN mkdir -p .work/publication .work/private-media .work/editorial-mail .work/next-build/cache && chown -R 10001:10001 .work
USER 10001:10001
RUN /opt/qpdf/bin/qpdf --version
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "ops/image/health-probe.mjs"]
CMD ["node", "server.js"]
