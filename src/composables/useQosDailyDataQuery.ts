import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useChainStore, useSettingsStore, useAccountStore } from '@/stores'
import { createGraphQLClient, fetchQosDailyDataLatest } from '@/api'

/**
 * The QoS subgraph deployment ID on The Graph's decentralized network.
 * This is the gateway's QoS subgraph which tracks per-allocation QoS data.
 * QoS data is only available for Arbitrum mainnet.
 */
const QOS_SUBGRAPH_ID = 'Dtr9rETvwokot4BSXaD5tECanXfqfJKcvHuaaEgPDD2D'

/**
 * Builds the QoS subgraph URL with the user's API key.
 */
function getQosSubgraphUrl(apiKey: string): string {
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${QOS_SUBGRAPH_ID}`
}

/**
 * Wraps fetchQosDailyDataLatest with TanStack Query.
 *
 * Returns the latest allocation-level QoS daily data points from the gateway's
 * QoS subgraph for the active indexer account. This data is only meaningful
 * for Arbitrum mainnet.
 *
 * Internally fetches the latest day number and then retrieves QoS data
 * for the previous day (to ensure complete data).
 *
 * Enabled only when the user has configured a The Graph API key and has an
 * active account selected.
 */
export function useQosDailyDataQuery() {
  const chainStore = useChainStore()
  const settingsStore = useSettingsStore()
  const accountStore = useAccountStore()
  const { selectedChain } = storeToRefs(chainStore)
  const { theGraphApiKey } = storeToRefs(settingsStore)
  const { activeAccount } = storeToRefs(accountStore)

  return useQuery({
    queryKey: computed(() => [
      'qos-daily-data',
      selectedChain.value,
      activeAccount.value?.address ?? '',
    ] as const),
    queryFn: async () => {
      const account = activeAccount.value
      if (!account) throw new Error('No active account')

      const client = createGraphQLClient(getQosSubgraphUrl(theGraphApiKey.value))
      return fetchQosDailyDataLatest(client, account.address)
    },
    enabled: computed(() => !!theGraphApiKey.value && !!activeAccount.value),
  })
}
