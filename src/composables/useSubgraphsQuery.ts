import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useChainStore, useSettingsStore } from '@/stores'
import { createGraphQLClient, fetchSubgraphDeployments } from '@/api'
import { getChainConfig } from '@/config/chains'

/**
 * Wraps fetchSubgraphDeployments with TanStack Query.
 *
 * Returns all subgraph deployments from the Network Subgraph for the currently
 * selected chain. Automatically paginates through all pages of results.
 *
 * Enabled only when the user has configured a The Graph API key.
 */
export function useSubgraphsQuery() {
  const chainStore = useChainStore()
  const settingsStore = useSettingsStore()
  const { selectedChain } = storeToRefs(chainStore)
  const { theGraphApiKey } = storeToRefs(settingsStore)

  return useQuery({
    queryKey: computed(() => ['subgraph-deployments', selectedChain.value] as const),
    queryFn: async () => {
      const config = getChainConfig(selectedChain.value, theGraphApiKey.value)
      const client = createGraphQLClient(config.networkSubgraphUrl)
      return fetchSubgraphDeployments(client)
    },
    enabled: computed(() => !!theGraphApiKey.value),
  })
}
