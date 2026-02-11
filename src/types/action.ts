export type ActionStatus = 'queued' | 'approved' | 'pending' | 'success' | 'failed' | 'canceled' | 'deploying'
export type ActionType = 'allocate' | 'unallocate' | 'reallocate'

/** Action as returned by the Indexer Agent GraphQL API */
export interface Action {
  id: number
  status: ActionStatus
  type: ActionType
  deploymentID: string
  allocationID: string | null
  amount: string | null
  poi: string | null
  publicPOI: string | null
  poiBlockNumber: number | null
  force: boolean | null
  priority: number
  source: string
  reason: string
  transaction: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
  protocolNetwork: string
  isLegacy: boolean
}

/** Input for creating a new action via the wizard */
export interface ActionInput {
  status: 'queued'
  type: ActionType
  deploymentID: string
  allocationID?: string
  amount: string
  protocolNetwork: string
  source: string
  reason: string
  priority: number
  isLegacy: boolean
  poi?: string
  publicPOI?: string
  poiBlockNumber?: number
  force?: boolean
}

/** Filter for querying actions from the agent */
export interface ActionFilter {
  id?: number
  status?: ActionStatus
  type?: ActionType
  deploymentID?: string
  protocolNetwork?: string
}
