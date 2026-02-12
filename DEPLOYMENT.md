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
