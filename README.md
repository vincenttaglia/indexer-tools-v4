# Indexer Tools v4

Dashboard for [The Graph](https://thegraph.com/) indexers. Manage subgraph allocations, monitor QoS metrics, track query fees, and queue indexer-agent actions — all from a single interface.

## Features

- **Subgraphs Dashboard** — Browse all deployments with signal, APR estimates, and network filters
- **Allocations Dashboard** — View active allocations with APR, daily rewards, pending rewards, and health status
- **Allocation Wizard** — Select deployments and queue allocate/unallocate/reallocate actions with live APR previews
- **Actions Manager** — View, approve, cancel, and execute queued indexer-agent actions
- **QoS Dashboard** — Per-allocation quality-of-service metrics (latency, blocks behind, success rate)
- **Query Fees Dashboard** — Per-deployment query fee breakdown
- **Deployment Status** — Sync progress and health for all indexed deployments
- **Offchain Sync** — Monitor offchain subgraph sync status
- **Settings** — Configure endpoints, indexer accounts, and dark mode

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

## Tech Stack

- Vue 3 + TypeScript + Vite
- TanStack Table (headless) + TanStack Virtual (virtual scrolling)
- TanStack Query (server state with manual refresh)
- PrimeVue 4 (Aura theme) + PrimeIcons
- Pinia 3 (client state, persisted settings)
- graphql-request (multi-endpoint GraphQL)
- viem (Ethereum RPC)

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and configure your endpoints in **Settings**.

## Docker

```bash
docker compose up -d
```

This builds the app and serves it via nginx on port 3000.

## Development

```bash
npm run dev          # Start dev server on :3000
npm run build        # Type-check + production build
npm run preview      # Preview production build
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
```

## Project Structure

```
src/
  api/            # GraphQL queries, REST clients, transport layer
  composables/    # TanStack Query hooks and computation composables
  components/     # Reusable UI components (DataTable, cells)
  layouts/        # AppLayout (sidebar + main content)
  views/          # Route-level page components
  stores/         # Pinia stores (settings, filters, selections, accounts)
  services/       # Pure calculation functions (APR, rewards, etc.)
  types/          # TypeScript type definitions
  styles/         # Global CSS
  router/         # Vue Router configuration
```
