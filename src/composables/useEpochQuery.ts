import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useChainStore, useSettingsStore } from '@/stores'
import { createGraphQLClient, fetchLatestEpoch } from '@/api'
import { getChainConfig } from '@/config/chains'

/**
 * Wraps fetchLatestEpoch with TanStack Query.
 *
 * Returns the latest epoch data from the EBO subgraph for the currently
 * selected chain. This includes epoch number and block numbers across networks.
 *
 * Enabled only when the user has configured a The Graph API key.
 */
export function useEpochQuery() {
  const chainStore = useChainStore()
  const settingsStore = useSettingsStore()
  const { selectedChain } = storeToRefs(chainStore)
  const { theGraphApiKey } = storeToRefs(settingsStore)

  return useQuery({
    queryKey: computed(() => ['epoch', selectedChain.value] as const),
    queryFn: async () => {
      const config = getChainConfig(selectedChain.value, theGraphApiKey.value)
      const client = createGraphQLClient(config.eboSubgraphUrl)
      return fetchLatestEpoch(client)
    },
    enabled: computed(() => !!theGraphApiKey.value),
  })
}
