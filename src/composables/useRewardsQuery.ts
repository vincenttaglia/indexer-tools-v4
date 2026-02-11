import { computed, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { useChainStore, useSettingsStore } from '@/stores'
import { createRpcClient, getBatchPendingRewards } from '@/api'
import { getChainConfig } from '@/config/chains'
import type { Address } from 'viem'

/**
 * Descriptor for an allocation whose pending rewards should be fetched.
 */
export interface AllocationDescriptor {
  id: Address
  isLegacy: boolean
}

/**
 * Wraps getBatchPendingRewards with TanStack Query.
 *
 * Fetches pending (uncollected) rewards for a list of allocations via the
 * on-chain Rewards contract. Uses viem's PublicClient to perform view calls.
 *
 * Disabled by default (enabled: false). The caller must trigger the query
 * manually via the returned `refetch` function, since reward lookups are
 * expensive RPC calls that the user should opt into.
 *
 * @param allocations - Reactive ref to an array of allocation descriptors (id + isLegacy)
 */
export function useRewardsQuery(allocations: Ref<AllocationDescriptor[]>) {
  const chainStore = useChainStore()
  const settingsStore = useSettingsStore()
  const { selectedChain } = storeToRefs(chainStore)
  const { drpcApiKey } = storeToRefs(settingsStore)

  const allocationIds = computed(() =>
    allocations.value.map((a) => a.id).sort().join(','),
  )

  return useQuery({
    queryKey: computed(() => [
      'pending-rewards',
      selectedChain.value,
      allocationIds.value,
    ] as const),
    queryFn: async () => {
      const config = getChainConfig(selectedChain.value, drpcApiKey.value)
      const client = createRpcClient(selectedChain.value, config.rpcUrl)
      return getBatchPendingRewards(
        client,
        config.rewardsContractAddress as Address,
        allocations.value,
      )
    },
    enabled: false,
  })
}
