/** QoS daily data point for a specific indexer allocation */
export interface AllocationDailyDataPoint {
  id: string
  dayNumber: number
  chain_id: string
  subgraph_deployment_ipfs_hash: string
  avg_indexer_blocks_behind: number
  max_indexer_blocks_behind: number
  avg_indexer_latency_ms: number
  max_indexer_latency_ms: number
  avg_query_fee: string
  max_query_fee: string
  total_query_fees: string
  query_count: number
  num_indexer_200_responses: number
  proportion_indexer_200_responses: number
}

/** Gateway-level query daily data point for a deployment */
export interface QueryDailyDataPoint {
  dayNumber: number
  chain_id: string
  avg_query_fee: string
  avg_gateway_latency_ms: number
  gateway_query_success_rate: number
  query_count: number
  total_query_fees: string
  subgraphDeployment: {
    id: string
  }
}

/** Aggregated query fee data keyed by deployment for display in tables */
export interface QueryFeeData {
  avgQueryFee: number
  totalQueryFees: number
  queryCount: number
  avgGatewayLatencyMs: number
  successRate: number
}
