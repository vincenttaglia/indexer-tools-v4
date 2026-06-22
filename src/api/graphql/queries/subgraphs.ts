import { gql, type GraphQLClient } from 'graphql-request'
import type { SubgraphRaw } from '@/types'

// ---------------------------------------------------------------------------
// Query Documents
// ---------------------------------------------------------------------------

/**
 * Fetches subgraph deployment manifests with an optional network filter.
 * Uses cursor-based pagination (id_gt) matching the v3 approach.
 */
export const SUBGRAPH_DEPLOYMENTS_QUERY = gql`
  query subgraphDeploymentManifests(
    $cursor: String!
    $minSignal: String!
    $networks: [String]
  ) {
    subgraphDeploymentManifests(
      first: 1000
      orderBy: "id"
      where: {
        id_gt: $cursor
        deployment_: { signalledTokens_gte: $minSignal }
        network_in: $networks
      }
    ) {
      id
      deployment {
        id
        deniedAt
        createdAt
        indexingRewardAmount
        ipfsHash
        queryFeesAmount
        signalledTokens
        stakedTokens
        manifest {
          network
          poweredBySubstreams
        }
        versions(first: 1, orderBy: version, orderDirection: desc) {
          metadata {
            subgraphVersion {
              subgraph {
                metadata {
                  displayName
                  image
                  description
                }
              }
            }
          }
        }
      }
    }
  }
`

/**
 * Same as above but without the network filter.
 * Used when no network filter is selected.
 */
export const SUBGRAPH_DEPLOYMENTS_NO_NETWORK_FILTER_QUERY = gql`
  query subgraphDeploymentManifests(
    $cursor: String!
    $minSignal: String!
  ) {
    subgraphDeploymentManifests(
      first: 1000
      orderBy: "id"
      where: {
        id_gt: $cursor
        deployment_: { signalledTokens_gte: $minSignal }
      }
    ) {
      id
      deployment {
        id
        deniedAt
        createdAt
        indexingRewardAmount
        ipfsHash
        queryFeesAmount
        signalledTokens
        stakedTokens
        manifest {
          network
          poweredBySubstreams
        }
        versions(first: 1, orderBy: version, orderDirection: desc) {
          metadata {
            subgraphVersion {
              subgraph {
                metadata {
                  displayName
                  image
                  description
                }
              }
            }
          }
        }
      }
    }
  }
`

// ---------------------------------------------------------------------------
// Typed fetch functions
// ---------------------------------------------------------------------------

interface SubgraphDeploymentManifestsResponse {
  subgraphDeploymentManifests: SubgraphRaw[]
}

export interface FetchSubgraphDeploymentsOptions {
  /** Minimum signal in wei (default "0") */
  minSignal?: string
  /** Network filter array. If empty, the no-filter query is used. */
  networks?: string[]
}

/**
 * Fetches all subgraph deployments, automatically paginating through all pages
 * using cursor-based pagination (first: 1000, id_gt: cursor).
 */
export async function fetchSubgraphDeployments(
  client: GraphQLClient,
  options: FetchSubgraphDeploymentsOptions = {},
): Promise<SubgraphRaw[]> {
  const { minSignal = '0', networks = [] } = options
  const useNetworkFilter = networks.length > 0
  const query = useNetworkFilter
    ? SUBGRAPH_DEPLOYMENTS_QUERY
    : SUBGRAPH_DEPLOYMENTS_NO_NETWORK_FILTER_QUERY

  let allResults: SubgraphRaw[] = []
  let cursor = '0'

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const variables: Record<string, unknown> = { cursor, minSignal }
    if (useNetworkFilter) {
      variables.networks = networks
    }

    const data = await client.request<SubgraphDeploymentManifestsResponse>(query, variables)
    const page = data.subgraphDeploymentManifests

    allResults = allResults.concat(page)

    // If we got a full page, there might be more data
    if (page.length === 1000) {
      cursor = page[page.length - 1]!.id
    } else {
      break
    }
  }

  return allResults
}
