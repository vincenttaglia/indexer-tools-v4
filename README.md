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

The reward earned by allocating `a` GRT to a deployment follows:

```
reward = (signal / totalSignal) * issuancePerDay * a / (D + a)
where D = other indexers' stake on the deployment
```

This has diminishing returns — each additional GRT earns less, since your own allocation dilutes its own reward share.

### How It Works

A **water-filling** allocator walks the budget in 1000 chunks, handing each chunk to the deployment with the highest **marginal** reward at its current allocation:

```
d(reward)/dA = R * D / (D + A)^2
where R = (signal / totalSignal) * issuancePerDay   (reward pool)
      D = other indexers' stake on the deployment
      A = amount already allocated this run
```

Allocating to the steepest marginal at each step drives the budget toward the deployments where it earns the most, and naturally tapers off a deployment as it saturates. The chunked approach (1000 discrete steps) is approximate rather than closed-form, which is what lets it honor the per-deployment constraints below.

### Constraints

- **Per-deployment caps** — `min(maxAllocationPct × budget, maxAllocationGrt)`, whichever is tighter; a deployment stops receiving chunks once it hits its cap
- **Risky-deployment caps** — deployments flagged risky use the tighter `riskyAllocationPct` / `riskyAllocationGrt` caps instead
- **Minimum allocation** — any funded deployment below `minAllocationGrt` is bumped up to the floor (within its cap and remaining budget)
- **Zero-other-stake deployments** — win a single chunk first (marginal is infinite at A=0), then fall back into the normal ranking
- **Zero-signal deployments** — kept in the results but receive nothing (they earn zero rewards regardless)

The caps and risky-deployment settings are configured on the **Settings** page.

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
