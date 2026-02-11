import { computed, type Ref } from 'vue'
import type { SubgraphRaw, DeploymentStatus } from '@/types'
import { useFilterStore, useSettingsStore } from '@/stores'
import { weiToGrt } from '@/services/calculations'

/**
 * Parses a comma/newline-separated string of IPFS hashes into a Set.
 */
function parseHashList(raw: string): Set<string> {
  const set = new Set<string>()
  if (!raw.trim()) return set
  for (const entry of raw.split(/[,\n]/)) {
    const hash = entry.trim()
    if (hash) set.add(hash)
  }
  return set
}

/**
 * Applies pre-computation filters to raw subgraph data.
 * These filters operate on raw data fields (no calculation needed).
 *
 * @param subgraphs - Reactive ref to raw subgraph data from TanStack Query
 * @param allocatedDeployments - Set of deployment IPFS hashes the indexer has allocated to
 * @param statuses - Deployment statuses from the graph-node status endpoint
 * @returns Filtered SubgraphRaw[]
 */
export function useSubgraphFilters(
  subgraphs: Ref<SubgraphRaw[] | undefined>,
  allocatedDeployments: Ref<Set<string>>,
  statuses?: Ref<Map<string, DeploymentStatus> | undefined>,
  closingDeployments?: Ref<Set<string>>,
) {
  const filterStore = useFilterStore()
  const settingsStore = useSettingsStore()

  const filtered = computed<SubgraphRaw[]>(() => {
    const raw = subgraphs.value ?? []
    const filters = filterStore.subgraphFilters

    return raw.filter((sg) => {
      const deployment = sg.deployment
      const ipfsHash = deployment.ipfsHash

      // Search filter: match against display name, IPFS hash, or subgraph ID
      if (filters.search) {
        const search = filters.search.toLowerCase()
        const name =
          deployment.versions?.[0]?.metadata?.subgraphVersion?.subgraph
            ?.metadata?.displayName ?? ''
        const matches =
          name.toLowerCase().includes(search) ||
          ipfsHash.toLowerCase().includes(search) ||
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

      // Max signal: filter out subgraphs above a certain signal threshold
      if (filters.maxSignal > 0) {
        const signalGrt = weiToGrt(deployment.signalledTokens)
        if (signalGrt > filters.maxSignal) return false
      }

      // Only show subgraphs the indexer is currently allocated to
      if (filters.onlyAllocated) {
        if (!allocatedDeployments.value.has(ipfsHash)) return false
      }

      // Hide currently allocated subgraphs (except those being closed in wizard)
      if (filters.hideCurrentlyAllocated) {
        if (allocatedDeployments.value.has(ipfsHash) && !closingDeployments?.value?.has(ipfsHash)) return false
      }

      // Only show subgraphs the indexer has deployed on their graph-node
      if (filters.onlyDeployed) {
        if (!statuses?.value?.has(ipfsHash)) return false
      }

      // Network filter (multi-select: empty = all networks)
      if (filters.networks.length > 0) {
        if (!deployment.manifest.network || !filters.networks.includes(deployment.manifest.network)) return false
      }

      // Status filter
      if (filters.statusFilter !== 'none') {
        const status = statuses?.value?.get(ipfsHash)
        if (!applyStatusFilter(filters.statusFilter, status)) return false
      }

      // Blacklist
      if (filters.activateBlacklist) {
        const blacklist = parseHashList(settingsStore.subgraphBlacklist)
        if (blacklist.has(ipfsHash)) return false
      }

      // Synclist
      if (filters.activateSynclist) {
        const synclist = parseHashList(settingsStore.subgraphSynclist)
        if (!synclist.has(ipfsHash)) return false
      }

      return true
    })
  })

  return { filtered }
}

function applyStatusFilter(
  filter: string,
  status: DeploymentStatus | undefined,
): boolean {
  if (filter === 'all') return !!status
  // 'closable' is handled post-computation using statusChecks.closable
  if (filter === 'closable') return true
  if (!status) return false

  switch (filter) {
    case 'healthy':
      return status.health === 'healthy'
    case 'syncing':
      return status.health === 'healthy' && !status.synced
    case 'failed':
      return status.health === 'failed'
    case 'non-deterministic':
      return status.health === 'failed' && status.fatalError !== null && !status.fatalError.deterministic
    case 'deterministic':
      return status.health === 'failed' && status.fatalError !== null && status.fatalError.deterministic
    default:
      return true
  }
}
