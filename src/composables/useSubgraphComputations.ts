import { computed, type Ref } from 'vue'
import type {
  SubgraphRaw,
  SubgraphComputed,
  NetworkMetrics,
  DeploymentStatus,
  DeploymentStatusChecks,
  QueryFeeData,
  AllocationRaw,
  Epoch,
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
  /**
   * Optional: allocations being closed (from wizard Step 1).
   * When provided, the allocatedTokens of matching closing allocations are subtracted
   * from stakedTokens to compute "future" APR/maxAllo projections.
   */
  closingAllocations?: Ref<Map<string, AllocationRaw>>
  /** Optional: Epoch data from EBO subgraph for synced check */
  epochData?: Ref<Epoch | null | undefined>
  /** Optional: Other indexers status aggregation: Map<ipfsHash, {healthyCount, failedCount}> */
  otherIndexersStatus?: Ref<Map<string, { healthyCount: number; failedCount: number }> | undefined>
}

/**
 * Build a lookup from deployment IPFS hash → total closing tokens (as wei string value).
 * Multiple allocations on the same deployment are summed.
 */
function buildClosingTokensMap(
  closingAllocations: Map<string, AllocationRaw>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const alloc of closingAllocations.values()) {
    const hash = alloc.subgraphDeployment.ipfsHash
    const current = map.get(hash) ?? 0
    map.set(hash, current + Number(alloc.allocatedTokens))
  }
  return map
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

    // Build closing tokens lookup if closing allocations are provided
    const closingTokensMap = inputs.closingAllocations?.value
      ? buildClosingTokensMap(inputs.closingAllocations.value)
      : null

    // Epoch data for EBO-based synced check
    const epoch = inputs.epochData?.value ?? null

    // Other indexers status
    const otherIndexers = inputs.otherIndexersStatus?.value

    // Single pass: compute all derived values per subgraph
    return subs.map((sg): SubgraphComputed => {
      const d = sg.deployment

      // Calculate effective staked tokens (future state if closing allocations exist)
      let effectiveStakedTokens = d.stakedTokens
      if (closingTokensMap) {
        const closingAmount = closingTokensMap.get(d.ipfsHash)
        if (closingAmount) {
          const futureStaked = Number(d.stakedTokens) - closingAmount
          effectiveStakedTokens = String(Math.max(0, futureStaked))
        }
      }

      // APR calculation (current APR with no new allocation)
      const apr = calculateApr({
        signalledTokens: d.signalledTokens,
        stakedTokens: effectiveStakedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
      })

      // New APR (projected APR if a new allocation of `newAllocation` GRT is added)
      const newApr = calculateNewApr({
        signalledTokens: d.signalledTokens,
        stakedTokens: effectiveStakedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
        newAllocation,
      })

      // Daily rewards for a hypothetical new allocation
      const dailyRewards = calculateSubgraphDailyRewards({
        signalledTokens: d.signalledTokens,
        stakedTokens: effectiveStakedTokens,
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
        stakedTokens: effectiveStakedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
      })

      // Proportion: signal-to-stake ratio relative to network averages
      const proportion = calculateProportion({
        signalledTokens: d.signalledTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        stakedTokens: effectiveStakedTokens,
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

      // Status checks: EBO synced, other indexers, deterministic failure, closable
      const statusChecks = computeDeploymentStatusChecks(
        d.ipfsHash,
        d.manifest.network,
        deploymentStatus,
        epoch,
        otherIndexers,
      )

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
        statusChecks,
      }
    })
  })

  return { computed: computed_ }
}

/**
 * Compute status checks for a deployment (shared logic for subgraphs and allocations).
 */
function computeDeploymentStatusChecks(
  ipfsHash: string,
  network: string | null,
  deploymentStatus: DeploymentStatus | null,
  epoch: Epoch | null,
  otherIndexers: Map<string, { healthyCount: number; failedCount: number }> | undefined,
): DeploymentStatusChecks {
  // EBO-based synced check
  let synced: boolean | null = null
  if (epoch && deploymentStatus && network) {
    const eboBlock = epoch.blockNumbers.find(b => b.network.alias === network)
    const latestBlock = deploymentStatus.chains?.[0]?.latestBlock?.number
    if (eboBlock && latestBlock != null) {
      synced = latestBlock >= eboBlock.blockNumber
    }
  }

  // Other indexers health comparison
  let healthComparison: boolean | null = null
  let healthyCount = 0
  let failedCount = 0
  if (otherIndexers) {
    const otherStatus = otherIndexers.get(ipfsHash)
    if (otherStatus) {
      healthyCount = otherStatus.healthyCount
      failedCount = otherStatus.failedCount
      healthComparison = healthyCount > failedCount
    }
  }

  // Deterministic failure check
  let deterministicFailure: boolean | null = null
  if (deploymentStatus?.fatalError) {
    deterministicFailure = deploymentStatus.fatalError.deterministic
  }

  // Closable logic
  let closable = false
  if (synced === true) {
    if (!deploymentStatus?.fatalError) {
      closable = true
    } else if (deploymentStatus.fatalError.deterministic) {
      closable = true
    }
  }
  // Enhanced: deterministically failed, majority of network also failed, and not synced
  if (
    !closable &&
    deterministicFailure === true &&
    healthComparison === false &&
    synced !== true
  ) {
    closable = true
  }

  return {
    synced,
    healthComparison,
    healthyCount,
    failedCount,
    deterministicFailure,
    closable,
  }
}
