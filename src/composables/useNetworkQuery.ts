import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useChainStore, useSettingsStore } from '@/stores'
import { createGraphQLClient, fetchNetworkMetrics } from '@/api'
import { getChainConfig } from '@/config/chains'

/**
 * Wraps fetchNetworkMetrics with TanStack Query.
 *
 * Returns top-level Graph Network metrics (signal, issuance, supply, epoch, etc.)
 * from the Network Subgraph for the currently selected chain.
 *
 * Enabled only when the user has configured a The Graph API key.
 */
export function useNetworkQuery() {
  const chainStore = useChainStore()
  const settingsStore = useSettingsStore()
  const { selectedChain } = storeToRefs(chainStore)
  const { theGraphApiKey } = storeToRefs(settingsStore)

  return useQuery({
    queryKey: computed(() => ['network-metrics', selectedChain.value] as const),
    queryFn: async () => {
      const config = getChainConfig(selectedChain.value, theGraphApiKey.value)
      const client = createGraphQLClient(config.networkSubgraphUrl)
      return fetchNetworkMetrics(client)
    },
    enabled: computed(() => !!theGraphApiKey.value),
  })
}
