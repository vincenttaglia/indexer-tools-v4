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

/** Computed fields added by the allocation computation composable */
export interface AllocationComputed extends AllocationRaw {
  apr: number
  dailyRewards: number
  dailyRewardsCut: number
  duration: number
  pendingRewards: PendingReward
  deploymentStatus: import('./status').DeploymentStatus | null
}
