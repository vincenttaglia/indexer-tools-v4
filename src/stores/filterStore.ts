import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface SubgraphFilters {
  search: string
  hideSmallSignal: boolean
  rewardsFilter: 0 | 1 | 2 // 0=Exclude Denied, 1=Include, 2=Only Denied
  onlyAllocated: boolean
  hideCurrentlyAllocated: boolean
  onlyDeployed: boolean
  minSignal: number
  maxSignal: number // 0 = disabled
  networks: string[] // empty = all networks
  statusFilter: string // 'none' | 'all' | 'closable' | 'healthy' | 'syncing' | 'failed' | 'non-deterministic' | 'deterministic'
  activateBlacklist: boolean
  activateSynclist: boolean
  targetApr: number
  newAllocation: number
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

/**
 * Table filter state for subgraph and allocation views.
 *
 * NOT persisted -- filters reset each session so the user always starts
 * with a clean view.
 */
export const useFilterStore = defineStore('filters', () => {
  const subgraphFilters = ref<SubgraphFilters>({
    search: '',
    hideSmallSignal: false,
    rewardsFilter: 0,
    onlyAllocated: false,
    hideCurrentlyAllocated: false,
    onlyDeployed: false,
    minSignal: 0,
    maxSignal: 0,
    networks: [],
    statusFilter: 'none',
    activateBlacklist: false,
    activateSynclist: false,
    targetApr: 10,
    newAllocation: 100000,
  })

  const allocationFilters = ref<AllocationFilters>({
    search: '',
    statusFilter: 'none',
    networks: [],
    activateBlacklist: false,
    activateSynclist: false,
  })

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
})
