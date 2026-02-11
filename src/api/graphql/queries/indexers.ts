import { gql, type GraphQLClient } from 'graphql-request'

// ---------------------------------------------------------------------------
// Query Documents
// ---------------------------------------------------------------------------

/** Fetches indexer URLs with active allocations. Paginated by 1000. */
export const INDEXER_URLS_QUERY = gql`
  query indexerUrls($skip: Int!) {
    indexers(first: 1000, where: { allocationCount_gt: 0 }, skip: $skip) {
      id
      url
    }
  }
`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IndexerUrlEntry {
  id: string
  url: string
}

interface IndexerUrlsResponse {
  indexers: IndexerUrlEntry[]
}

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

/**
 * Fetches all indexer URLs that have active allocations from the Network Subgraph.
 * Automatically paginates through all results (1000 per page).
 *
 * @param client - GraphQL client configured for the Network Subgraph
 * @returns Array of { id, url } for all active indexers
 */
export async function fetchIndexerUrls(
  client: GraphQLClient,
): Promise<IndexerUrlEntry[]> {
  const allIndexers: IndexerUrlEntry[] = []
  let skip = 0

  while (true) {
    const data = await client.request<IndexerUrlsResponse>(INDEXER_URLS_QUERY, { skip })
    if (!data.indexers || data.indexers.length === 0) break
    allIndexers.push(...data.indexers)
    if (data.indexers.length < 1000) break
    skip += 1000
  }

  return allIndexers
}
