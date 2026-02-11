import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useChainStore, useSettingsStore, useAccountStore } from '@/stores'
import { createGraphQLClient, fetchAllocations } from '@/api'
import { getChainConfig } from '@/config/chains'

/**
 * Wraps fetchAllocations with TanStack Query.
 *
 * Returns all active allocations for the currently active indexer account
 * from the Network Subgraph. Automatically paginates through all pages.
 *
 * Enabled only when both an API key and an active account are available.
 */
export function useAllocationsQuery() {
  const chainStore = useChainStore()
  const settingsStore = useSettingsStore()
  const accountStore = useAccountStore()
  const { selectedChain } = storeToRefs(chainStore)
  const { theGraphApiKey } = storeToRefs(settingsStore)
  const { activeAccount } = storeToRefs(accountStore)

  return useQuery({
    queryKey: computed(() => [
      'allocations',
      selectedChain.value,
      activeAccount.value?.address ?? '',
    ] as const),
    queryFn: async () => {
      const account = activeAccount.value
      if (!account) throw new Error('No active account')

      const config = getChainConfig(selectedChain.value, theGraphApiKey.value)
      const client = createGraphQLClient(config.networkSubgraphUrl)
      return fetchAllocations(client, account.address)
    },
    enabled: computed(() => !!theGraphApiKey.value && !!activeAccount.value),
  })
}
