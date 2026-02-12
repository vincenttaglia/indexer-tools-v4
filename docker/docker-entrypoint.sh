#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Runtime configuration injection + per-account API proxy
#
# 1. Reads DEFAULT_ACCOUNTS JSON and generates nginx proxy locations for each
#    account's agentEndpoint and graphmanEndpoint (when they are HTTP URLs).
# 2. Rewrites those endpoints in config.json to use the proxy paths so the
#    browser reaches internal services through this container.
# 3. Generates /usr/share/nginx/html/config.json for the Vue app to load.
# ---------------------------------------------------------------------------

CONFIG_FILE="/usr/share/nginx/html/config.json"
NGINX_CONF="/etc/nginx/conf.d/default.conf"
ACCOUNTS_JSON="${DEFAULT_ACCOUNTS:-[]}"
PROXY_CONF=""

# Parse accounts and generate per-account proxy locations.
# For each account at index N:
#   - agentEndpoint "http://..." → proxy at /api/agent/N/, rewrite to "/api/agent/N/"
#   - graphmanEndpoint "http://..." → proxy at /api/graphman/N/, rewrite to "/api/graphman/N/"
# Endpoints that don't start with http are left as-is (already browser-reachable).

NUM_ACCOUNTS=$(echo "$ACCOUNTS_JSON" | jq 'length')
REWRITTEN_ACCOUNTS="$ACCOUNTS_JSON"

i=0
while [ "$i" -lt "$NUM_ACCOUNTS" ]; do
  AGENT_URL=$(echo "$ACCOUNTS_JSON" | jq -r ".[$i].agentEndpoint // \"\"")
  GRAPHMAN_URL=$(echo "$ACCOUNTS_JSON" | jq -r ".[$i].graphmanEndpoint // \"\"")

  # Proxy agent endpoint if it's an HTTP URL
  if echo "$AGENT_URL" | grep -q '^https\?://'; then
    # Ensure trailing slash for proper proxy_pass behavior
    AGENT_URL_SLASH=$(echo "$AGENT_URL" | sed 's|/*$|/|')
    PROXY_CONF="${PROXY_CONF}
    # Account $i: Indexer Agent Admin API
    location /api/agent/$i/ {
        proxy_pass ${AGENT_URL_SLASH};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
"
    REWRITTEN_ACCOUNTS=$(echo "$REWRITTEN_ACCOUNTS" | jq ".[$i].agentEndpoint = \"/api/agent/$i/\"")
  fi

  # Proxy graphman endpoint if it's an HTTP URL
  if echo "$GRAPHMAN_URL" | grep -q '^https\?://'; then
    GRAPHMAN_URL_SLASH=$(echo "$GRAPHMAN_URL" | sed 's|/*$|/|')
    PROXY_CONF="${PROXY_CONF}
    # Account $i: Graphman API
    location /api/graphman/$i/ {
        proxy_pass ${GRAPHMAN_URL_SLASH};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
"
    REWRITTEN_ACCOUNTS=$(echo "$REWRITTEN_ACCOUNTS" | jq ".[$i].graphmanEndpoint = \"/api/graphman/$i/\"")
  fi

  i=$((i + 1))
done

# Write config.json with rewritten proxy paths
cat > "$CONFIG_FILE" <<EOF
{
  "theGraphApiKey": "${GRAPH_API_KEY:-}",
  "drpcApiKey": "${DRPC_API_KEY:-}",
  "accounts": $(echo "$REWRITTEN_ACCOUNTS" | jq -c '.')
}
EOF

# Generate nginx config with proxy locations
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
