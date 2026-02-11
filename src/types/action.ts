export type ActionStatus = 'queued' | 'approved' | 'pending' | 'success' | 'failed' | 'canceled'
export type ActionType = 'allocate' | 'unallocate' | 'reallocate'

/** Action as returned by the Indexer Agent GraphQL API */
export interface Action {
  id: string
  status: ActionStatus
  type: ActionType
  deploymentID: string
  allocationID: string | null
  amount: string
  poi: string | null
  publicPOI: string | null
  poiBlockNumber: number | null
  force: boolean
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
  id?: string
  status?: ActionStatus
  type?: ActionType
  deploymentID?: string
  protocolNetwork?: string
}
