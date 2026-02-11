export interface SubgraphManifest {
  network: string | null
  poweredBySubstreams: boolean
}

export interface SubgraphMetadata {
  displayName: string | null
  image: string | null
  description: string | null
}

export interface SubgraphDeployment {
  id: string
  deniedAt: number | null
  createdAt: number
  indexingRewardAmount: string
  ipfsHash: string
  queryFeesAmount: string
  signalledTokens: string
  stakedTokens: string
  manifest: SubgraphManifest
  versions: Array<{
    metadata: {
      subgraphVersion: {
        subgraph: {
          metadata: SubgraphMetadata | null
        }
      }
    } | null
  }>
}

/** Raw subgraph data as returned by the Network Subgraph */
export interface SubgraphRaw {
  id: string
  deployment: SubgraphDeployment
}

/** Computed fields added by the single-pass computation composable */
export interface SubgraphComputed extends SubgraphRaw {
  proportion: number
  apr: number
  newApr: number
  dailyRewards: number
  dailyRewardsCut: number
  maxAllo: number
  currentlyAllocated: boolean
  deploymentStatus: import('./status').DeploymentStatus | null
  entityCount: number | null
  queryFees: import('./qos').QueryFeeData | null
  statusChecks: import('./allocation').DeploymentStatusChecks
}
