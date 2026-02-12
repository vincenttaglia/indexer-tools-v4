/**
 * APR Optimization algorithm for the Allocation Wizard.
 *
 * Distributes a given GRT budget across selected subgraphs to maximize
 * total daily rewards. Uses iterative gradient ascent: starting from equal
 * distribution, it repeatedly shifts GRT from the subgraph with the lowest
 * marginal reward to the one with the highest, converging toward the
 * optimal allocation.
 *
 * The core insight: APR for a subgraph depends on signalledTokens / stakedTokens.
 * Adding more allocation to a high-signal/low-stake subgraph yields higher rewards.
 */

import { calculateSubgraphDailyRewards, calculateDailyRewardsCut } from './rewards'
import { calculateNewApr } from './apr'

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

/**
 * Optimizes allocation distribution across subgraphs to maximize total daily rewards.
 *
 * Algorithm: Iterative gradient ascent
 * 1. Start with equal distribution (respecting minimums)
 * 2. Calculate marginal reward for each subgraph (reward gained per additional GRT)
 * 3. Transfer GRT from lowest-marginal to highest-marginal subgraph
 * 4. Decrease step size over iterations for convergence
 * 5. Repeat for ITERATIONS rounds
 */
export function optimizeAllocations(params: OptimizationParams): OptimizationResult {
  const {
    subgraphs,
    totalBudgetGrt,
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
    indexingRewardCut,
    minAllocationGrt = 0,
  } = params

  // Edge case: empty or zero budget
  if (subgraphs.length === 0 || totalBudgetGrt <= 0) {
    return { allocations: new Map(), totalDailyRewardsCut: 0, perSubgraph: [] }
  }

  // Single subgraph: give it everything
  if (subgraphs.length === 1) {
    return buildSingleSubgraphResult(subgraphs[0], Math.max(totalBudgetGrt, minAllocationGrt), {
      totalTokensSignalled,
      networkGRTIssuancePerBlock,
      blocksPerDay,
      indexingRewardCut,
    })
  }

  // --- Iterative gradient-based optimization ---
  const ITERATIONS = 100
  const STEP_FRACTION = 0.1 // move 10% of distributable budget per iteration initially

  // Initialize equal allocation (respecting minimums)
  const minTotal = minAllocationGrt * subgraphs.length
  const distributableBudget = Math.max(0, totalBudgetGrt - minTotal)
  const amounts = new Map<string, number>()
  for (const sg of subgraphs) {
    amounts.set(sg.ipfsHash, minAllocationGrt + distributableBudget / subgraphs.length)
  }

  /**
   * Calculate the marginal reward for adding 1 GRT to a subgraph
   * at its current allocation level.
   */
  function marginalReward(sg: OptimizableSubgraph, currentAmountGrt: number): number {
    const delta = 1 // 1 GRT marginal unit
    const rewardBefore = calculateSubgraphDailyRewards({
      signalledTokens: sg.signalledTokens,
      stakedTokens: sg.stakedTokens,
      totalTokensSignalled,
      networkGRTIssuancePerBlock,
      blocksPerDay,
      newAllocation: String(currentAmountGrt),
    })
    const rewardAfter = calculateSubgraphDailyRewards({
      signalledTokens: sg.signalledTokens,
      stakedTokens: sg.stakedTokens,
      totalTokensSignalled,
      networkGRTIssuancePerBlock,
      blocksPerDay,
      newAllocation: String(currentAmountGrt + delta),
    })
    return rewardAfter - rewardBefore
  }

  for (let i = 0; i < ITERATIONS; i++) {
    // Calculate marginal rewards for each subgraph
    const marginals: Array<{ ipfsHash: string; marginal: number }> = subgraphs.map((sg) => ({
      ipfsHash: sg.ipfsHash,
      marginal: marginalReward(sg, amounts.get(sg.ipfsHash)!),
    }))

    // Sort descending by marginal reward
    marginals.sort((a, b) => b.marginal - a.marginal)

    const highest = marginals[0]
    const lowest = marginals[marginals.length - 1]

    // Converged: same subgraph is both highest and lowest
    if (lowest.ipfsHash === highest.ipfsHash) break

    // Decrease step size over iterations for convergence
    const stepSize = distributableBudget * STEP_FRACTION * (1 - i / ITERATIONS)
    const currentLowest = amounts.get(lowest.ipfsHash)!
    const transferable = Math.min(stepSize, currentLowest - minAllocationGrt)

    if (transferable <= 0) break

    amounts.set(lowest.ipfsHash, currentLowest - transferable)
    amounts.set(highest.ipfsHash, amounts.get(highest.ipfsHash)! + transferable)
  }

  // Build final result
  return buildResult(subgraphs, amounts, {
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
    indexingRewardCut,
  })
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

function buildSingleSubgraphResult(
  sg: OptimizableSubgraph,
  amountGrt: number,
  ctx: NetworkContext,
): OptimizationResult {
  const allocations = new Map([[sg.ipfsHash, amountGrt]])
  const apr = calculateNewApr({
    signalledTokens: sg.signalledTokens,
    stakedTokens: sg.stakedTokens,
    totalTokensSignalled: ctx.totalTokensSignalled,
    networkGRTIssuancePerBlock: ctx.networkGRTIssuancePerBlock,
    blocksPerDay: ctx.blocksPerDay,
    newAllocation: String(amountGrt),
  })
  const dailyRewards = calculateSubgraphDailyRewards({
    signalledTokens: sg.signalledTokens,
    stakedTokens: sg.stakedTokens,
    totalTokensSignalled: ctx.totalTokensSignalled,
    networkGRTIssuancePerBlock: ctx.networkGRTIssuancePerBlock,
    blocksPerDay: ctx.blocksPerDay,
    newAllocation: String(amountGrt),
  })
  const dailyRewardsCut = calculateDailyRewardsCut(dailyRewards, ctx.indexingRewardCut)

  return {
    allocations,
    totalDailyRewardsCut: dailyRewardsCut,
    perSubgraph: [
      {
        ipfsHash: sg.ipfsHash,
        displayName: sg.displayName,
        allocationGrt: amountGrt,
        apr,
        dailyRewardsCut,
      },
    ],
  }
}

function buildResult(
  subgraphs: OptimizableSubgraph[],
  amounts: Map<string, number>,
  ctx: NetworkContext,
): OptimizationResult {
  let totalDailyRewardsCut = 0
  const perSubgraph: OptimizationResult['perSubgraph'] = []

  for (const sg of subgraphs) {
    const amount = amounts.get(sg.ipfsHash)!
    const apr = calculateNewApr({
      signalledTokens: sg.signalledTokens,
      stakedTokens: sg.stakedTokens,
      totalTokensSignalled: ctx.totalTokensSignalled,
      networkGRTIssuancePerBlock: ctx.networkGRTIssuancePerBlock,
      blocksPerDay: ctx.blocksPerDay,
      newAllocation: String(amount),
    })
    const dailyRewards = calculateSubgraphDailyRewards({
      signalledTokens: sg.signalledTokens,
      stakedTokens: sg.stakedTokens,
      totalTokensSignalled: ctx.totalTokensSignalled,
      networkGRTIssuancePerBlock: ctx.networkGRTIssuancePerBlock,
      blocksPerDay: ctx.blocksPerDay,
      newAllocation: String(amount),
    })
    const dailyRewardsCut = calculateDailyRewardsCut(dailyRewards, ctx.indexingRewardCut)
    totalDailyRewardsCut += dailyRewardsCut
    perSubgraph.push({
      ipfsHash: sg.ipfsHash,
      displayName: sg.displayName,
      allocationGrt: amount,
      apr,
      dailyRewardsCut,
    })
  }

  return { allocations: amounts, totalDailyRewardsCut, perSubgraph }
}
