# Deployment Guide

## Quick Start (Docker)

```bash
docker compose up -d
```

Open http://localhost:3000 and configure your API keys and indexer accounts in **Settings**.

## Pre-configured Deployment

Set environment variables in `docker-compose.yml` to pre-populate settings for new users (before they configure anything in the browser). Existing localStorage settings always take precedence.

### API Keys

```yaml
environment:
  GRAPH_API_KEY: "your-graph-api-key"
  DRPC_API_KEY: "your-drpc-api-key"
```

### Default Accounts

Pre-configure one or more indexer accounts:

```yaml
environment:
  DEFAULT_ACCOUNTS: >
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

If the Indexer Agent or Graphman APIs are on an internal Docker network that the user's browser cannot reach directly, enable the built-in nginx reverse proxy.

### Setup

```yaml
environment:
  AGENT_PROXY_URL: "http://indexer-agent:8000/"
  GRAPHMAN_PROXY_URL: "http://graph-node:8050/"
  DEFAULT_ACCOUNTS: >
    [
      {
        "address": "0xYOUR_INDEXER_ADDRESS",
        "chain": "arbitrum-one",
        "label": "My Indexer",
        "agentEndpoint": "/api/agent/",
        "graphmanEndpoint": "/api/graphman/",
        "graphmanToken": "your-bearer-token"
      }
    ]
```

When proxy URLs are set:
- Browser requests to `/api/agent/*` are forwarded to `AGENT_PROXY_URL`
- Browser requests to `/api/graphman/*` are forwarded to `GRAPHMAN_PROXY_URL`
- Account endpoints should use the relative paths (`/api/agent/`, `/api/graphman/`)

### When to use the proxy

| Scenario | Proxy needed? |
|----------|--------------|
| Indexer-tools on the same machine as graph-node | No (use `http://localhost:8050`) |
| Indexer-tools on the same Docker network | Yes (browser can't reach internal hostnames) |
| Indexer-tools on a different machine | No (use the remote machine's IP/hostname) |

## Docker Compose with Indexer Stack

Example integrating indexer-tools into an existing indexer Docker Compose setup:

```yaml
services:
  # ... your existing graph-node, indexer-agent, etc. ...

  indexer-tools:
    image: ghcr.io/vincenttaglia/indexer-tools-v4:latest
    ports:
      - "3000:80"
    restart: unless-stopped
    environment:
      GRAPH_API_KEY: "your-graph-api-key"
      DRPC_API_KEY: "your-drpc-api-key"
      AGENT_PROXY_URL: "http://indexer-agent:8000/"
      GRAPHMAN_PROXY_URL: "http://graph-node:8050/"
      DEFAULT_ACCOUNTS: >
        [
          {
            "address": "0xYOUR_INDEXER_ADDRESS",
            "chain": "arbitrum-one",
            "label": "My Indexer",
            "agentEndpoint": "/api/agent/",
            "graphmanEndpoint": "/api/graphman/",
            "graphmanToken": "your-bearer-token"
          }
        ]
```

## Published Docker Images

Images are published to GitHub Container Registry on every push to `main` and on version tags:

```bash
# Latest from main
docker pull ghcr.io/vincenttaglia/indexer-tools-v4:main

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
| `DEFAULT_ACCOUNTS` | JSON array of indexer accounts |
| `AGENT_PROXY_URL` | Upstream URL for Agent API proxy (enables `/api/agent/`) |
| `GRAPHMAN_PROXY_URL` | Upstream URL for Graphman API proxy (enables `/api/graphman/`) |

## How Configuration Works

```
┌─────────────────────────────────────────────────────────┐
│ Docker Environment Variables                            │
│ GRAPH_API_KEY, DEFAULT_ACCOUNTS, etc.                   │
└──────────────────────┬──────────────────────────────────┘
                       │ docker-entrypoint.sh
                       ▼
┌─────────────────────────────────────────────────────────┐
│ /config.json (generated at container start)             │
│ { theGraphApiKey, drpcApiKey, accounts[] }              │
└──────────────────────┬──────────────────────────────────┘
                       │ fetch('/config.json') on app load
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Vue App Bootstrap (main.ts)                             │
│ Applies config as defaults IF localStorage is empty     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Pinia Stores (persisted to localStorage)                │
│ settingsStore: API keys, preferences                    │
│ accountStore: indexer accounts with endpoints            │
└─────────────────────────────────────────────────────────┘
```

User changes in the Settings page update localStorage and take precedence over the Docker defaults on subsequent loads.
