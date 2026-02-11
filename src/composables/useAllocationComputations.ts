import { computed, type Ref } from 'vue'
import type {
  AllocationRaw,
  AllocationComputed,
  NetworkMetrics,
  DeploymentStatus,
  PendingReward,
} from '@/types'
import {
  calculateApr,
  calculateAllocationDailyRewards,
  calculateDailyRewardsCut,
} from '@/services/calculations'

/**
 * Inputs for the single-pass allocation computation composable.
 *
 * Each field is a reactive Ref so that the computed re-evaluates
 * automatically when any upstream data changes.
 */
interface AllocationComputationInputs {
  /** Raw allocations from the network subgraph */
  allocations: Ref<AllocationRaw[] | undefined>
  /** Network metrics from TanStack Query */
  networkMetrics: Ref<NetworkMetrics | undefined>
  /** Deployment statuses from status endpoint, keyed by IPFS hash */
  statuses: Ref<Map<string, DeploymentStatus> | undefined>
  /** Indexer's reward cut (0-1000000, where 1000000 = 100%) */
  indexingRewardCut: Ref<number>
  /** Blocks per day for the selected chain */
  blocksPerDay: Ref<number>
  /** Pending rewards map from useRewardsQuery, keyed by allocation ID */
  pendingRewardsMap: Ref<Map<string, bigint> | undefined>
  /** Whether the rewards query is currently fetching */
  rewardsLoading: Ref<boolean>
  /** Whether the rewards query has been fetched at least once */
  rewardsFetched: Ref<boolean>
}

/**
 * Single-pass computation that transforms AllocationRaw[] into AllocationComputed[].
 *
 * This is the allocation equivalent of useSubgraphComputations — it replaces
 * cascading getter loops with ONE loop that computes all derived values per
 * allocation in a single pass.
 *
 * Computed per allocation:
 *   - apr: based on allocatedTokens, deployment signal/stake
 *   - dailyRewards: from calculateAllocationDailyRewards
 *   - dailyRewardsCut: after indexer cut
 *   - duration: (Date.now()/1000 - createdAt) in days
 *   - pendingRewards: from pendingRewardsMap or loading state
 *   - deploymentStatus: from status map
 *
 * @param inputs - Reactive inputs from TanStack Query caches and stores
 * @returns A computed ref of AllocationComputed[]
 */
export function useAllocationComputations(inputs: AllocationComputationInputs) {
  const computed_ = computed<AllocationComputed[]>(() => {
    const metrics = inputs.networkMetrics.value
    const allocations = inputs.allocations.value
    if (!metrics || !allocations) return []

    const statuses = inputs.statuses.value ?? new Map<string, DeploymentStatus>()
    const rewardCut = inputs.indexingRewardCut.value
    const bpd = inputs.blocksPerDay.value
    const pendingMap = inputs.pendingRewardsMap.value
    const isRewardsLoading = inputs.rewardsLoading.value
    const isRewardsFetched = inputs.rewardsFetched.value

    // Single pass: compute all derived values per allocation
    return allocations.map((alloc): AllocationComputed => {
      const d = alloc.subgraphDeployment

      // APR calculation using the allocation's own allocatedTokens as denominator
      const apr = calculateApr({
        signalledTokens: d.signalledTokens,
        stakedTokens: d.stakedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
      })

      // Daily rewards for this specific allocation
      const dailyRewards = calculateAllocationDailyRewards({
        signalledTokens: d.signalledTokens,
        stakedTokens: d.stakedTokens,
        allocatedTokens: alloc.allocatedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
      })

      // Daily rewards after indexer cut
      const dailyRewardsCut = calculateDailyRewardsCut(dailyRewards, rewardCut)

      // Duration in days: (now - createdAt) / 86400
      const duration = (Date.now() / 1000 - alloc.createdAt) / 86400

      // Pending rewards from the rewards map
      let pendingRewards: PendingReward
      if (!isRewardsFetched && !isRewardsLoading) {
        // Not yet fetched
        pendingRewards = { value: 0n, loading: false, loaded: false }
      } else if (isRewardsLoading) {
        // Currently fetching
        pendingRewards = { value: 0n, loading: true, loaded: false }
      } else if (pendingMap) {
        // Fetched — look up value
        const val = pendingMap.get(alloc.id)
        pendingRewards = { value: val ?? 0n, loading: false, loaded: true }
      } else {
        pendingRewards = { value: 0n, loading: false, loaded: false }
      }

      // Deployment status from the graph-node status endpoint
      const deploymentStatus = statuses.get(d.ipfsHash) ?? null

      return {
        ...alloc,
        apr,
        dailyRewards,
        dailyRewardsCut,
        duration,
        pendingRewards,
        deploymentStatus,
      }
    })
  })

  return { computed: computed_ }
}
