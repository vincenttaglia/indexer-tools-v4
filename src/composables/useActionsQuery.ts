import { computed, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useAccountStore } from '@/stores'
import { createGraphQLClient, fetchActions } from '@/api'
import type { ActionFilter } from '@/types'

/**
 * Wraps fetchActions with TanStack Query.
 *
 * Returns actions from the active account's indexer agent admin API,
 * optionally filtered by status, type, deployment, etc.
 *
 * The agent endpoint is a GraphQL API exposed by the indexer agent, which
 * manages allocation lifecycle (queue, approve, execute, cancel).
 *
 * Enabled only when the active account has a non-empty agentEndpoint.
 *
 * @param filter - Optional reactive ref to an ActionFilter for narrowing results
 */
export function useActionsQuery(filter?: Ref<ActionFilter>) {
  const accountStore = useAccountStore()
  const { activeAccount } = storeToRefs(accountStore)

  const agentEndpoint = computed(() => {
    const ep = activeAccount.value?.agentEndpoint ?? ''
    console.log('[useActionsQuery] agentEndpoint computed:', ep, 'activeAccount:', activeAccount.value?.address)
    return ep
  })
  const resolvedFilter = computed(() => filter?.value ?? {})

  return useQuery({
    queryKey: computed(() => [
      'actions',
      agentEndpoint.value,
      resolvedFilter.value,
    ] as const),
    queryFn: async () => {
      console.log('[useActionsQuery] queryFn CALLED, endpoint:', agentEndpoint.value)
      if (!agentEndpoint.value) throw new Error('No agent endpoint configured')

      try {
        const client = createGraphQLClient(agentEndpoint.value)
        const result = await fetchActions(client, resolvedFilter.value)
        console.log('[useActionsQuery] queryFn SUCCESS, actions:', result.length)
        return result
      } catch (err) {
        console.error('[useActionsQuery] queryFn ERROR:', err)
        throw err
      }
    },
    enabled: computed(() => {
      const val = !!agentEndpoint.value
      console.log('[useActionsQuery] enabled computed:', val)
      return val
    }),
  })
}
