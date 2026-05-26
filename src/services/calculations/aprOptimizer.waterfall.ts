/**
 * Water-filling APR optimizer.
 *
 * Iterative-greedy allocator that walks the budget in 1000 chunks and
 * gives each chunk to the deployment with the highest marginal reward.
 * Marginal reward at allocation A on a deployment with reward pool R and
 * other-indexer stake D is:
 *
 *   d(reward)/dA = R * D / (D + A)^2
 *
 * where R = (signal / totalSignal) * issuancePerDay (per-day reward pool
 * this deployment generates if the indexer owns 100% of allocation) and
 * D is the other indexers' stake on this deployment.
 *
 * At A = 0 with D = 0 the marginal is undefined (R/0), so we use a
 * sentinel "claim me first" priority of Infinity — the deployment wins
 * a single chunk and on the next iteration its marginal drops to 0.
 *
 * Per-deployment caps are enforced as the min of a percentage-of-budget
 * cap and an absolute GRT cap (whichever is tighter). Deployments
 * flagged as risky use tighter caps.
 *
 * Inputs match the legacy optimizer's `OptimizationParams` with optional
 * cap fields. Output matches `OptimizationResult` exactly.
 */

import { calculateSubgraphDailyRewards, calculateDailyRewardsCut } from './rewards'
import { calculateNewApr } from './apr'
import type {
  OptimizableSubgraph,
  OptimizationParams,
  OptimizationResult,
} from './aprOptimizer'

const CHUNKS = 1000

export function optimizeAllocationsWaterfall(params: OptimizationParams): OptimizationResult {
  const {
    subgraphs,
    totalBudgetGrt,
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
    indexingRewardCut,
    minAllocationGrt = 0,
    maxAllocationPct = 0,
    maxAllocationGrt = 0,
    riskyAllocationPct = 0,
    riskyAllocationGrt = 0,
    riskyDeployments,
  } = params

  const budgetGrt = Math.floor(totalBudgetGrt)
  const emptyResult: OptimizationResult = {
    allocations: new Map(),
    totalDailyRewardsCut: 0,
    perSubgraph: [],
  }

  if (subgraphs.length === 0 || budgetGrt <= 0) {
    return emptyResult
  }

  const WEI = 1e18
  const candidates = subgraphs.map((sg) => ({
    ...sg,
    signalGrt: Number(sg.signalledTokens) / WEI,
    stakeGrt: Number(sg.stakedTokens) / WEI,
  }))

  const totalSignalGrt = Number(totalTokensSignalled) / WEI
  const issuancePerBlockGrt = Number(networkGRTIssuancePerBlock) / WEI
  const issuancePerDayGrt = issuancePerBlockGrt * blocksPerDay

  const ctx: NetworkContext = {
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
    indexingRewardCut,
  }

  const riskySet = riskyDeployments ?? new Set<string>()

  // Per-deployment reward pool (R) and other-indexer stake (D).
  // D = stakedTokens passed in — the wizard has already subtracted any
  // allocations being closed in Step 1, so this is the effective other-
  // indexer stake on the deployment.
  const Rs = candidates.map((c) =>
    totalSignalGrt > 0 ? (c.signalGrt / totalSignalGrt) * issuancePerDayGrt : 0,
  )
  const Ds = candidates.map((c) => Math.max(0, c.stakeGrt))

  // Effective cap per deployment = min(pct cap, raw cap) when both set,
  // otherwise whichever is set, otherwise no cap.
  const caps = candidates.map((c) => {
    const isRisky = riskySet.has(c.ipfsHash)
    const pct = isRisky ? riskyAllocationPct : maxAllocationPct
    const raw = isRisky ? riskyAllocationGrt : maxAllocationGrt
    const pctCap = pct > 0 ? pct * budgetGrt : Infinity
    const rawCap = raw > 0 ? raw : Infinity
    const cap = Math.min(pctCap, rawCap)
    return cap < Infinity ? Math.max(0, Math.floor(cap)) : Infinity
  })

  const allocs = candidates.map(() => 0)
  let remaining = budgetGrt
  const chunkSize = Math.max(1, Math.floor(budgetGrt / CHUNKS))

  // Defensive iteration bound: at most CHUNKS chunks + one extra per
  // candidate for the D=0 sentinel + a small safety margin.
  const maxIters = CHUNKS + candidates.length + 8

  for (let iter = 0; iter < maxIters && remaining > 0; iter++) {
    let bestIdx = -1
    let bestMarginal = 0

    for (let i = 0; i < candidates.length; i++) {
      if (allocs[i]! >= caps[i]!) continue
      if (Rs[i]! <= 0) continue
      const m = computeMarginal(Rs[i]!, Ds[i]!, allocs[i]!)
      if (m > bestMarginal) {
        bestIdx = i
        bestMarginal = m
      }
    }

    if (bestIdx < 0) break

    const headroom = caps[bestIdx]! - allocs[bestIdx]!
    const allocAmount = Math.min(chunkSize, headroom, remaining)
    if (allocAmount <= 0) break

    allocs[bestIdx]! += allocAmount
    remaining -= allocAmount
  }

  // Enforce minimums: any allocated candidate below minAllocationGrt is
  // bumped up to the floor, capped at headroom.
  if (minAllocationGrt > 0) {
    for (let i = 0; i < candidates.length; i++) {
      if (allocs[i]! > 0 && allocs[i]! < minAllocationGrt) {
        const bumpTarget = Math.min(minAllocationGrt, caps[i]!)
        const bump = bumpTarget - allocs[i]!
        if (bump > 0 && bump <= remaining) {
          allocs[i]! += bump
          remaining -= bump
        }
      }
    }
  }

  const amounts = new Map<string, number>()
  for (let i = 0; i < candidates.length; i++) {
    amounts.set(candidates[i]!.ipfsHash, allocs[i]!)
  }

  return buildResult(candidates, amounts, ctx)
}

function computeMarginal(R: number, D: number, A: number): number {
  // Sentinel: zero-other-stake deployment at A=0. Marginal is undefined
  // (R/0). Infinity wins one chunk; on the next iteration A>0 so the
  // marginal drops to 0 and the deployment never wins again.
  if (D === 0 && A === 0) return Infinity
  const denom = D + A
  if (denom <= 0) return 0
  return (R * D) / (denom * denom)
}

// ---------------------------------------------------------------------------
// Result builder (shared shape with legacy optimizer)
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
): OptimizationResult {
  const finalAmounts = new Map<string, number>()
  let totalDailyRewardsCut = 0
  const perSubgraph: OptimizationResult['perSubgraph'] = []

  for (const sg of subgraphs) {
    const raw = amounts.get(sg.ipfsHash) ?? 0
    const floored = Math.floor(raw)
    finalAmounts.set(sg.ipfsHash, floored)

    if (floored <= 0) {
      perSubgraph.push({
        ipfsHash: sg.ipfsHash,
        displayName: sg.displayName,
        allocationGrt: 0,
        apr: 0,
        dailyRewardsCut: 0,
      })
      continue
    }

    const dailyRewards = calculateSubgraphDailyRewards({
      signalledTokens: sg.signalledTokens,
      stakedTokens: sg.stakedTokens,
      totalTokensSignalled: ctx.totalTokensSignalled,
      networkGRTIssuancePerBlock: ctx.networkGRTIssuancePerBlock,
      blocksPerDay: ctx.blocksPerDay,
      newAllocation: String(floored),
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
