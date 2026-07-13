# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-07-13

First tagged release of Indexer Tools v4 — a full rewrite on Vue 3 + TypeScript +
Vite, replacing the v3 codebase.

### Added

- **Subgraphs Dashboard** — browse all deployments with signal, APR estimates, and
  segmented filters (status, network, allocations, denied rewards) plus a searchable,
  virtual-scrolled network selector.
- **Allocations Dashboard** — active allocations with APR, daily rewards, pending
  rewards after cut, health status, and live-counting allocation duration.
- **Allocation Wizard** — 5-step flow (Select → Set Allocations → POI → Summary →
  execute) with tables that mirror the standalone dashboards.
- **APR Optimizer** — water-filling allocator that distributes a GRT budget across
  selected subgraphs to maximize total daily rewards while respecting per-allocation
  caps.
- **Actions Manager** — queue, approve, cancel, and execute indexer-agent actions.
- **Deployment Status Dashboard** — sync/health status with interactive status-check
  popovers and a subgraph detail panel (avatar, sync bars, offchain actions).
- **QoS & Query Fees** integration across dashboards and wizard.
- **Multi-account support** with a runtime, per-account API proxy for agent and
  graphman endpoints.
- **Docker image** published to GHCR, with runtime config injection via
  `docker-entrypoint.sh` (no rebuild required to configure a deployment).
- **Kubernetes** manifests (Deployment, Service, Ingress, ConfigMap) with Kustomize
  support, plus a published [Helm chart](https://github.com/vincenttaglia/helm-charts/tree/main/charts/indexer-tools-v4).
- Full theme-aware light/dark mode.

[4.0.0]: https://github.com/vincenttaglia/indexer-tools-v4/releases/tag/v4.0.0
