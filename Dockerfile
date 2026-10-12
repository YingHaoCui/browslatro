FROM node:24-bookworm-slim AS build
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ENV http_proxy=${HTTP_PROXY} https_proxy=${HTTPS_PROXY} no_proxy=${NO_PROXY}
ARG SITE_URL=http://browslatro.internal
ENV SITE_URL=${SITE_URL}
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN if [ -n "${HTTP_PROXY}" ]; then export YARN_HTTP_PROXY="${HTTP_PROXY}"; fi && \
    if [ -n "${HTTPS_PROXY:-${HTTP_PROXY}}" ]; then export YARN_HTTPS_PROXY="${HTTPS_PROXY:-${HTTP_PROXY}}"; fi && \
    node .yarn/releases/yarn-4.15.0.cjs install --immutable
COPY . .
RUN node .yarn/releases/yarn-4.15.0.cjs build && \
    node .yarn/releases/yarn-4.15.0.cjs workspaces focus --production

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/scripts/serve.ts ./scripts/serve.ts
COPY --from=build --chown=node:node /app/scripts/mcp ./scripts/mcp
COPY --from=build --chown=node:node /app/src/mcp/protocol.ts ./src/mcp/protocol.ts
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/serve.ts"]
