export interface FatalError {
  message: string
  deterministic: boolean
  block: {
    hash: string
    number: number
  } | null
}

export interface ChainStatus {
  latestBlock: { number: number } | null
  chainHeadBlock: { number: number } | null
  earliestBlock: { number: number } | null
}

export type HealthStatus = 'healthy' | 'unhealthy' | 'failed'

/** Deployment status from a graph-node status endpoint */
export interface DeploymentStatus {
  subgraph: string
  synced: boolean
  health: HealthStatus
  entityCount: string
  fatalError: FatalError | null
  node: string | null
  chains: ChainStatus[]
}

/** Aggregated status across all indexers for a deployment */
export interface AggregatedDeploymentStatus {
  /** Best status found across all queried indexers */
  status: DeploymentStatus | null
  /** Highest entity count found across all indexers */
  maxEntityCount: number | null
}
