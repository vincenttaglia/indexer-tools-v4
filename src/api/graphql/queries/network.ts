import { gql, type GraphQLClient } from 'graphql-request'
import type { NetworkMetrics, Epoch } from '@/types'

// ---------------------------------------------------------------------------
// Query Documents
// ---------------------------------------------------------------------------

/** Fetches top-level Graph Network metrics (signal, issuance, supply, epoch, etc.) */
export const NETWORK_METRICS_QUERY = gql`
  query {
    graphNetwork(id: 1) {
      totalTokensSignalled
      networkGRTIssuancePerBlock
      totalSupply
      currentEpoch
      totalTokensAllocated
      maxThawingPeriod
    }
  }
`

/**
 * Fetches the latest epoch data from the EBO subgraph.
 * Note: the v3 subgraph schema uses the spelling "epoches" (not "epochs").
 */
export const EPOCH_QUERY = gql`
  query {
    epoches(first: 1, orderBy: epochNumber, orderDirection: desc) {
      epochNumber
      id
      blockNumbers {
        blockNumber
        id
        network {
          alias
          id
        }
      }
    }
  }
`

// ---------------------------------------------------------------------------
// Typed fetch functions
// ---------------------------------------------------------------------------

interface NetworkMetricsResponse {
  graphNetwork: NetworkMetrics
}

export async function fetchNetworkMetrics(client: GraphQLClient): Promise<NetworkMetrics> {
  const data = await client.request<NetworkMetricsResponse>(NETWORK_METRICS_QUERY)
  return data.graphNetwork
}

interface EpochResponse {
  epoches: Epoch[]
}

export async function fetchLatestEpoch(client: GraphQLClient): Promise<Epoch | null> {
  const data = await client.request<EpochResponse>(EPOCH_QUERY)
  const raw = data.epoches[0]
  if (!raw) return null
  // EBO returns blockNumber as a BigInt JSON string. Coerce so downstream
  // `>=` comparisons against latestBlock are numeric, not lexicographic.
  // See normalizeDeploymentStatus in api/status/client.ts for the matching
  // boundary fix on the graph-node side.
  return {
    ...raw,
    blockNumbers: (raw.blockNumbers ?? []).map((b) => ({
      ...b,
      blockNumber: Number(b.blockNumber),
    })),
  }
}
