import { gql, type GraphQLClient } from 'graphql-request'
import type { IndexerOnChainData } from '@/types'

// ---------------------------------------------------------------------------
// Query Documents
// ---------------------------------------------------------------------------

/** Fetches on-chain data for a specific indexer. */
export const INDEXER_QUERY = gql`
  query indexerData($indexer: String!) {
    indexer(id: $indexer) {
      indexingRewardCut
      availableStake
      url
    }
  }
`

// ---------------------------------------------------------------------------
// Typed fetch functions
// ---------------------------------------------------------------------------

interface IndexerResponse {
  indexer: IndexerOnChainData | null
}

/**
 * Fetches the on-chain data for a given indexer address from the Network Subgraph.
 * Returns null if the indexer is not found.
 */
export async function fetchIndexerData(
  client: GraphQLClient,
  indexerAddress: string,
): Promise<IndexerOnChainData | null> {
  const data = await client.request<IndexerResponse>(INDEXER_QUERY, {
    indexer: indexerAddress.toLowerCase(),
  })
  return data.indexer
}
