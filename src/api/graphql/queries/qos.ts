import { gql, type GraphQLClient } from 'graphql-request'
import type { AllocationDailyDataPoint, QueryDailyDataPoint } from '@/types'

// ---------------------------------------------------------------------------
// Query Documents
// ---------------------------------------------------------------------------

/** Fetches the most recent day number from the QoS subgraph. */
export const LATEST_DAY_NUMBER_QUERY = gql`
  query {
    queryDailyDataPoints(orderBy: dayNumber, first: 1, orderDirection: desc) {
      dayNumber
    }
  }
`

/** Fetches QoS daily data points for a specific indexer on a given day. */
export const QOS_DAILY_DATA_QUERY = gql`
  query queryDailyDataPoints($dayNumber: Int!, $indexer: String!) {
    indexer(id: $indexer) {
      id
      allocationDailyDataPoints(first: 1000, where: { dayNumber: $dayNumber }) {
        avg_indexer_blocks_behind
        dayNumber
        chain_id
        subgraph_deployment_ipfs_hash
        avg_indexer_latency_ms
        avg_query_fee
        id
        max_query_fee
        max_indexer_latency_ms
        max_indexer_blocks_behind
        num_indexer_200_responses
        proportion_indexer_200_responses
        query_count
        total_query_fees
      }
    }
  }
`

/** Fetches query fees daily data points with optional network filter. */
export const QUERY_FEES_DAILY_DATA_QUERY = gql`
  query queryDailyDataPoints($dayNumber: Int!, $networkFilter: [String]!) {
    queryDailyDataPoints(
      orderBy: total_query_fees
      where: { dayNumber: $dayNumber, chain_id_in: $networkFilter }
      orderDirection: desc
      first: 1000
    ) {
      dayNumber
      chain_id
      avg_query_fee
      avg_gateway_latency_ms
      gateway_query_success_rate
      query_count
      total_query_fees
      subgraphDeployment {
        id
      }
    }
  }
`

/** Fetches query fees daily data points without network filter. */
export const QUERY_FEES_DAILY_DATA_NO_FILTER_QUERY = gql`
  query queryDailyDataPoints($dayNumber: Int!) {
    queryDailyDataPoints(
      orderBy: total_query_fees
      where: { dayNumber: $dayNumber }
      orderDirection: desc
      first: 1000
    ) {
      dayNumber
      chain_id
      avg_query_fee
      avg_gateway_latency_ms
      gateway_query_success_rate
      query_count
      total_query_fees
      subgraphDeployment {
        id
      }
    }
  }
`

// ---------------------------------------------------------------------------
// Typed fetch functions
// ---------------------------------------------------------------------------

interface LatestDayNumberResponse {
  queryDailyDataPoints: Array<{ dayNumber: number }>
}

interface QosDailyDataResponse {
  indexer: {
    id: string
    allocationDailyDataPoints: AllocationDailyDataPoint[]
  } | null
}

interface QueryFeesDailyDataResponse {
  queryDailyDataPoints: QueryDailyDataPoint[]
}

/**
 * Fetches the most recent day number from the QoS subgraph.
 * Returns null if no data is available.
 */
export async function fetchLatestDayNumber(client: GraphQLClient): Promise<number | null> {
  const data = await client.request<LatestDayNumberResponse>(LATEST_DAY_NUMBER_QUERY)
  return data.queryDailyDataPoints[0]?.dayNumber ?? null
}

/**
 * Fetches QoS daily data for a specific indexer.
 * By convention, queries the day before the latest to ensure complete data.
 */
export async function fetchQosDailyData(
  client: GraphQLClient,
  indexerAddress: string,
  dayNumber: number,
): Promise<AllocationDailyDataPoint[]> {
  const data = await client.request<QosDailyDataResponse>(QOS_DAILY_DATA_QUERY, {
    dayNumber,
    indexer: indexerAddress.toLowerCase(),
  })
  return data.indexer?.allocationDailyDataPoints ?? []
}

/**
 * Fetches query fees daily data for all deployments, optionally filtered by network.
 * Uses dayNumber - 1 (previous day) for complete data, matching v3 behavior.
 */
export async function fetchQueryFeesDailyData(
  client: GraphQLClient,
  dayNumber: number,
  networkFilter: string[] = [],
): Promise<QueryDailyDataPoint[]> {
  const useFilter = networkFilter.length > 0
  const query = useFilter ? QUERY_FEES_DAILY_DATA_QUERY : QUERY_FEES_DAILY_DATA_NO_FILTER_QUERY

  const variables: Record<string, unknown> = { dayNumber }
  if (useFilter) {
    variables.networkFilter = networkFilter
  }

  const data = await client.request<QueryFeesDailyDataResponse>(query, variables)
  return data.queryDailyDataPoints
}

/**
 * Convenience function: fetches the latest day number and then fetches QoS data
 * for the previous day (matching v3 behavior of using dayNumber - 1).
 */
export async function fetchQosDailyDataLatest(
  client: GraphQLClient,
  indexerAddress: string,
): Promise<AllocationDailyDataPoint[]> {
  const latestDay = await fetchLatestDayNumber(client)
  if (latestDay === null) return []
  return fetchQosDailyData(client, indexerAddress, latestDay - 1)
}

/**
 * Convenience function: fetches the latest day number and then fetches query fees
 * for the previous day (matching v3 behavior of using dayNumber - 1).
 */
export async function fetchQueryFeesDailyDataLatest(
  client: GraphQLClient,
  networkFilter: string[] = [],
): Promise<QueryDailyDataPoint[]> {
  const latestDay = await fetchLatestDayNumber(client)
  if (latestDay === null) return []
  return fetchQueryFeesDailyData(client, latestDay - 1, networkFilter)
}
