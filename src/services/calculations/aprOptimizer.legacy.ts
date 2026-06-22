/**
 * Closed-form APR optimization algorithm (no longer wired into the app).
 *
 * Closed-form analytical solution derived from Lagrange multipliers.
 * Maximizes total daily rewards by allocating proportionally to
 * sqrt(signal * stake). Single-pass, no iteration.
 *
 * The app uses the water-filling optimizer (see `aprOptimizer.waterfall.ts`)
 * exclusively. This implementation is retained for reference and is not
 * imported anywhere.
 */

import { calculateSubgraphDailyRewards, calculateDailyRewardsCut } from './rewards'
import { calculateNewApr } from './apr'
import type {
  OptimizableSubgraph,
  OptimizationParams,
  OptimizationResult,
} from './aprOptimizer'

export function optimizeAllocationsLegacy(params: OptimizationParams): OptimizationResult {
  const {
    subgraphs,
    totalBudgetGrt,
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
    indexingRewardCut,
    minAllocationGrt = 0,
  } = params

  // Floor the budget so we never allocate fractional GRT
  const budgetGrt = Math.floor(totalBudgetGrt)

  const emptyResult: OptimizationResult = {
    allocations: new Map(),
    totalDailyRewardsCut: 0,
    perSubgraph: [],
  }

  // Edge case: empty or zero budget
  if (subgraphs.length === 0 || budgetGrt <= 0) {
    return emptyResult
  }

  // Convert wei strings to GRT numbers for numerical stability
  const WEI = 1e18
  const candidates = subgraphs
    .map((sg) => ({
      ...sg,
      signalGrt: Number(sg.signalledTokens) / WEI,
      stakeGrt: Number(sg.stakedTokens) / WEI,
    }))
    .filter((sg) => sg.signalGrt > 0) // Zero signal = zero rewards, skip

  if (candidates.length === 0) {
    return emptyResult
  }

  const ctx: NetworkContext = {
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
    indexingRewardCut,
  }

  // Single subgraph: give it everything
  if (candidates.length === 1) {
    const sg = candidates[0]!
    const amount = Math.max(budgetGrt, minAllocationGrt)
    return buildResult(
      candidates,
      new Map([[sg.ipfsHash, amount]]),
      ctx,
      budgetGrt,
    )
  }

  const amounts = new Map<string, number>()
  let remainingBudget = budgetGrt

  // Handle zero-stake subgraphs separately: marginal reward is infinite at a=0
  // but constant for any a>0, so give them minimum allocation.
  const zeroStake = candidates.filter((c) => c.stakeGrt <= 0)
  const normalStake = candidates.filter((c) => c.stakeGrt > 0)

  for (const sg of zeroStake) {
    const amount = Math.max(minAllocationGrt, 1) // At least 1 GRT
    amounts.set(sg.ipfsHash, amount)
    remainingBudget -= amount
  }

  if (remainingBudget <= 0 || normalStake.length === 0) {
    // All budget consumed by zero-stake minimums, or no normal subgraphs
    return buildResult(candidates, amounts, ctx, budgetGrt)
  }

  // Closed-form optimization with iterative constraint enforcement.
  let active = [...normalStake]

  for (let iteration = 0; iteration < active.length; iteration++) {
    const sumSqrt = active.reduce(
      (sum, sg) => sum + Math.sqrt(sg.signalGrt * sg.stakeGrt),
      0,
    )
    const sumStake = active.reduce((sum, sg) => sum + sg.stakeGrt, 0)
    const scale = (remainingBudget + sumStake) / sumSqrt

    let allValid = true
    const toRemove: string[] = []

    for (const sg of active) {
      const allocation = Math.sqrt(sg.signalGrt * sg.stakeGrt) * scale - sg.stakeGrt

      if (allocation < minAllocationGrt) {
        const fixedAmount = Math.max(0, minAllocationGrt)
        amounts.set(sg.ipfsHash, fixedAmount)
        remainingBudget -= fixedAmount
        toRemove.push(sg.ipfsHash)
        allValid = false
      } else {
        amounts.set(sg.ipfsHash, allocation)
      }
    }

    if (allValid) break

    active = active.filter((sg) => !toRemove.includes(sg.ipfsHash))
    if (active.length === 0) break
  }

  return buildResult(candidates, amounts, ctx, budgetGrt)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface NetworkContext {
  totalTokensSignalled: string
  networkGRTIssuancePerBlock: string
  blocksPerDay: number
  indexingRewardCut: number
}

function buildResult(
  subgraphs: Array<OptimizableSubgraph & { signalGrt: number; stakeGrt: number }>,
  amounts: Map<string, number>,
  ctx: NetworkContext,
  totalBudgetGrt: number,
): OptimizationResult {
  const entries: Array<{ sg: typeof subgraphs[0]; floored: number; fractional: number }> = []
  for (const sg of subgraphs) {
    const raw = amounts.get(sg.ipfsHash) ?? 0
    const floored = Math.floor(raw)
    entries.push({ sg, floored, fractional: raw - floored })
  }

  const flooredSum = entries.reduce((sum, e) => sum + e.floored, 0)
  let leftover = Math.floor(totalBudgetGrt) - flooredSum
  const sorted = [...entries].sort((a, b) => b.fractional - a.fractional)
  for (const entry of sorted) {
    if (leftover <= 0) break
    entry.floored += 1
    leftover -= 1
  }

  const finalAmounts = new Map<string, number>()
  let totalDailyRewardsCut = 0
  const perSubgraph: OptimizationResult['perSubgraph'] = []

  for (const { sg, floored } of entries) {
    finalAmounts.set(sg.ipfsHash, floored)

    const dailyRewards = calculateSubgraphDailyRewards({
      signalledTokens: sg.signalledTokens,
      stakedTokens: sg.stakedTokens,
      totalTokensSignalled: ctx.totalTokensSignalled,
      networkGRTIssuancePerBlock: ctx.networkGRTIssuancePerBlock,
      blocksPerDay: ctx.blocksPerDay,
      newAllocation: String(Math.round(floored)),
    })
    const dailyRewardsCut = calculateDailyRewardsCut(dailyRewards, ctx.indexingRewardCut)
    totalDailyRewardsCut += dailyRewardsCut

    const apr = calculateNewApr({
      signalledTokens: sg.signalledTokens,
      stakedTokens: sg.stakedTokens,
      totalTokensSignalled: ctx.totalTokensSignalled,
      networkGRTIssuancePerBlock: ctx.networkGRTIssuancePerBlock,
      blocksPerDay: ctx.blocksPerDay,
      newAllocation: String(floored),
    })

    perSubgraph.push({
      ipfsHash: sg.ipfsHash,
      displayName: sg.displayName,
      allocationGrt: floored,
      apr,
      dailyRewardsCut,
    })
  }

  return {
    allocations: finalAmounts,
    totalDailyRewardsCut,
    perSubgraph,
  }
}
