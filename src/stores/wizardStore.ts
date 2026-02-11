import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { AllocationRaw, ActionInput, SubgraphComputed } from '@/types'
import { grtToWei, weiToGrt } from '@/services/calculations'

const ZERO_POI = '0x0000000000000000000000000000000000000000000000000000000000000000'

/**
 * Allocation wizard state.
 *
 * Tracks ALL wizard state across the 5-step stepper:
 *   Step 1: Close allocations selection
 *   Step 2: Custom POI setter
 *   Step 3: Pick subgraphs for new allocations
 *   Step 4: Set allocation amounts
 *   Step 5: Execute actions
 *
 * NOT persisted -- wizard state resets each session.
 */
export const useWizardStore = defineStore('wizard', () => {
  // ---------------------------------------------------------------------------
  // Step 1: Close Allocations
  // ---------------------------------------------------------------------------

  /** Allocations selected for closing, keyed by allocation ID */
  const closingAllocations = ref(new Map<string, AllocationRaw>())

  function toggleClosingAllocation(allocation: AllocationRaw): void {
    if (closingAllocations.value.has(allocation.id)) {
      closingAllocations.value.delete(allocation.id)
    } else {
      closingAllocations.value.set(allocation.id, allocation)
    }
  }

  function setClosingAllocations(allocations: Map<string, AllocationRaw>): void {
    closingAllocations.value = allocations
  }

  /** Total wei being freed by closing allocations */
  const closingStakeWei = computed<number>(() => {
    let total = 0
    for (const alloc of closingAllocations.value.values()) {
      total += Number(alloc.allocatedTokens)
    }
    return total
  })

  /** Set of deployment IPFS hashes being closed */
  const closingDeploymentHashes = computed<Set<string>>(() => {
    const hashes = new Set<string>()
    for (const alloc of closingAllocations.value.values()) {
      hashes.add(alloc.subgraphDeployment.ipfsHash)
    }
    return hashes
  })

  // ---------------------------------------------------------------------------
  // Step 2: Custom POIs
  // ---------------------------------------------------------------------------

  /** Custom POI hex strings, keyed by deployment IPFS hash */
  const customPOIs = ref(new Map<string, string>())
  /** Custom block heights, keyed by deployment IPFS hash */
  const customBlockHeights = ref(new Map<string, number>())
  /** Custom public POI hex strings, keyed by deployment IPFS hash */
  const customPublicPOIs = ref(new Map<string, string>())

  function setCustomPOI(
    ipfsHash: string,
    poi: string,
    blockHeight: number,
    publicPOI: string,
  ): void {
    customPOIs.value.set(ipfsHash, poi)
    customBlockHeights.value.set(ipfsHash, blockHeight)
    customPublicPOIs.value.set(ipfsHash, publicPOI)
  }

  function clearCustomPOI(ipfsHash: string): void {
    customPOIs.value.delete(ipfsHash)
    customBlockHeights.value.delete(ipfsHash)
    customPublicPOIs.value.delete(ipfsHash)
  }

  // ---------------------------------------------------------------------------
  // Step 3: Pick Subgraphs
  // ---------------------------------------------------------------------------

  /** Set of selected deployment IPFS hashes for new allocations */
  const selectedDeployments = ref(new Set<string>())

  function toggleDeployment(ipfsHash: string): void {
    if (selectedDeployments.value.has(ipfsHash)) {
      selectedDeployments.value.delete(ipfsHash)
      allocationAmounts.value.delete(ipfsHash)
    } else {
      selectedDeployments.value.add(ipfsHash)
    }
  }

  // ---------------------------------------------------------------------------
  // Step 4: Set Allocations
  // ---------------------------------------------------------------------------

  /** Map of deployment IPFS hash to allocation amount in GRT (as string for precision) */
  const allocationAmounts = ref(new Map<string, string>())
  /** Minimum GRT allocation for subgraphs with signal */
  const minAllocation = ref(0)
  /** Minimum GRT allocation for denied / 0-signal subgraphs */
  const minAllocation0Signal = ref(0)

  function setAmount(ipfsHash: string, amount: string): void {
    allocationAmounts.value.set(ipfsHash, amount)
  }

  /** Set all selected subgraphs to their max allocation value */
  function setAllMaxAllos(subgraphs: SubgraphComputed[]): void {
    for (const sg of subgraphs) {
      if (!selectedDeployments.value.has(sg.deployment.ipfsHash)) continue
      if (
        sg.maxAllo !== Number.MIN_SAFE_INTEGER &&
        isFinite(sg.maxAllo) &&
        Math.floor(sg.maxAllo) > 0
      ) {
        allocationAmounts.value.set(
          sg.deployment.ipfsHash,
          String(Math.floor(sg.maxAllo)),
        )
      }
    }
  }

  /** Apply minimum allocation amounts based on signal/no-signal */
  function applyMinimums(subgraphs: SubgraphComputed[]): void {
    for (const sg of subgraphs) {
      if (!selectedDeployments.value.has(sg.deployment.ipfsHash)) continue
      const currentAmount = parseFloat(
        allocationAmounts.value.get(sg.deployment.ipfsHash) ?? '0',
      )
      const isDeniedOrNoSignal =
        sg.deployment.signalledTokens === '0' ||
        (sg.deployment.deniedAt !== null && sg.deployment.deniedAt > 0)

      if (isDeniedOrNoSignal) {
        if (currentAmount < minAllocation0Signal.value) {
          allocationAmounts.value.set(
            sg.deployment.ipfsHash,
            String(minAllocation0Signal.value),
          )
        }
      } else {
        if (currentAmount < minAllocation.value) {
          allocationAmounts.value.set(
            sg.deployment.ipfsHash,
            String(minAllocation.value),
          )
        }
      }
    }
  }

  /** Reset all allocation amounts to 0 */
  function resetAllos(): void {
    for (const key of allocationAmounts.value.keys()) {
      allocationAmounts.value.set(key, '0')
    }
  }

  /** Sum of all allocation amounts across all selected deployments (GRT) */
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

  /** Total GRT being allocated to new subgraphs */
  const openingStakeGrt = computed<number>(() => totalAllocated.value)

  // ---------------------------------------------------------------------------
  // Step 5: Build Actions
  // ---------------------------------------------------------------------------

  /**
   * Build ActionInput[] from the wizard state.
   *
   * Priority ordering (matches v3):
   *   - unallocate: priority 1
   *   - reallocate (decrease): priority 1
   *   - allocate (new): priority 2
   *   - reallocate (increase): priority 2
   *
   * Logic:
   *   1. For each closing allocation, check if the same deployment is also selected for new allocation.
   *      - If yes: it's a reallocate. Priority depends on whether amount is decreasing or increasing.
   *      - If no: it's an unallocate (priority 1).
   *   2. For each selected deployment NOT covered by a reallocate, it's a new allocate (priority 2).
   */
  function buildActions(chainId: string): ActionInput[] {
    const unallocateActions: ActionInput[] = []
    const reallocateDecreaseActions: ActionInput[] = []
    const allocateActions: ActionInput[] = []
    const reallocateIncreaseActions: ActionInput[] = []
    const reallocatedHashes = new Set<string>()

    // Process closing allocations
    for (const alloc of closingAllocations.value.values()) {
      const ipfsHash = alloc.subgraphDeployment.ipfsHash
      const poiData = buildPoiFields(ipfsHash)

      if (selectedDeployments.value.has(ipfsHash)) {
        // Reallocate: closing + reopening same deployment
        const newAmountGrt = parseFloat(
          allocationAmounts.value.get(ipfsHash) ?? '0',
        )
        const currentAmountGrt = weiToGrt(alloc.allocatedTokens)
        const isDecrease = currentAmountGrt > newAmountGrt

        const action: ActionInput = {
          status: 'queued',
          type: 'reallocate',
          deploymentID: ipfsHash,
          allocationID: alloc.id,
          amount: String(newAmountGrt),
          protocolNetwork: chainId,
          source: 'Indexer Tools - Agent Connect',
          reason: 'Allocation Wizard',
          priority: isDecrease ? 1 : 2,
          isLegacy: alloc.isLegacy,
          ...poiData,
        }

        if (isDecrease) {
          reallocateDecreaseActions.push(action)
        } else {
          reallocateIncreaseActions.push(action)
        }
        reallocatedHashes.add(ipfsHash)
      } else {
        // Pure unallocate
        const action: ActionInput = {
          status: 'queued',
          type: 'unallocate',
          deploymentID: ipfsHash,
          allocationID: alloc.id,
          amount: '0',
          protocolNetwork: chainId,
          source: 'Indexer Tools - Agent Connect',
          reason: 'Allocation Wizard',
          priority: 1,
          isLegacy: alloc.isLegacy,
          ...poiData,
        }
        unallocateActions.push(action)
      }
    }

    // Process new allocations (not covered by reallocate)
    for (const ipfsHash of selectedDeployments.value) {
      if (reallocatedHashes.has(ipfsHash)) continue
      const amount = allocationAmounts.value.get(ipfsHash)
      const amountGrt = parseFloat(amount ?? '0')
      if (amountGrt <= 0) continue

      allocateActions.push({
        status: 'queued',
        type: 'allocate',
        deploymentID: ipfsHash,
        amount: grtToWei(amountGrt),
        protocolNetwork: chainId,
        source: 'Indexer Tools - Agent Connect',
        reason: 'Allocation Wizard',
        priority: 2,
        isLegacy: false,
      })
    }

    return [
      ...unallocateActions,
      ...reallocateDecreaseActions,
      ...allocateActions,
      ...reallocateIncreaseActions,
    ]
  }

  /** Build POI fields for an action, handling "0x0" special case */
  function buildPoiFields(
    ipfsHash: string,
  ): Pick<ActionInput, 'poi' | 'publicPOI' | 'poiBlockNumber' | 'force'> {
    const poi = customPOIs.value.get(ipfsHash)
    if (!poi) return {}

    if (poi === '0x0') {
      return {
        poi: ZERO_POI,
        poiBlockNumber: 0,
        publicPOI: ZERO_POI,
        force: true,
      }
    }

    return {
      poi,
      poiBlockNumber: customBlockHeights.value.get(ipfsHash) ?? 0,
      publicPOI: customPublicPOIs.value.get(ipfsHash) ?? ZERO_POI,
      force: true,
    }
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  function clearAll(): void {
    closingAllocations.value.clear()
    customPOIs.value.clear()
    customBlockHeights.value.clear()
    customPublicPOIs.value.clear()
    selectedDeployments.value.clear()
    allocationAmounts.value.clear()
    minAllocation.value = 0
    minAllocation0Signal.value = 0
  }

  return {
    // Step 1
    closingAllocations,
    toggleClosingAllocation,
    setClosingAllocations,
    closingStakeWei,
    closingDeploymentHashes,
    // Step 2
    customPOIs,
    customBlockHeights,
    customPublicPOIs,
    setCustomPOI,
    clearCustomPOI,
    // Step 3
    selectedDeployments,
    toggleDeployment,
    // Step 4
    allocationAmounts,
    minAllocation,
    minAllocation0Signal,
    setAmount,
    setAllMaxAllos,
    applyMinimums,
    resetAllos,
    totalAllocated,
    openingStakeGrt,
    // Step 5
    buildActions,
    // General
    clearAll,
  }
})
