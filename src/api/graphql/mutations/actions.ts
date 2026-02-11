import { gql, type GraphQLClient } from 'graphql-request'
import type { Action, ActionInput, ActionFilter } from '@/types'

// ---------------------------------------------------------------------------
// Action fields fragment (shared across queries and most mutations)
// ---------------------------------------------------------------------------

const ACTION_FIELDS = `
  id
  status
  type
  deploymentID
  allocationID
  amount
  poi
  publicPOI
  poiBlockNumber
  force
  priority
  source
  reason
  transaction
  failureReason
  createdAt
  updatedAt
  protocolNetwork
  isLegacy
`

/** ActionResult fields — executeApprovedActions returns ActionResult, not Action.
 *  ActionResult lacks createdAt/updatedAt but is otherwise the same. */
const ACTION_RESULT_FIELDS = `
  id
  status
  type
  deploymentID
  allocationID
  amount
  poi
  publicPOI
  poiBlockNumber
  force
  priority
  source
  reason
  transaction
  failureReason
  protocolNetwork
  isLegacy
`

// ---------------------------------------------------------------------------
// Query Documents
// ---------------------------------------------------------------------------

/** Queries actions from the indexer agent with an optional filter. */
export const ACTIONS_QUERY = gql`
  query actions($filter: ActionFilter) {
    actions(filter: $filter) {
      ${ACTION_FIELDS}
    }
  }
`

// ---------------------------------------------------------------------------
// Mutation Documents
// ---------------------------------------------------------------------------

/** Queues new actions in the indexer agent. Returns flat Action[]. */
export const QUEUE_ACTIONS_MUTATION = gql`
  mutation queueActions($actions: [ActionInput!]!) {
    queueActions(actions: $actions) {
      ${ACTION_FIELDS}
    }
  }
`

/** Approves queued actions by their IDs. */
export const APPROVE_ACTIONS_MUTATION = gql`
  mutation approveActions($actionIDs: [String!]!) {
    approveActions(actionIDs: $actionIDs) {
      ${ACTION_FIELDS}
    }
  }
`

/** Cancels actions by their IDs. */
export const CANCEL_ACTIONS_MUTATION = gql`
  mutation cancelActions($actionIDs: [String!]!) {
    cancelActions(actionIDs: $actionIDs) {
      ${ACTION_FIELDS}
    }
  }
`

/** Deletes actions by their IDs. Returns count of deleted actions (Int). */
export const DELETE_ACTIONS_MUTATION = gql`
  mutation deleteActions($actionIDs: [String!]!) {
    deleteActions(actionIDs: $actionIDs)
  }
`

/** Executes all currently approved actions. Returns ActionResult[]. */
export const EXECUTE_APPROVED_ACTIONS_MUTATION = gql`
  mutation executeApprovedActions {
    executeApprovedActions {
      ${ACTION_RESULT_FIELDS}
    }
  }
`

// ---------------------------------------------------------------------------
// Typed fetch / mutate functions
// ---------------------------------------------------------------------------

interface ActionsQueryResponse {
  actions: Action[]
}

interface QueueActionsResponse {
  queueActions: Action[]
}

interface ApproveActionsResponse {
  approveActions: Action[]
}

interface CancelActionsResponse {
  cancelActions: Action[]
}

interface DeleteActionsResponse {
  deleteActions: number
}

interface ExecuteApprovedActionsResponse {
  executeApprovedActions: Action[]
}

/** Fetches actions from the indexer agent, optionally filtered. */
export async function fetchActions(
  client: GraphQLClient,
  filter: ActionFilter = {},
): Promise<Action[]> {
  const data = await client.request<ActionsQueryResponse>(ACTIONS_QUERY, { filter })
  return data.actions
}

/**
 * Queues actions in the indexer agent.
 * Automatically batches in groups of 100 to match v3 behavior.
 */
export async function queueActions(
  client: GraphQLClient,
  actions: ActionInput[],
): Promise<Action[]> {
  const batchSize = 100
  const allResults: Action[] = []

  for (let i = 0; i < actions.length; i += batchSize) {
    const batch = actions.slice(i, i + batchSize)
    const data = await client.request<QueueActionsResponse>(QUEUE_ACTIONS_MUTATION, {
      actions: batch,
    })
    allResults.push(...data.queueActions)
  }

  return allResults
}

/** Approves queued actions by their IDs. */
export async function approveActions(
  client: GraphQLClient,
  actionIds: string[],
): Promise<Action[]> {
  const data = await client.request<ApproveActionsResponse>(APPROVE_ACTIONS_MUTATION, {
    actionIDs: actionIds,
  })
  return data.approveActions
}

/** Cancels actions by their IDs. */
export async function cancelActions(
  client: GraphQLClient,
  actionIds: string[],
): Promise<Action[]> {
  const data = await client.request<CancelActionsResponse>(CANCEL_ACTIONS_MUTATION, {
    actionIDs: actionIds,
  })
  return data.cancelActions
}

/** Deletes actions by their IDs. Returns count of deleted actions. */
export async function deleteActions(
  client: GraphQLClient,
  actionIds: string[],
): Promise<number> {
  const data = await client.request<DeleteActionsResponse>(DELETE_ACTIONS_MUTATION, {
    actionIDs: actionIds,
  })
  return data.deleteActions
}

/** Executes all currently approved actions. */
export async function executeApprovedActions(
  client: GraphQLClient,
): Promise<Action[]> {
  const data = await client.request<ExecuteApprovedActionsResponse>(
    EXECUTE_APPROVED_ACTIONS_MUTATION,
  )
  return data.executeApprovedActions
}
