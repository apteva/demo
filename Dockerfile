# ─── Stage 1: Build ───
FROM oven/bun:1 AS builder

WORKDIR /build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json build.ts ./
COPY src/ ./src/
RUN bun run build

# ─── Stage 2: Runtime (nginx) ───
FROM nginx:alpine

COPY --from=builder /build/dist/ /usr/share/nginx/html/

# The nginx config has a ${APTEVA_SERVER_URL} placeholder that we resolve
# at container start — copy it as a template so nginx's built-in envsubst
# entrypoint (/docker-entrypoint.d/20-envsubst-on-templates.sh) expands
# it into /etc/nginx/conf.d/default.conf before nginx starts.
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Default upstream — override by setting APTEVA_SERVER_URL on the
# container (e.g. http://apteva-server:8080).
ENV APTEVA_SERVER_URL=http://apteva-server:8080

# Restrict envsubst to our one placeholder. Without this filter nginx's
# own runtime variables ($uri, $host, $scheme, …) would be wiped out.
ENV NGINX_ENVSUBST_FILTER=APTEVA_SERVER_URL

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
