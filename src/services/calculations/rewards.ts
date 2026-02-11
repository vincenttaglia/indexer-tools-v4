/**
 * Daily reward calculations for Graph Protocol subgraph allocations.
 *
 * Ported from v3 commonCalcs.js — calculateSubgraphDailyRewards,
 * calculateAllocationDailyRewards, and indexerCut.
 *
 * All token amounts arrive as wei strings from the network subgraph.
 * Results are returned in wei (as numbers) to match the v3 behaviour,
 * where .dp(0) was called on the BigNumber result.
 */

const WEI_PER_GRT = 1e18

export interface SubgraphDailyRewardsParams {
  /** Signal on this subgraph deployment (wei string) */
  signalledTokens: string
  /** Total stake allocated to this subgraph deployment (wei string) */
  stakedTokens: string
  /** Total signal across the entire network (wei string) */
  totalTokensSignalled: string
  /** GRT issuance rate per block from the network (wei string) */
  networkGRTIssuancePerBlock: string
  /** Number of blocks produced per day on this chain */
  blocksPerDay: number
  /** New allocation amount in GRT (as a string, NOT wei) */
  newAllocation: string
}

export interface AllocationDailyRewardsParams {
  /** Signal on this subgraph deployment (wei string) */
  signalledTokens: string
  /** Total stake allocated to this subgraph deployment (wei string) */
  stakedTokens: string
  /** Tokens allocated by this specific allocation (wei string) */
  allocatedTokens: string
  /** Total signal across the entire network (wei string) */
  totalTokensSignalled: string
  /** GRT issuance rate per block from the network (wei string) */
  networkGRTIssuancePerBlock: string
  /** Number of blocks produced per day on this chain */
  blocksPerDay: number
}

/**
 * Calculates the estimated daily rewards for a new allocation to a subgraph.
 *
 * Faithfully ported from v3:
 *   signalledTokens / totalTokensSignalled * issuancePerBlock * blocksPerDay
 *     * (toWei(newAllocation) / (stakedTokens + toWei(newAllocation)))
 *
 * @returns Estimated daily rewards in wei (as a number, truncated to integer)
 */
export function calculateSubgraphDailyRewards(params: SubgraphDailyRewardsParams): number {
  const {
    signalledTokens,
    stakedTokens,
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
    newAllocation,
  } = params

  if (Number(stakedTokens) <= 0 && Number(newAllocation) === 0) {
    return 0
  }

  try {
    const newAllocationWei = Number(newAllocation) * WEI_PER_GRT
    const totalStaked = Number(stakedTokens) + newAllocationWei

    if (totalStaked <= 0) {
      return 0
    }

    const dailyRewards =
      (Number(signalledTokens) / Number(totalTokensSignalled)) *
      Number(networkGRTIssuancePerBlock) *
      blocksPerDay *
      (newAllocationWei / totalStaked)

    return isFinite(dailyRewards) ? Math.trunc(dailyRewards) : 0
  } catch {
    return 0
  }
}

/**
 * Calculates the estimated daily rewards for an existing allocation.
 *
 * Faithfully ported from v3:
 *   signalledTokens / totalTokensSignalled * issuancePerBlock * blocksPerDay
 *     * (allocatedTokens / stakedTokens)
 *
 * @returns Estimated daily rewards in wei (as a number, truncated to integer)
 */
export function calculateAllocationDailyRewards(params: AllocationDailyRewardsParams): number {
  const {
    signalledTokens,
    stakedTokens,
    allocatedTokens,
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
  } = params

  if (Number(stakedTokens) <= 0) {
    return 0
  }

  try {
    const dailyRewards =
      (Number(signalledTokens) / Number(totalTokensSignalled)) *
      Number(networkGRTIssuancePerBlock) *
      blocksPerDay *
      (Number(allocatedTokens) / Number(stakedTokens))

    return isFinite(dailyRewards) ? Math.trunc(dailyRewards) : 0
  } catch {
    return 0
  }
}

/**
 * Calculates the indexer's cut of daily rewards.
 *
 * Ported from v3 indexerCut:
 *   rewards * rewardCut / 1_000_000
 *
 * The indexingRewardCut from the network subgraph is expressed in parts-per-million
 * (e.g. 900000 means the indexer keeps 90% of rewards).
 *
 * @param dailyRewards - Daily rewards in wei (as a number)
 * @param indexingRewardCut - Indexer reward cut in parts-per-million (0–1000000)
 * @returns Indexer's portion of daily rewards in wei (as a number, truncated to integer)
 */
export function calculateDailyRewardsCut(dailyRewards: number, indexingRewardCut: number): number {
  const cut = (dailyRewards * indexingRewardCut) / 1_000_000
  return isFinite(cut) ? Math.trunc(cut) : 0
}
