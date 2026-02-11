import { gql, type GraphQLClient } from 'graphql-request'
import type { AllocationRaw } from '@/types'

// ---------------------------------------------------------------------------
// Query Documents
// ---------------------------------------------------------------------------

/** Fetches all active allocations for a given indexer address. */
export const ALLOCATIONS_QUERY = gql`
  query allocations($indexer: String!, $skip: Int!) {
    allocations(
      first: 1000
      where: { activeForIndexer_contains_nocase: $indexer, status: Active }
      orderBy: createdAtBlockNumber
      orderDirection: desc
      skip: $skip
    ) {
      id
      activeForIndexer {
        id
      }
      subgraphDeployment {
        versions(first: 1, orderBy: version, orderDirection: desc) {
          subgraph {
            id
            metadata {
              image
              displayName
            }
          }
        }
        ipfsHash
        createdAt
        originalName
        stakedTokens
        indexingRewardAmount
        signalledTokens
        queryFeesAmount
        deniedAt
        manifest {
          network
        }
      }
      allocatedTokens
      effectiveAllocation
      createdAt
      createdAtEpoch
      createdAtBlockHash
      createdAtBlockNumber
      indexingRewards
      indexingIndexerRewards
      indexingDelegatorRewards
      isLegacy
    }
  }
`

// ---------------------------------------------------------------------------
// Typed fetch functions
// ---------------------------------------------------------------------------

interface AllocationsResponse {
  allocations: AllocationRaw[]
}

/**
 * Fetches all active allocations for the given indexer address.
 * Automatically paginates via skip-based pagination (first: 1000, skip: N).
 */
export async function fetchAllocations(
  client: GraphQLClient,
  indexerAddress: string,
): Promise<AllocationRaw[]> {
  let allResults: AllocationRaw[] = []
  let skip = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await client.request<AllocationsResponse>(ALLOCATIONS_QUERY, {
      indexer: indexerAddress.toLowerCase(),
      skip,
    })
    const page = data.allocations

    allResults = allResults.concat(page)

    if (page.length === 1000) {
      skip += page.length
    } else {
      break
    }
  }

  return allResults
}
