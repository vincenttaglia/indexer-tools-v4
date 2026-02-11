import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

/**
 * Allocation wizard state.
 *
 * Tracks the deployments selected for allocation and the GRT amounts
 * assigned to each. NOT persisted -- wizard state resets each session.
 */
export const useWizardStore = defineStore('wizard', () => {
  /** Set of selected deployment IPFS hashes. */
  const selectedDeployments = ref(new Set<string>())

  /** Map of deployment IPFS hash to allocation amount in GRT (as string for precision). */
  const allocationAmounts = ref(new Map<string, string>())

  /** Toggle a deployment in/out of the selection. Clears its amount when deselected. */
  function toggleDeployment(ipfsHash: string): void {
    if (selectedDeployments.value.has(ipfsHash)) {
      selectedDeployments.value.delete(ipfsHash)
      allocationAmounts.value.delete(ipfsHash)
    } else {
      selectedDeployments.value.add(ipfsHash)
    }
  }

  /** Set the GRT allocation amount for a specific deployment. */
  function setAmount(ipfsHash: string, amount: string): void {
    allocationAmounts.value.set(ipfsHash, amount)
  }

  /** Clear all selections and amounts. */
  function clearAll(): void {
    selectedDeployments.value.clear()
    allocationAmounts.value.clear()
  }

  /** Sum of all allocation amounts across all selected deployments. */
  const totalAllocated = computed<number>(() => {
    let total = 0
    for (const amount of allocationAmounts.value.values()) {
      const parsed = parseFloat(amount)
      if (!Number.isNaN(parsed)) {
        total += parsed
      }
    }
    return total
  })

  return {
    selectedDeployments,
    allocationAmounts,
    toggleDeployment,
    setAmount,
    clearAll,
    totalAllocated,
  }
})
