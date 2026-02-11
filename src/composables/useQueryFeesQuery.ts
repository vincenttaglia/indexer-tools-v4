import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useChainStore, useSettingsStore } from '@/stores'
import { createGraphQLClient, fetchQueryFeesDailyDataLatest } from '@/api'

/**
 * The QoS subgraph deployment ID on The Graph's decentralized network.
 * This is the gateway's QoS subgraph which tracks query fee data.
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
 * Wraps fetchQueryFeesDailyDataLatest with TanStack Query.
 *
 * Returns the latest query fees daily data points from the gateway's QoS
 * subgraph. This data is only meaningful for Arbitrum mainnet.
 *
 * Internally fetches the latest day number and then retrieves query fees
 * for the previous day (to ensure complete data).
 *
 * Enabled only when the user has configured a The Graph API key.
 */
export function useQueryFeesQuery() {
  const chainStore = useChainStore()
  const settingsStore = useSettingsStore()
  const { selectedChain } = storeToRefs(chainStore)
  const { theGraphApiKey } = storeToRefs(settingsStore)

  return useQuery({
    queryKey: computed(() => ['query-fees', selectedChain.value] as const),
    queryFn: async () => {
      const client = createGraphQLClient(getQosSubgraphUrl(theGraphApiKey.value))
      return fetchQueryFeesDailyDataLatest(client)
    },
    enabled: computed(() => !!theGraphApiKey.value),
  })
}
