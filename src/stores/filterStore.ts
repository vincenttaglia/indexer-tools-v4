import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface SubgraphFilters {
  search: string
  hideSmallSignal: boolean
  hideDenied: boolean
  onlyAllocated: boolean
  minSignal: number
  network: string | null
}

export interface AllocationFilters {
  search: string
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
    hideDenied: false,
    onlyAllocated: false,
    minSignal: 0,
    network: null,
  })

  const allocationFilters = ref<AllocationFilters>({
    search: '',
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
