import { computed, type Ref } from 'vue'
import type { AllocationComputed, DeploymentStatus } from '@/types'
import { useFilterStore, useSettingsStore } from '@/stores'

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
 * Pre-computation filter for allocations.
 * Runs on AllocationComputed[] (after computation, so status checks are available).
 */
export function useAllocationFilters(
  allocations: Ref<AllocationComputed[]>,
  statuses: Ref<Map<string, DeploymentStatus> | undefined>,
) {
  const filterStore = useFilterStore()
  const settingsStore = useSettingsStore()

  const filtered = computed<AllocationComputed[]>(() => {
    const all = allocations.value
    const filters = filterStore.allocationFilters

    return all.filter((alloc) => {
      const d = alloc.subgraphDeployment
      const ipfsHash = d.ipfsHash

      // Search filter: name, IPFS hash, allocation ID
      if (filters.search) {
        const search = filters.search.toLowerCase().trim()
        const name = d.originalName ?? d.versions?.[0]?.subgraph?.metadata?.displayName ?? ''
        const matches =
          name.toLowerCase().includes(search) ||
          ipfsHash.toLowerCase().includes(search) ||
          alloc.id.toLowerCase().includes(search)
        if (!matches) return false
      }

      // Network filter (multi-select)
      if (filters.networks.length > 0) {
        if (!d.manifest.network || !filters.networks.includes(d.manifest.network)) return false
      }

      // Status filter
      if (filters.statusFilter !== 'none') {
        const status = statuses.value?.get(ipfsHash)
        if (!applyStatusFilter(filters.statusFilter, status, alloc)) return false
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
  alloc: AllocationComputed,
): boolean {
  if (filter === 'all') return true
  if (!status) return filter === 'none'

  switch (filter) {
    case 'closable':
      return alloc.statusChecks.closable
    case 'healthy-synced':
      return status.health === 'healthy' && status.synced
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
