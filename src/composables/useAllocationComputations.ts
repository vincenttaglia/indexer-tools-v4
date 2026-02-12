import { computed, type Ref } from 'vue'
import type {
  AllocationRaw,
  AllocationComputed,
  AllocationQosData,
  AllocationStatusChecks,
  NetworkMetrics,
  DeploymentStatus,
  PendingReward,
  AllocationDailyDataPoint,
  Epoch,
  OtherIndexerDetail,
} from '@/types'
import type { OtherIndexersHealth } from './useOtherIndexersQuery'
import {
  calculateApr,
  calculateAllocationDailyRewards,
  calculateDailyRewardsCut,
} from '@/services/calculations'
import { weiToGrt } from '@/services/calculations/tokenMath'

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
  /** QoS daily data points from the QoS subgraph */
  qosData: Ref<AllocationDailyDataPoint[] | undefined>
  /** Epoch data from EBO subgraph for synced check */
  epochData: Ref<Epoch | null | undefined>
  /** Other indexers status aggregation: Map<ipfsHash, OtherIndexersHealth> */
  otherIndexersStatus: Ref<Map<string, OtherIndexersHealth> | undefined>
}

/**
 * Single-pass computation that transforms AllocationRaw[] into AllocationComputed[].
 *
 * Computed per allocation:
 *   - apr, dailyRewards, dailyRewardsCut, duration, pendingRewards, deploymentStatus
 *   - qosData: merged from QoS subgraph data
 *   - statusChecks: EBO synced, other indexers health comparison, deterministic failure, closable
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

    // Build QoS lookup by deployment IPFS hash
    const qosLookup = new Map<string, AllocationDailyDataPoint>()
    const qosDataPoints = inputs.qosData.value
    if (qosDataPoints) {
      for (const dp of qosDataPoints) {
        qosLookup.set(dp.subgraph_deployment_ipfs_hash, dp)
      }
    }

    // Epoch data for EBO-based synced check
    const epoch = inputs.epochData.value

    // Other indexers status
    const otherIndexers = inputs.otherIndexersStatus.value

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
        pendingRewards = { value: 0n, loading: false, loaded: false }
      } else if (isRewardsLoading) {
        pendingRewards = { value: 0n, loading: true, loaded: false }
      } else if (pendingMap) {
        const val = pendingMap.get(alloc.id)
        pendingRewards = { value: val ?? 0n, loading: false, loaded: true }
      } else {
        pendingRewards = { value: 0n, loading: false, loaded: false }
      }

      // Deployment status from the graph-node status endpoint
      const deploymentStatus = statuses.get(d.ipfsHash) ?? null

      // QoS data from the QoS subgraph
      const qosPoint = qosLookup.get(d.ipfsHash)
      let qosData: AllocationQosData | null = null
      if (qosPoint) {
        qosData = {
          queryCount: qosPoint.query_count,
          totalQueryFees: weiToGrt(qosPoint.total_query_fees),
          avgLatencyMs: qosPoint.avg_indexer_latency_ms,
          avgBlocksBehind: qosPoint.avg_indexer_blocks_behind,
          successRate: qosPoint.proportion_indexer_200_responses,
        }
      }

      // Status checks: EBO synced, other indexers, deterministic failure, closable
      const statusChecks = computeStatusChecks(
        alloc,
        deploymentStatus,
        epoch,
        otherIndexers,
      )

      return {
        ...alloc,
        apr,
        dailyRewards,
        dailyRewardsCut,
        duration,
        pendingRewards,
        deploymentStatus,
        qosData,
        statusChecks,
      }
    })
  })

  return { computed: computed_ }
}

/**
 * Compute status checks for a single allocation.
 */
function computeStatusChecks(
  alloc: AllocationRaw,
  deploymentStatus: DeploymentStatus | null,
  epoch: Epoch | null | undefined,
  otherIndexers: Map<string, OtherIndexersHealth> | undefined,
): AllocationStatusChecks {
  const ipfsHash = alloc.subgraphDeployment.ipfsHash
  const network = alloc.subgraphDeployment.manifest.network

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
  let otherIndexerDetails: OtherIndexerDetail[] = []
  if (otherIndexers) {
    const otherStatus = otherIndexers.get(ipfsHash)
    if (otherStatus) {
      healthyCount = otherStatus.healthyCount
      failedCount = otherStatus.failedCount
      healthComparison = healthyCount > failedCount
      otherIndexerDetails = otherStatus.details
    }
  }

  // Deterministic failure check
  let deterministicFailure: boolean | null = null
  if (deploymentStatus?.fatalError) {
    deterministicFailure = deploymentStatus.fatalError.deterministic
  }

  // Closable logic:
  // Standard: synced AND (no fatal error OR fatal error is deterministic)
  // Enhanced: deterministic failure AND majority also failed AND not synced → closable
  let closable = false
  if (synced === true) {
    if (deploymentStatus?.fatalError === null || deploymentStatus?.fatalError === undefined) {
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
    otherIndexerDetails,
  }
}
