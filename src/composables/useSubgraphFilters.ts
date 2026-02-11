import { computed, type Ref } from 'vue'
import type { SubgraphRaw } from '@/types'
import { useFilterStore } from '@/stores'
import { weiToGrt } from '@/services/calculations'

/**
 * Applies pre-computation filters to raw subgraph data.
 * These filters operate on raw data fields (no calculation needed).
 *
 * Replaces v3's cascading filter chains in the subgraphs store getFilteredSubgraphs
 * getter with a single computed that runs BEFORE the expensive computation pass.
 *
 * @param subgraphs - Reactive ref to raw subgraph data from TanStack Query
 * @param allocatedDeployments - Set of deployment IPFS hashes the indexer has allocated to
 * @returns Filtered SubgraphRaw[]
 */
export function useSubgraphFilters(
  subgraphs: Ref<SubgraphRaw[] | undefined>,
  allocatedDeployments: Ref<Set<string>>,
) {
  const filterStore = useFilterStore()

  const filtered = computed<SubgraphRaw[]>(() => {
    const raw = subgraphs.value ?? []
    const filters = filterStore.subgraphFilters

    return raw.filter((sg) => {
      const deployment = sg.deployment

      // Search filter: match against display name, IPFS hash, or subgraph ID
      if (filters.search) {
        const search = filters.search.toLowerCase()
        const name =
          deployment.versions?.[0]?.metadata?.subgraphVersion?.subgraph
            ?.metadata?.displayName ?? ''
        const matches =
          name.toLowerCase().includes(search) ||
          deployment.ipfsHash.toLowerCase().includes(search) ||
          sg.id.toLowerCase().includes(search)
        if (!matches) return false
      }

      // Rewards filter: 0 = Exclude Denied, 1 = Include all, 2 = Only Denied
      if (filters.rewardsFilter === 0 && deployment.deniedAt !== null && deployment.deniedAt > 0) {
        return false
      }
      if (filters.rewardsFilter === 2 && (deployment.deniedAt === null || deployment.deniedAt === 0)) {
        return false
      }

      // Hide small signal (below minimum signal threshold in GRT)
      if (filters.hideSmallSignal && filters.minSignal > 0) {
        const signalGrt = weiToGrt(deployment.signalledTokens)
        if (signalGrt < filters.minSignal) return false
      }

      // Only show subgraphs the indexer is currently allocated to
      if (filters.onlyAllocated) {
        if (!allocatedDeployments.value.has(deployment.ipfsHash)) return false
      }

      // Network filter (multi-select: empty = all networks)
      if (filters.networks.length > 0) {
        if (!deployment.manifest.network || !filters.networks.includes(deployment.manifest.network)) return false
      }

      return true
    })
  })

  return { filtered }
}
