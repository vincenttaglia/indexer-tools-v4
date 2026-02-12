#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Runtime configuration injection
#
# Generates /usr/share/nginx/html/config.json from environment variables.
# The Vue app fetches this file at startup and applies the values as defaults
# (only when the user has no existing localStorage configuration).
# ---------------------------------------------------------------------------

CONFIG_FILE="/usr/share/nginx/html/config.json"

cat > "$CONFIG_FILE" <<EOF
{
  "theGraphApiKey": "${GRAPH_API_KEY:-}",
  "drpcApiKey": "${DRPC_API_KEY:-}",
  "accounts": ${DEFAULT_ACCOUNTS:-[]}
}
EOF

# ---------------------------------------------------------------------------
# Nginx proxy configuration
#
# If AGENT_PROXY_URL or GRAPHMAN_PROXY_URL are set, generate proxy location
# blocks so the browser can reach internal APIs through this container.
# This is useful when the agent/graphman APIs are on the same Docker network
# but not directly reachable from the user's browser.
# ---------------------------------------------------------------------------

NGINX_CONF="/etc/nginx/conf.d/default.conf"
PROXY_CONF=""

if [ -n "${AGENT_PROXY_URL:-}" ]; then
  PROXY_CONF="${PROXY_CONF}
    # Reverse proxy to Indexer Agent Admin API
    location /api/agent/ {
        proxy_pass ${AGENT_PROXY_URL};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
"
fi

if [ -n "${GRAPHMAN_PROXY_URL:-}" ]; then
  PROXY_CONF="${PROXY_CONF}
    # Reverse proxy to Graphman API
    location /api/graphman/ {
        proxy_pass ${GRAPHMAN_PROXY_URL};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
"
fi

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
    gzip_vary on;

    # Cache static assets aggressively (hashed filenames from Vite)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Runtime config (never cache — regenerated on container start)
    location = /config.json {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
${PROXY_CONF}
    # SPA fallback - serve index.html for all non-file routes
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

exec "$@"
