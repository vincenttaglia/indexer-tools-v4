// GraphQL client factory
export { createGraphQLClient } from './graphql/client'

// GraphQL queries - Network
export {
  NETWORK_METRICS_QUERY,
  EPOCH_QUERY,
  fetchNetworkMetrics,
  fetchLatestEpoch,
} from './graphql/queries/network'

// GraphQL queries - Subgraphs
export {
  SUBGRAPH_DEPLOYMENTS_QUERY,
  SUBGRAPH_DEPLOYMENTS_NO_NETWORK_FILTER_QUERY,
  fetchSubgraphDeployments,
} from './graphql/queries/subgraphs'
export type { FetchSubgraphDeploymentsOptions } from './graphql/queries/subgraphs'

// GraphQL queries - Allocations
export {
  ALLOCATIONS_QUERY,
  fetchAllocations,
} from './graphql/queries/allocations'

// GraphQL queries - Indexer
export {
  INDEXER_QUERY,
  fetchIndexerData,
} from './graphql/queries/indexer'

// GraphQL queries - QoS
export {
  LATEST_DAY_NUMBER_QUERY,
  QOS_DAILY_DATA_QUERY,
  QUERY_FEES_DAILY_DATA_QUERY,
  QUERY_FEES_DAILY_DATA_NO_FILTER_QUERY,
  fetchLatestDayNumber,
  fetchQosDailyData,
  fetchQueryFeesDailyData,
  fetchQosDailyDataLatest,
  fetchQueryFeesDailyDataLatest,
} from './graphql/queries/qos'

// GraphQL mutations - Actions
export {
  ACTIONS_QUERY,
  QUEUE_ACTIONS_MUTATION,
  APPROVE_ACTIONS_MUTATION,
  CANCEL_ACTIONS_MUTATION,
  DELETE_ACTIONS_MUTATION,
  EXECUTE_APPROVED_ACTIONS_MUTATION,
  fetchActions,
  queueActions,
  approveActions,
  cancelActions,
  deleteActions,
  executeApprovedActions,
} from './graphql/mutations/actions'

// RPC client factory
export { createRpcClient } from './rpc/client'

// RPC rewards
export {
  REWARDS_ABI,
  REWARDS_ISSUERS,
  getPendingRewards,
  getBatchPendingRewards,
} from './rpc/rewards'

// Graphman client
export { createGraphmanClient } from './graphman/client'

// Status endpoint client
export {
  fetchDeploymentStatus,
  fetchAllDeploymentStatuses,
  fetchDeploymentStatuses,
} from './status/client'
