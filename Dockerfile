# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve (rootless nginx, listens on 8080)
FROM nginxinc/nginx-unprivileged:stable-alpine
USER root
RUN apk add --no-cache jq
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html
# The entrypoint rewrites the nginx config and generates config.json at runtime,
# so those paths must be writable by the non-root user. Use gid 0 + group-write
# so the container also works under an arbitrary UID (e.g. OpenShift).
RUN chmod +x /docker-entrypoint.sh \
    && chown -R 101:0 /etc/nginx/conf.d /usr/share/nginx/html \
    && chmod -R g+w /etc/nginx/conf.d /usr/share/nginx/html
USER 101
EXPOSE 8080

# Report container health from nginx serving the runtime config it generates on start.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/config.json || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
