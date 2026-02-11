import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useAccountStore } from '@/stores'
import { fetchAllDeploymentStatuses } from '@/api'

/**
 * Wraps fetchAllDeploymentStatuses with TanStack Query.
 *
 * Queries the active account's graph-node status endpoint to retrieve
 * deployment statuses for all indexed subgraphs. Returns a Map keyed by
 * deployment IPFS hash.
 *
 * The status URL is derived from the active account's agentEndpoint. The
 * graph-node status endpoint is expected at the /status path of the base URL.
 *
 * Enabled only when an active account with a non-empty agentEndpoint is available.
 */
export function useStatusQuery() {
  const accountStore = useAccountStore()
  const { activeAccount } = storeToRefs(accountStore)

  const statusUrl = computed(() => activeAccount.value?.agentEndpoint ?? '')

  return useQuery({
    queryKey: computed(() => ['deployment-statuses', statusUrl.value] as const),
    queryFn: async () => {
      if (!statusUrl.value) throw new Error('No status URL configured')
      return fetchAllDeploymentStatuses(statusUrl.value)
    },
    enabled: computed(() => !!statusUrl.value),
  })
}
