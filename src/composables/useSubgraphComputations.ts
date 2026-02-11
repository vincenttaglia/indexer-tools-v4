import { computed, type Ref } from 'vue'
import type {
  SubgraphRaw,
  SubgraphComputed,
  NetworkMetrics,
  DeploymentStatus,
  QueryFeeData,
} from '@/types'
import {
  calculateApr,
  calculateNewApr,
  calculateSubgraphDailyRewards,
  calculateDailyRewardsCut,
  calculateMaxAllocation,
  calculateProportion,
} from '@/services/calculations'

/**
 * Inputs for the single-pass subgraph computation composable.
 *
 * Each field is a reactive Ref so that the computed re-evaluates
 * automatically when any upstream data changes.
 */
interface ComputationInputs {
  /** Filtered subgraphs (already pre-filtered by useSubgraphFilters) */
  subgraphs: Ref<SubgraphRaw[]>
  /** Network metrics from TanStack Query */
  networkMetrics: Ref<NetworkMetrics | undefined>
  /** Deployment statuses from status endpoint, keyed by IPFS hash */
  statuses: Ref<Map<string, DeploymentStatus> | undefined>
  /** Query fee data keyed by deployment IPFS hash */
  queryFees: Ref<Map<string, QueryFeeData> | undefined>
  /** Set of deployment IPFS hashes the indexer is currently allocated to */
  allocatedDeployments: Ref<Set<string>>
  /** Indexer's reward cut (0-1000000, where 1000000 = 100%) */
  indexingRewardCut: Ref<number>
  /** Blocks per day for the selected chain */
  blocksPerDay: Ref<number>
  /** Target APR percentage for max allocation calculation (e.g. 10 for 10%) */
  targetApr: Ref<number>
  /** New allocation amount in GRT (as a string, NOT wei) for projected calculations */
  newAllocation: Ref<string>
}

/**
 * Single-pass computation that transforms SubgraphRaw[] into SubgraphComputed[].
 *
 * This is the critical performance composable — it replaces v3's 13 cascading
 * getter loops (getProportions, getAprs, getDailyRewards, getDailyRewardsCuts,
 * getNewAprs, getMaxAllos, getCurrentlyAllocated, getDeploymentStatuses,
 * getQueryFeeDatas, getNumEntities, etc.) with ONE loop that computes all
 * derived values per subgraph in a single pass.
 *
 * @param inputs - Reactive inputs from TanStack Query caches and stores
 * @returns A computed ref of SubgraphComputed[]
 */
export function useSubgraphComputations(inputs: ComputationInputs) {
  const computed_ = computed<SubgraphComputed[]>(() => {
    const metrics = inputs.networkMetrics.value
    if (!metrics) return []

    const subs = inputs.subgraphs.value
    const statuses = inputs.statuses.value ?? new Map<string, DeploymentStatus>()
    const fees = inputs.queryFees.value ?? new Map<string, QueryFeeData>()
    const allocated = inputs.allocatedDeployments.value
    const rewardCut = inputs.indexingRewardCut.value
    const bpd = inputs.blocksPerDay.value
    const targetApr = inputs.targetApr.value
    const newAllocation = inputs.newAllocation.value

    // Single pass: compute all derived values per subgraph
    return subs.map((sg): SubgraphComputed => {
      const d = sg.deployment

      // APR calculation (current APR with no new allocation)
      const apr = calculateApr({
        signalledTokens: d.signalledTokens,
        stakedTokens: d.stakedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
      })

      // New APR (projected APR if a new allocation of `newAllocation` GRT is added)
      const newApr = calculateNewApr({
        signalledTokens: d.signalledTokens,
        stakedTokens: d.stakedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
        newAllocation,
      })

      // Daily rewards for a hypothetical new allocation
      const dailyRewards = calculateSubgraphDailyRewards({
        signalledTokens: d.signalledTokens,
        stakedTokens: d.stakedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
        newAllocation,
      })

      // Daily rewards after indexer cut (indexingRewardCut is the fraction the indexer keeps)
      const dailyRewardsCut = calculateDailyRewardsCut(dailyRewards, rewardCut)

      // Max allocation to achieve target APR
      const maxAllo = calculateMaxAllocation({
        targetApr,
        signalledTokens: d.signalledTokens,
        stakedTokens: d.stakedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
      })

      // Proportion: signal-to-stake ratio relative to network averages
      const proportion = calculateProportion({
        signalledTokens: d.signalledTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        stakedTokens: d.stakedTokens,
        totalTokensAllocated: metrics.totalTokensAllocated,
      })

      // Status from indexer graph-node status endpoint
      const deploymentStatus = statuses.get(d.ipfsHash) ?? null

      // Entity count from the deployment status
      const entityCount =
        deploymentStatus !== null
          ? parseInt(deploymentStatus.entityCount, 10)
          : null

      // Query fee data from the QoS/gateway API
      const queryFeeData = fees.get(d.ipfsHash) ?? null

      // Is this subgraph currently allocated by the indexer?
      const currentlyAllocated = allocated.has(d.ipfsHash)

      return {
        ...sg,
        apr,
        newApr,
        dailyRewards,
        dailyRewardsCut,
        maxAllo,
        proportion,
        currentlyAllocated,
        deploymentStatus,
        entityCount,
        queryFees: queryFeeData,
      }
    })
  })

  return { computed: computed_ }
}
