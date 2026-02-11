import { ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * Row selection state for data tables.
 *
 * Tracks which rows are selected in the subgraphs, allocations, and actions
 * tables. NOT persisted -- selections reset each session.
 */
export const useSelectionStore = defineStore('selection', () => {
  const selectedSubgraphs = ref(new Set<string>())
  const selectedAllocations = ref(new Set<string>())
  const selectedActions = ref(new Set<string>())

  // --- Subgraphs ---

  function toggleSubgraph(id: string): void {
    if (selectedSubgraphs.value.has(id)) {
      selectedSubgraphs.value.delete(id)
    } else {
      selectedSubgraphs.value.add(id)
    }
  }

  function selectAllSubgraphs(ids: string[]): void {
    selectedSubgraphs.value = new Set(ids)
  }

  function clearAllSubgraphs(): void {
    selectedSubgraphs.value = new Set()
  }

  // --- Allocations ---

  function toggleAllocation(id: string): void {
    if (selectedAllocations.value.has(id)) {
      selectedAllocations.value.delete(id)
    } else {
      selectedAllocations.value.add(id)
    }
  }

  function selectAllAllocations(ids: string[]): void {
    selectedAllocations.value = new Set(ids)
  }

  function clearAllAllocations(): void {
    selectedAllocations.value = new Set()
  }

  // --- Actions ---

  function toggleAction(id: string): void {
    if (selectedActions.value.has(id)) {
      selectedActions.value.delete(id)
    } else {
      selectedActions.value.add(id)
    }
  }

  function selectAllActions(ids: string[]): void {
    selectedActions.value = new Set(ids)
  }

  function clearAllActions(): void {
    selectedActions.value = new Set()
  }

  return {
    selectedSubgraphs,
    selectedAllocations,
    selectedActions,
    toggleSubgraph,
    selectAllSubgraphs,
    clearAllSubgraphs,
    toggleAllocation,
    selectAllAllocations,
    clearAllAllocations,
    toggleAction,
    selectAllActions,
    clearAllActions,
  }
})
