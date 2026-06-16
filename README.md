# Indexer Tools v4

Dashboard for [The Graph](https://thegraph.com/) indexers. Manage subgraph allocations, monitor QoS metrics, track query fees, and queue indexer-agent actions — all from a single interface.

## Features

- **Subgraphs Dashboard** — Browse all deployments with signal, APR estimates, and network filters
- **Allocations Dashboard** — View active allocations with APR, daily rewards, pending rewards, and health status
- **Allocation Wizard** — Select deployments and queue allocate/unallocate/reallocate actions with live APR previews and an [APR optimizer](#apr-optimizer)
- **Actions Manager** — View, approve, cancel, and execute queued indexer-agent actions
- **QoS Dashboard** — Per-allocation quality-of-service metrics (latency, blocks behind, success rate)
- **Query Fees Dashboard** — Per-deployment query fee breakdown
- **Deployment Status** — Sync progress and health for all indexed deployments
- **Offchain Sync** — Monitor offchain subgraph sync status
- **Settings** — Configure endpoints, indexer accounts, column visibility, and dark mode

## Quick Start (Docker)

```bash
docker pull ghcr.io/vincenttaglia/indexer-tools-v4:latest
```

Or with Docker Compose:

```yaml
services:
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
            "address": "0xYOUR_INDEXER_ADDRESS",
            "chain": "arbitrum-one",
            "label": "My Indexer",
            "agentEndpoint": "http://indexer-agent:8000/",
            "graphmanEndpoint": "http://graph-node:8050/",
            "graphmanToken": "your-bearer-token"
          }
        ]
```

Open http://localhost:3000. API keys and accounts can also be configured in **Settings** at any time.

HTTP endpoints in `DEFAULT_ACCOUNTS` are automatically proxied through nginx so the browser can reach services on internal Docker networks. See [DEPLOYMENT.md](DEPLOYMENT.md) for multi-account setups, proxy details, and integration with existing indexer stacks.

## Docker Images

Images are published to GitHub Container Registry:

| Tag | Source |
|-----|--------|
| `latest` | `main` branch |
| `dev` | `dev` branch |
| `v1.0.0` | Version tags |

```bash
docker pull ghcr.io/vincenttaglia/indexer-tools-v4:latest
```

## APR Optimizer

The allocation wizard includes an optimizer that distributes a GRT budget across selected subgraphs to maximize total daily rewards.

### How It Works

The reward earned by allocating `a_i` GRT to subgraph `i` follows:

```
reward_i = (signal_i / totalSignal) * issuancePerDay * a_i / (stake_i + a_i)
```

This has diminishing returns — each additional GRT earns less. The optimizer uses **Lagrange multipliers** to find the exact allocation split that maximizes total rewards. The closed-form solution is:

```
a_i = sqrt(signal_i * stake_i) * scale - stake_i
where scale = (budget + sum(stake_j)) / sum(sqrt(signal_j * stake_j))
```

Allocate proportionally to `sqrt(signal * stake)`. Subgraphs with high signal but low stake (under-allocated) get more. Subgraphs already saturated with stake get less. Zero iteration needed — this is the mathematically exact optimum.

### Edge Cases

- **Zero-signal subgraphs**: filtered out (earn zero rewards regardless)
- **Zero-stake subgraphs**: get minimum allocation (marginal reward is infinite at a=0)
- **Over-saturated subgraphs**: if the formula yields a negative allocation, it's fixed at minimum and the remaining budget is re-solved across the others
- **Integer rounding**: uses the largest-remainder method (Hamilton's method) to round to whole GRT while ensuring allocations sum exactly to the budget

## Development

```bash
npm install
npm run dev          # Start dev server on :3000
npm run build        # Type-check + production build
npm run preview      # Preview production build
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
```

Configure your API keys and endpoints in **Settings** (or copy `.env.example` to `.env` for build-time defaults).

## Tech Stack

- Vue 3 + TypeScript + Vite
- TanStack Table (headless) + TanStack Virtual (virtual scrolling)
- TanStack Query (server state with manual refresh)
- PrimeVue 4 (Aura theme) + PrimeIcons
- Pinia 3 (client state, persisted settings)
- graphql-request (multi-endpoint GraphQL)
- viem (Ethereum RPC)

## Project Structure

```
src/
  api/            # GraphQL queries, REST clients, transport layer
  components/     # Reusable UI components (DataTable, cells)
  composables/    # TanStack Query hooks and computation composables
  config/         # Runtime config loader (Docker env injection)
  layouts/        # AppLayout (sidebar + main content)
  router/         # Vue Router configuration
  services/       # Pure calculation functions (APR, rewards, optimizer)
  stores/         # Pinia stores (settings, filters, selections, accounts)
  styles/         # Global CSS
  types/          # TypeScript type definitions
  views/          # Route-level page components
docker/
  docker-entrypoint.sh   # Generates runtime config + nginx proxy
  nginx.conf             # Base nginx configuration
```

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Docker deployment, environment variables, per-account API proxy, integration with indexer stacks
- [k8s/](k8s/) — Kubernetes manifests (Deployment, Service, Ingress, Secret) with Kustomize support
