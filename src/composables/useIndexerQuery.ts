import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useChainStore, useSettingsStore, useAccountStore } from '@/stores'
import { createGraphQLClient, fetchIndexerData } from '@/api'
import { getChainConfig } from '@/config/chains'

/**
 * Wraps fetchIndexerData with TanStack Query.
 *
 * Returns on-chain data (reward cut, available stake, URL) for the currently
 * active indexer account from the Network Subgraph.
 *
 * Enabled only when both an API key and an active account are available.
 */
export function useIndexerQuery() {
  const chainStore = useChainStore()
  const settingsStore = useSettingsStore()
  const accountStore = useAccountStore()
  const { selectedChain } = storeToRefs(chainStore)
  const { theGraphApiKey } = storeToRefs(settingsStore)
  const { activeAccount } = storeToRefs(accountStore)

  return useQuery({
    queryKey: computed(() => [
      'indexer',
      selectedChain.value,
      activeAccount.value?.address ?? '',
    ] as const),
    queryFn: async () => {
      const account = activeAccount.value
      if (!account) throw new Error('No active account')

      const config = getChainConfig(selectedChain.value, theGraphApiKey.value)
      const client = createGraphQLClient(config.networkSubgraphUrl)
      return fetchIndexerData(client, account.address)
    },
    enabled: computed(() => !!theGraphApiKey.value && !!activeAccount.value),
  })
}
