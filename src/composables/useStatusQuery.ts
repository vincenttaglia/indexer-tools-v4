import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchAllDeploymentStatuses } from '@/api'
import { useIndexerQuery } from './useIndexerQuery'

/**
 * Wraps fetchAllDeploymentStatuses with TanStack Query.
 *
 * Queries the indexer's graph-node status endpoint to retrieve deployment
 * statuses for all indexed subgraphs. Returns a Map keyed by deployment
 * IPFS hash.
 *
 * The status URL is derived from the indexer's registered service URL in the
 * Network Subgraph (IndexerOnChainData.url), NOT the agent admin endpoint.
 * The graph-node status endpoint is at {service-url}/status (typically port 8030).
 *
 * Enabled only when the indexer query has returned a non-empty URL.
 */
export function useStatusQuery() {
  const indexerQuery = useIndexerQuery()

  const statusUrl = computed(() => indexerQuery.data.value?.url ?? '')

  return useQuery({
    queryKey: computed(() => ['deployment-statuses', statusUrl.value] as const),
    queryFn: async () => {
      if (!statusUrl.value) throw new Error('No indexer service URL found in Network Subgraph')
      return fetchAllDeploymentStatuses(statusUrl.value)
    },
    enabled: computed(() => !!statusUrl.value),
  })
}
