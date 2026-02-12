export interface AllocationSubgraphDeployment {
  ipfsHash: string
  createdAt: number
  originalName: string | null
  stakedTokens: string
  indexingRewardAmount: string
  signalledTokens: string
  queryFeesAmount: string
  deniedAt: number | null
  manifest: {
    network: string | null
  }
  versions: Array<{
    subgraph: {
      id: string
      metadata: {
        image: string | null
        displayName: string | null
      } | null
    }
  }>
}

/** Raw allocation data as returned by the Network Subgraph */
export interface AllocationRaw {
  id: string
  activeForIndexer: {
    id: string
  }
  subgraphDeployment: AllocationSubgraphDeployment
  allocatedTokens: string
  effectiveAllocation: string
  createdAt: number
  createdAtEpoch: number
  createdAtBlockHash: string
  createdAtBlockNumber: number
  indexingRewards: string
  indexingIndexerRewards: string
  indexingDelegatorRewards: string
  isLegacy: boolean
}

/** Per-allocation pending reward state */
export interface PendingReward {
  value: bigint
  loading: boolean
  loaded: boolean
}

/** QoS data merged into an allocation from the QoS subgraph */
export interface AllocationQosData {
  queryCount: number
  totalQueryFees: number
  avgLatencyMs: number
  avgBlocksBehind: number
  successRate: number // 0-1
}

/** Status checks for a deployment (EBO synced, other indexers, deterministic failure) */
export interface DeploymentStatusChecks {
  synced: boolean | null
  healthComparison: boolean | null
  healthyCount: number
  failedCount: number
  deterministicFailure: boolean | null
  closable: boolean
  otherIndexerDetails: import('./status').OtherIndexerDetail[]
}

/** @deprecated Use DeploymentStatusChecks instead */
export type AllocationStatusChecks = DeploymentStatusChecks

/** Computed fields added by the allocation computation composable */
export interface AllocationComputed extends AllocationRaw {
  apr: number
  dailyRewards: number
  dailyRewardsCut: number
  duration: number
  pendingRewards: PendingReward
  deploymentStatus: import('./status').DeploymentStatus | null
  qosData: AllocationQosData | null
  statusChecks: DeploymentStatusChecks
}
