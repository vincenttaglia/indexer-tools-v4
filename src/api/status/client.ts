import type { DeploymentStatus, ChainStatus, FatalError } from '@/types'

// ---------------------------------------------------------------------------
// Boundary normalization
//
// graph-node returns BlockReference.number as a JSON string (it's typed
// BigInt! in the schema). Our TypeScript types declare these as `number`
// and downstream code compares them with `>=` / `<` — which is lexicographic
// when both sides are strings, so e.g. "69820004" >= "466983967" is true.
// Coerce at the parse boundary so every consumer sees real numbers.
// ---------------------------------------------------------------------------

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeChain(raw: ChainStatus | null | undefined): ChainStatus {
  return {
    latestBlock: raw?.latestBlock
      ? { number: toNumberOrNull(raw.latestBlock.number) ?? 0 }
      : null,
    chainHeadBlock: raw?.chainHeadBlock
      ? { number: toNumberOrNull(raw.chainHeadBlock.number) ?? 0 }
      : null,
    earliestBlock: raw?.earliestBlock
      ? { number: toNumberOrNull(raw.earliestBlock.number) ?? 0 }
      : null,
  }
}

function normalizeFatalError(raw: FatalError | null | undefined): FatalError | null {
  if (!raw) return null
  return {
    message: raw.message,
    deterministic: raw.deterministic,
    block: raw.block
      ? {
          hash: raw.block.hash,
          number: toNumberOrNull(raw.block.number) ?? 0,
        }
      : null,
  }
}

/**
 * Normalize a deployment status: coerce all block-number fields from
 * BigInt-strings to numbers so downstream `>=` / `<` comparisons are
 * numeric, not lexicographic. Exported for testing.
 */
export function normalizeDeploymentStatus(raw: DeploymentStatus): DeploymentStatus {
  return {
    ...raw,
    fatalError: normalizeFatalError(raw.fatalError),
    chains: (raw.chains ?? []).map(normalizeChain),
  }
}

/**
 * The GraphQL query sent to graph-node status endpoints.
 * This matches the exact query shape used by v3.
 */
const STATUS_QUERY = `{
  indexingStatuses {
    subgraph
    synced
    health
    entityCount
    fatalError {
      message
      deterministic
      block {
        hash
        number
      }
    }
    node
    chains {
      latestBlock {
        number
      }
      chainHeadBlock {
        number
      }
      earliestBlock {
        number
      }
    }
  }
}`

/**
 * A targeted query for specific subgraph deployment statuses.
 */
const DEPLOYMENT_STATUS_QUERY = `query indexingStatuses($subgraphs: [String!]!) {
  indexingStatuses(subgraphs: $subgraphs) {
    subgraph
    synced
    health
    entityCount
    fatalError {
      message
      deterministic
      block {
        hash
        number
      }
    }
    node
    chains {
      latestBlock {
        number
      }
      chainHeadBlock {
        number
      }
      earliestBlock {
        number
      }
    }
  }
}`

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface StatusEndpointResponse {
  data: {
    indexingStatuses: DeploymentStatus[]
  }
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

/**
 * Fetches the deployment status for a single deployment from a graph-node status endpoint.
 *
 * @param statusUrl - The base URL of the graph-node (e.g., "https://indexer.example.com")
 * @param deploymentId - The IPFS hash of the subgraph deployment
 * @returns The deployment status, or null if not found or on error
 */
export async function fetchDeploymentStatus(
  statusUrl: string,
  deploymentId: string,
): Promise<DeploymentStatus | null> {
  try {
    const url = new URL('/status', statusUrl)
    const response = await fetch(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: DEPLOYMENT_STATUS_QUERY,
        variables: { subgraphs: [deploymentId] },
      }),
    })

    const json = (await response.json()) as StatusEndpointResponse
    const raw = json.data?.indexingStatuses?.[0]
    return raw ? normalizeDeploymentStatus(raw) : null
  } catch (error) {
    console.error(`Deployment status query error for ${deploymentId}:`, error)
    return null
  }
}

/**
 * Fetches all deployment statuses from a graph-node status endpoint.
 * This queries all indexing statuses without filtering, matching v3 behavior.
 *
 * @param statusUrl - The base URL of the graph-node (e.g., "https://indexer.example.com")
 * @returns A Map of deployment IPFS hash to its DeploymentStatus
 */
export async function fetchAllDeploymentStatuses(
  statusUrl: string,
): Promise<Map<string, DeploymentStatus>> {
  const results = new Map<string, DeploymentStatus>()

  try {
    const url = new URL('/status', statusUrl)
    const response = await fetch(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: STATUS_QUERY }),
    })

    const json = (await response.json()) as StatusEndpointResponse

    if (json.data?.indexingStatuses) {
      for (const status of json.data.indexingStatuses) {
        results.set(status.subgraph, normalizeDeploymentStatus(status))
      }
    }
  } catch (error) {
    console.error(`Deployment statuses query error for ${statusUrl}:`, error)
  }

  return results
}

/**
 * Fetches deployment statuses for a specific list of deployments.
 *
 * @param statusUrl - The base URL of the graph-node
 * @param deploymentIds - Array of IPFS hashes to query
 * @returns A Map of deployment IPFS hash to its DeploymentStatus
 */
export async function fetchDeploymentStatuses(
  statusUrl: string,
  deploymentIds: string[],
): Promise<Map<string, DeploymentStatus>> {
  const results = new Map<string, DeploymentStatus>()

  if (deploymentIds.length === 0) return results

  try {
    const url = new URL('/status', statusUrl)
    const response = await fetch(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: DEPLOYMENT_STATUS_QUERY,
        variables: { subgraphs: deploymentIds },
      }),
    })

    const json = (await response.json()) as StatusEndpointResponse

    if (json.data?.indexingStatuses) {
      for (const status of json.data.indexingStatuses) {
        results.set(status.subgraph, normalizeDeploymentStatus(status))
      }
    }
  } catch (error) {
    console.error('Deployment statuses query error:', error)
  }

  return results
}
