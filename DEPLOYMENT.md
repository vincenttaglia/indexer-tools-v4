# Deployment Guide

## Quick Start (Docker)

```bash
docker compose up -d
```

Open http://localhost:3000 and configure your API keys and indexer accounts in **Settings**.

## Pre-configured Deployment

Set environment variables in `docker-compose.yml` to pre-populate settings. API keys are only applied as defaults when localStorage is empty. Proxy endpoints (`agentEndpoint`, `graphmanEndpoint`, `graphmanToken`) are always applied on each boot since the entrypoint regenerates proxy paths.

### API Keys

```yaml
environment:
  GRAPH_API_KEY: "your-graph-api-key"
  DRPC_API_KEY: "your-drpc-api-key"
```

### Default Accounts

Pre-configure one or more indexer accounts. HTTP(S) endpoints in `agentEndpoint` and `graphmanEndpoint` are **automatically proxied** through nginx so the browser can reach services on internal Docker networks.

```yaml
environment:
  DEFAULT_ACCOUNTS: >
    [
      {
        "address": "0xINDEXER_A",
        "chain": "arbitrum-one",
        "label": "Indexer A",
        "agentEndpoint": "http://indexer-agent-a:8000/",
        "graphmanEndpoint": "http://graph-node-a:8050/",
        "graphmanToken": "bearer-token-a"
      },
      {
        "address": "0xINDEXER_B",
        "chain": "arbitrum-one",
        "label": "Indexer B",
        "agentEndpoint": "http://indexer-agent-b:8000/",
        "graphmanEndpoint": "http://graph-node-b:8050/",
        "graphmanToken": "bearer-token-b"
      }
    ]
```

Account fields:

| Field | Required | Description |
|-------|----------|-------------|
| `address` | Yes | Indexer Ethereum address (0x...) |
| `chain` | Yes | Network: `arbitrum-one`, `mainnet`, `sepolia`, `arbitrum-sepolia` |
| `label` | Yes | Display name |
| `agentEndpoint` | No | Indexer Agent Admin API URL |
| `graphmanEndpoint` | No | Graphman API URL (typically port 8050) |
| `graphmanToken` | No | Graphman Bearer token |

## API Proxy

When account endpoints are HTTP URLs (e.g., `http://indexer-agent:8000/`), the Docker entrypoint automatically sets up per-account nginx reverse proxy locations and rewrites the endpoints in the app config:

| Account Index | Agent Proxy Path | Graphman Proxy Path |
|---------------|-----------------|---------------------|
| 0 | `/api/agent/0/` | `/api/graphman/0/` |
| 1 | `/api/agent/1/` | `/api/graphman/1/` |
| 2 | `/api/agent/2/` | `/api/graphman/2/` |

This is transparent — you just set the real internal URLs in `DEFAULT_ACCOUNTS` and the entrypoint handles the rest. The browser sends requests to `/api/agent/0/` on this container, and nginx forwards them to `http://indexer-agent-a:8000/`.

Endpoints that don't start with `http://` or `https://` are left as-is (assumed to be already browser-reachable).

### When is the proxy used?

| Scenario | What to do |
|----------|------------|
| Indexer-tools on the same Docker network as the indexer | Set HTTP URLs in `DEFAULT_ACCOUNTS` — proxy is automatic |
| Indexer-tools on the same host (no Docker networking) | Use `http://localhost:8000` — no proxy needed, browser can reach it directly |
| Indexer-tools on a different machine | Use the remote IP/hostname — no proxy needed |

## Docker Compose with Indexer Stack

Example integrating indexer-tools into an existing indexer Docker Compose setup with multiple indexers:

```yaml
services:
  # ... your existing graph-node, indexer-agent services ...

  indexer-tools:
    image: ghcr.io/vincenttaglia/indexer-tools-v4:latest
    ports:
      - "3000:80"
    restart: unless-stopped
    environment:
      GRAPH_API_KEY: "your-graph-api-key"
      DRPC_API_KEY: "your-drpc-api-key"
      DEFAULT_ACCOUNTS: >
        [
          {
            "address": "0xINDEXER_A",
            "chain": "arbitrum-one",
            "label": "Indexer A",
            "agentEndpoint": "http://indexer-agent-a:8000/",
            "graphmanEndpoint": "http://graph-node-a:8050/",
            "graphmanToken": "bearer-token-a"
          },
          {
            "address": "0xINDEXER_B",
            "chain": "arbitrum-one",
            "label": "Indexer B",
            "agentEndpoint": "http://indexer-agent-b:8000/",
            "graphmanEndpoint": "http://graph-node-b:8050/",
            "graphmanToken": "bearer-token-b"
          }
        ]
```

The entrypoint generates proxy paths automatically:
- Indexer A: agent at `/api/agent/0/`, graphman at `/api/graphman/0/`
- Indexer B: agent at `/api/agent/1/`, graphman at `/api/graphman/1/`

## Published Docker Images

Images are published to GitHub Container Registry:

| Tag | Source |
|-----|--------|
| `latest` | `main` branch |
| `dev` | `dev` branch |
| `v1.0.0` | Version tags |

```bash
# Latest stable
docker pull ghcr.io/vincenttaglia/indexer-tools-v4:latest

# Development
docker pull ghcr.io/vincenttaglia/indexer-tools-v4:dev

# Specific version
docker pull ghcr.io/vincenttaglia/indexer-tools-v4:v1.0.0
```

## Kubernetes

Two options are supported: the **Helm chart** (recommended for clusters) or the **raw manifests** in [`k8s/`](k8s/).

The same environment variables (`GRAPH_API_KEY`, `DRPC_API_KEY`, `DEFAULT_ACCOUNTS`) work identically to Docker Compose — the entrypoint generates the nginx proxy config at pod start.

### Helm (recommended)

The chart is published at [vincenttaglia/helm-charts](https://github.com/vincenttaglia/helm-charts/tree/main/charts/indexer-tools-v4) and served from a GitHub Pages Helm repo.

```bash
helm repo add vincenttaglia https://vincenttaglia.github.io/helm-charts
helm repo update
helm search repo vincenttaglia/indexer-tools-v4

helm install indexer-tools vincenttaglia/indexer-tools-v4 \
  --namespace indexer-tools --create-namespace
```

The chart starts with no API keys and no accounts — you can configure both in **Settings** at runtime. To pre-configure, use a values file.

**API keys** are read from a Kubernetes Secret (the chart does not take keys inline, to keep them out of values/ConfigMaps). Create the Secret, then point the chart at it:

```bash
kubectl create secret generic indexer-tools-secrets \
  --namespace indexer-tools \
  --from-literal=GRAPH_API_KEY="your-graph-api-key" \
  --from-literal=DRPC_API_KEY="your-drpc-api-key"
```

```yaml
# values.yaml
existingSecret: indexer-tools-secrets
# secretKeys maps the chart's env vars to keys inside that Secret
# (defaults shown — override only if your Secret uses different field names):
secretKeys:
  graphApiKey: GRAPH_API_KEY
  drpcApiKey: DRPC_API_KEY

config:
  # JSON array string; HTTP endpoints are auto-proxied to /api/agent/<i>/ at pod start
  defaultAccounts: |
    [
      {
        "address": "0xYOUR_INDEXER_ADDRESS",
        "chain": "arbitrum-one",
        "label": "My Indexer",
        "agentEndpoint": "http://indexer-agent:8000/",
        "graphmanEndpoint": "http://graph-node:8050/",
        "graphmanToken": "your-bearer-token"
      }
    ]

ingress:
  enabled: false        # set true and configure hosts/tls to expose the service

# resources and autoscaling have sensible defaults (50m/64Mi requests,
# 200m/128Mi limits, autoscaling off) — override as needed.
```

```bash
helm upgrade --install indexer-tools vincenttaglia/indexer-tools-v4 \
  --namespace indexer-tools --create-namespace \
  -f values.yaml
```

> The key names above (`existingSecret`, `secretKeys`, `config.defaultAccounts`, `ingress`) reflect the chart's structure, but **`helm show values vincenttaglia/indexer-tools-v4` is the authoritative reference** — run it for exact keys, defaults, and the full ingress/resources/autoscaling schema.

### Raw manifests (Kustomize)

```bash
# Edit k8s/configmap.yaml with your API keys and accounts, then:
kubectl apply -k k8s/
```

This creates an `indexer-tools` namespace with a Deployment, Service, and ConfigMap. An Ingress manifest is included but commented out in `kustomization.yaml` — uncomment it and set your hostname to expose the service.

> **Note:** the manifests put `GRAPH_API_KEY` / `DRPC_API_KEY` in a ConfigMap, which is convenient but not secret-grade. For sensitive deployments, move those keys into a Kubernetes Secret (or use the Helm chart's `existingSecret`).

## Development

```bash
npm install
npm run dev          # Dev server on :3000
npm run build        # Type-check + production build
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
```

## Environment Variables Reference

### Build-time (Vite)

| Variable | Description |
|----------|-------------|
| `VITE_THEGRAPH_API_KEY` | The Graph API key (embedded at build) |
| `VITE_DRPC_API_KEY` | dRPC API key (embedded at build) |

### Runtime (Docker)

| Variable | Description |
|----------|-------------|
| `GRAPH_API_KEY` | The Graph API key (injected at container start) |
| `DRPC_API_KEY` | dRPC API key (injected at container start) |
| `DEFAULT_ACCOUNTS` | JSON array of indexer accounts (HTTP endpoints are auto-proxied) |

## How Configuration Works

```
┌─────────────────────────────────────────────────────────┐
│ Docker Environment Variables                            │
│ GRAPH_API_KEY, DRPC_API_KEY, DEFAULT_ACCOUNTS           │
└──────────────────────┬──────────────────────────────────┘
                       │ docker-entrypoint.sh
                       │  1. Parse accounts JSON
                       │  2. Generate nginx proxy for HTTP endpoints
                       │  3. Rewrite endpoints to proxy paths
                       ▼
┌─────────────────────────────────────────────────────────┐
│ /config.json (generated at container start)             │
│ { theGraphApiKey, drpcApiKey, accounts[] }              │
│ (endpoints rewritten: http://agent:8000 → /api/agent/0)│
└──────────────────────┬──────────────────────────────────┘
                       │ fetch('/config.json') on app load
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Vue App Bootstrap (main.ts)                             │
│ API keys applied as defaults; proxy endpoints always set │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Pinia Stores (persisted to localStorage)                │
│ settingsStore: API keys, preferences                    │
│ accountStore: indexer accounts with proxy endpoints      │
└─────────────────────────────────────────────────────────┘
```

User changes in the Settings page update localStorage and take precedence over Docker defaults for API keys. Proxy endpoints are always updated from the Docker environment on each container start to ensure proxy paths stay correct.
