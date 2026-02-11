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
