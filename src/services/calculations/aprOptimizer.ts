/**
 * APR Optimizer entry point.
 *
 * Holds the public types for the optimizer and re-exports the iterative-greedy
 * water-filling solver as `optimizeAllocations`.
 *
 * The wizard call site (`WizardStepAllocate.vue`) imports `optimizeAllocations`
 * from `@/services/calculations`; that name stays stable while the underlying
 * algorithm lives in `aprOptimizer.waterfall.ts`.
 */

import { optimizeAllocationsWaterfall } from './aprOptimizer.waterfall'

export interface OptimizableSubgraph {
  ipfsHash: string
  signalledTokens: string // wei
  stakedTokens: string // wei (effective, after closings)
  displayName: string // for UI
}

export interface OptimizationParams {
  subgraphs: OptimizableSubgraph[]
  totalBudgetGrt: number // total GRT to distribute
  totalTokensSignalled: string // network metric (wei)
  networkGRTIssuancePerBlock: string // network metric (wei)
  blocksPerDay: number
  indexingRewardCut: number // 0-1000000 (parts per million)
  minAllocationGrt?: number // minimum per subgraph, default 0

  /** Per-deployment cap as a fraction of the budget, in [0, 1]. Ignored when 0. */
  maxAllocationPct?: number
  /** Per-deployment cap in absolute GRT. Ignored when 0. */
  maxAllocationGrt?: number
  /** Tighter pct cap for deployments listed in `riskyDeployments`. */
  riskyAllocationPct?: number
  /** Tighter raw cap (GRT) for deployments listed in `riskyDeployments`. */
  riskyAllocationGrt?: number
  /** Deployments to which the risky caps apply. */
  riskyDeployments?: Set<string>
}

export interface OptimizationResult {
  allocations: Map<string, number> // ipfsHash -> GRT amount
  totalDailyRewardsCut: number // total daily rewards after cut (wei)
  perSubgraph: Array<{
    ipfsHash: string
    displayName: string
    allocationGrt: number
    apr: number
    dailyRewardsCut: number // wei
  }>
}

export function optimizeAllocations(params: OptimizationParams): OptimizationResult {
  return optimizeAllocationsWaterfall(params)
}

export { optimizeAllocationsWaterfall }
