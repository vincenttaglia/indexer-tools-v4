import { computed } from 'vue'
import { useSubgraphsQuery } from './useSubgraphsQuery'

export interface SubgraphMetadataEntry {
  displayName: string
  image: string | null
  network: string | null
}

/**
 * Returns a Map<ipfsHash, SubgraphMetadataEntry> derived from the subgraphs
 * query data. This allows views that only have deployment IPFS hashes (Actions
 * Manager, QoS Dashboard, Query Dashboard) to look up human-readable subgraph
 * names and images without fetching additional data.
 */
export function useSubgraphMetadataMap() {
  const subgraphsQuery = useSubgraphsQuery()

  const metadataMap = computed(() => {
    const map = new Map<string, SubgraphMetadataEntry>()
    const subgraphs = subgraphsQuery.data.value ?? []
    for (const sg of subgraphs) {
      const hash = sg.deployment.ipfsHash
      const versions = sg.deployment.versions
      const meta = versions?.[0]?.metadata?.subgraphVersion?.subgraph?.metadata
      map.set(hash, {
        displayName: meta?.displayName ?? hash.slice(0, 8) + '...',
        image: meta?.image ?? null,
        network: sg.deployment.manifest.network ?? null,
      })
    }
    return map
  })

  return { metadataMap, isLoading: subgraphsQuery.isLoading }
}
