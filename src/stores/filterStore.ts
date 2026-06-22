import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface SubgraphFilters {
  search: string
  rewardsFilter: 0 | 1 | 2 // 0=Exclude Denied, 1=Include, 2=Only Denied
  allocationFilter: 'none' | 'only' | 'hide' // none=no filter, only=only allocated, hide=hide allocated
  minSignal: number
  maxSignal: number // 0 = disabled
  networks: string[] // empty = all networks
  statusFilter: string // 'none' | 'all' | 'closable' | 'not-closable' | 'healthy' | 'syncing' | 'failed' | 'non-deterministic' | 'deterministic'
  activateBlacklist: boolean
  activateSynclist: boolean
  targetApr: number
}

export interface AllocationFilters {
  search: string
  statusFilter: string
  networks: string[]
  activateBlacklist: boolean
  activateSynclist: boolean
}

export interface QosFilters {
  search: string
}

export interface QueryFeeFilters {
  search: string
}

const SUBGRAPH_DEFAULTS: SubgraphFilters = {
  search: '',
  rewardsFilter: 0,
  allocationFilter: 'none',
  minSignal: 0,
  maxSignal: 0,
  networks: [],
  statusFilter: 'none',
  activateBlacklist: false,
  activateSynclist: false,
  targetApr: 10,
}

const ALLOCATION_DEFAULTS: AllocationFilters = {
  search: '',
  statusFilter: 'none',
  networks: [],
  activateBlacklist: false,
  activateSynclist: false,
}

/**
 * Table filter state for subgraph and allocation views.
 *
 * Persisted to localStorage (except text search fields which reset each session).
 */
export const useFilterStore = defineStore('filters', () => {
  const subgraphFilters = ref<SubgraphFilters>({ ...SUBGRAPH_DEFAULTS })

  const allocationFilters = ref<AllocationFilters>({ ...ALLOCATION_DEFAULTS })

  const qosFilters = ref<QosFilters>({
    search: '',
  })

  const queryFeeFilters = ref<QueryFeeFilters>({
    search: '',
  })

  return {
    subgraphFilters,
    allocationFilters,
    qosFilters,
    queryFeeFilters,
  }
}, {
  persist: {
    serializer: {
      serialize(state) {
        // Strip search fields before persisting
        const s = state as {
          subgraphFilters: SubgraphFilters
          allocationFilters: AllocationFilters
          qosFilters: QosFilters
          queryFeeFilters: QueryFeeFilters
        }
        return JSON.stringify({
          subgraphFilters: { ...s.subgraphFilters, search: '' },
          allocationFilters: { ...s.allocationFilters, search: '' },
          qosFilters: { ...s.qosFilters, search: '' },
          queryFeeFilters: { ...s.queryFeeFilters, search: '' },
        })
      },
      deserialize(value) {
        const parsed = JSON.parse(value)
        // Merge with defaults so new filter fields added in future versions
        // get their default values instead of undefined
        return {
          subgraphFilters: { ...SUBGRAPH_DEFAULTS, ...parsed.subgraphFilters, search: '' },
          allocationFilters: { ...ALLOCATION_DEFAULTS, ...parsed.allocationFilters, search: '' },
          qosFilters: { ...parsed.qosFilters, search: '' },
          queryFeeFilters: { ...parsed.queryFeeFilters, search: '' },
        }
      },
    },
  },
})
