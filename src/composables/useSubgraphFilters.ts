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

    // Hoist work that is constant across rows out of the per-row loop:
    // parse the blacklist/synclist once, and build a Set for network lookups.
    const search = filters.search ? filters.search.toLowerCase() : ''
    const networkSet = filters.networks.length > 0 ? new Set(filters.networks) : null
    const blacklist = filters.activateBlacklist ? parseHashList(settingsStore.subgraphBlacklist) : null
    const synclist = filters.activateSynclist ? parseHashList(settingsStore.subgraphSynclist) : null

    return raw.filter((sg) => {
      const deployment = sg.deployment
      const ipfsHash = deployment.ipfsHash

      // Search filter: match against display name, IPFS hash, or subgraph ID
      if (search) {
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

      // Min signal: filter out subgraphs below a minimum signal threshold in GRT
      if (filters.minSignal > 0) {
        const signalGrt = weiToGrt(deployment.signalledTokens)
        if (signalGrt < filters.minSignal) return false
      }

      // Max signal: filter out subgraphs above a certain signal threshold
      if (filters.maxSignal > 0) {
        const signalGrt = weiToGrt(deployment.signalledTokens)
        if (signalGrt > filters.maxSignal) return false
      }

      // Allocation filter: 'only' = only currently allocated, 'hide' = hide currently
      // allocated (except those being closed in the wizard), 'none' = no filter.
      if (filters.allocationFilter === 'only') {
        if (!allocatedDeployments.value.has(ipfsHash)) return false
      } else if (filters.allocationFilter === 'hide') {
        if (allocatedDeployments.value.has(ipfsHash) && !closingDeployments?.value?.has(ipfsHash)) return false
      }

      // Network filter (multi-select: empty = all networks)
      if (networkSet) {
        if (!deployment.manifest.network || !networkSet.has(deployment.manifest.network)) return false
      }

      // Status filter
      if (filters.statusFilter !== 'none') {
        const status = statuses?.value?.get(ipfsHash)
        if (!applyStatusFilter(filters.statusFilter, status)) return false
      }

      // Blacklist
      if (blacklist && blacklist.has(ipfsHash)) return false

      // Synclist
      if (synclist && !synclist.has(ipfsHash)) return false

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
  // 'closable'/'not-closable' are handled post-computation using statusChecks.closable
  if (filter === 'closable' || filter === 'not-closable') return true
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
