import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWizardStore } from '@/stores/wizardStore'
import type { AllocationRaw, SubgraphComputed } from '@/types'

// Helper to build a minimal AllocationRaw
function makeAlloc(
  id: string,
  ipfsHash: string,
  allocatedTokensGrt: number,
  isLegacy = false,
): AllocationRaw {
  return {
    id,
    activeForIndexer: { id: '0xindexer' },
    subgraphDeployment: {
      ipfsHash,
      createdAt: 0,
      originalName: null,
      stakedTokens: '0',
      indexingRewardAmount: '0',
      signalledTokens: '0',
      queryFeesAmount: '0',
      deniedAt: null,
      manifest: { network: null },
      versions: [],
    },
    allocatedTokens: String(allocatedTokensGrt * 1e18),
    effectiveAllocation: '0',
    createdAt: 1700000000,
    createdAtEpoch: 100,
    createdAtBlockHash: '0xabc',
    createdAtBlockNumber: 50000,
    indexingRewards: '0',
    indexingIndexerRewards: '0',
    indexingDelegatorRewards: '0',
    isLegacy,
  }
}

// Helper to build a minimal SubgraphComputed
function makeSubgraph(
  ipfsHash: string,
  overrides?: {
    signalledTokens?: string
    deniedAt?: number | null
    maxAllo?: number
  },
): SubgraphComputed {
  return {
    id: `sg-${ipfsHash}`,
    deployment: {
      id: `dep-${ipfsHash}`,
      deniedAt: overrides?.deniedAt ?? null,
      createdAt: 0,
      indexingRewardAmount: '0',
      ipfsHash,
      queryFeesAmount: '0',
      signalledTokens: overrides?.signalledTokens ?? '1000000000000000000000',
      stakedTokens: '2000000000000000000000',
      manifest: { network: 'mainnet', poweredBySubstreams: false },
      versions: [],
    },
    apr: 10,
    newApr: 8,
    dailyRewards: 100,
    dailyRewardsCut: 80,
    maxAllo: overrides?.maxAllo ?? 5000,
    proportion: 1.2,
    currentlyAllocated: false,
    deploymentStatus: null,
    entityCount: null,
    queryFees: null,
  }
}

describe('wizardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Step 1: closingAllocations', () => {
    it('toggles closing allocations on and off', () => {
      const store = useWizardStore()
      const alloc = makeAlloc('0x1', 'QmA', 5000)

      store.toggleClosingAllocation(alloc)
      expect(store.closingAllocations.size).toBe(1)
      expect(store.closingAllocations.has('0x1')).toBe(true)

      store.toggleClosingAllocation(alloc)
      expect(store.closingAllocations.size).toBe(0)
    })

    it('computes closingStakeWei', () => {
      const store = useWizardStore()
      store.toggleClosingAllocation(makeAlloc('0x1', 'QmA', 3000))
      store.toggleClosingAllocation(makeAlloc('0x2', 'QmB', 7000))

      expect(store.closingStakeWei).toBe(10000 * 1e18)
    })

    it('computes closingDeploymentHashes', () => {
      const store = useWizardStore()
      store.toggleClosingAllocation(makeAlloc('0x1', 'QmA', 1000))
      store.toggleClosingAllocation(makeAlloc('0x2', 'QmB', 2000))

      expect(store.closingDeploymentHashes.has('QmA')).toBe(true)
      expect(store.closingDeploymentHashes.has('QmB')).toBe(true)
      expect(store.closingDeploymentHashes.size).toBe(2)
    })
  })

  describe('Step 2: customPOIs', () => {
    it('sets and clears custom POI data', () => {
      const store = useWizardStore()

      store.setCustomPOI('QmA', '0xpoi123', 42, '0xpub456')
      expect(store.customPOIs.get('QmA')).toBe('0xpoi123')
      expect(store.customBlockHeights.get('QmA')).toBe(42)
      expect(store.customPublicPOIs.get('QmA')).toBe('0xpub456')

      store.clearCustomPOI('QmA')
      expect(store.customPOIs.has('QmA')).toBe(false)
      expect(store.customBlockHeights.has('QmA')).toBe(false)
      expect(store.customPublicPOIs.has('QmA')).toBe(false)
    })
  })

  describe('Step 3: selectedDeployments', () => {
    it('toggles deployments and clears amounts on deselect', () => {
      const store = useWizardStore()

      store.toggleDeployment('QmA')
      expect(store.selectedDeployments.has('QmA')).toBe(true)

      store.setAmount('QmA', '5000')
      expect(store.allocationAmounts.get('QmA')).toBe('5000')

      store.toggleDeployment('QmA')
      expect(store.selectedDeployments.has('QmA')).toBe(false)
      expect(store.allocationAmounts.has('QmA')).toBe(false)
    })
  })

  describe('Step 4: allocationAmounts', () => {
    it('computes totalAllocated from amounts', () => {
      const store = useWizardStore()
      store.setAmount('QmA', '3000')
      store.setAmount('QmB', '7000')

      expect(store.totalAllocated).toBe(10000)
    })

    it('ignores NaN amounts in totalAllocated', () => {
      const store = useWizardStore()
      store.setAmount('QmA', '5000')
      store.setAmount('QmB', 'invalid')

      expect(store.totalAllocated).toBe(5000)
    })

    it('setAllMaxAllos sets amounts to floor(maxAllo)', () => {
      const store = useWizardStore()
      store.toggleDeployment('QmA')
      store.toggleDeployment('QmB')

      const subgraphs = [
        makeSubgraph('QmA', { maxAllo: 5432.9 }),
        makeSubgraph('QmB', { maxAllo: 1234.1 }),
      ]

      store.setAllMaxAllos(subgraphs)

      expect(store.allocationAmounts.get('QmA')).toBe('5432')
      expect(store.allocationAmounts.get('QmB')).toBe('1234')
    })

    it('setAllMaxAllos skips subgraphs with invalid maxAllo', () => {
      const store = useWizardStore()
      store.toggleDeployment('QmA')
      store.toggleDeployment('QmB')

      const subgraphs = [
        makeSubgraph('QmA', { maxAllo: Number.MIN_SAFE_INTEGER }),
        makeSubgraph('QmB', { maxAllo: -100 }),
      ]

      store.setAllMaxAllos(subgraphs)

      expect(store.allocationAmounts.has('QmA')).toBe(false)
      expect(store.allocationAmounts.has('QmB')).toBe(false)
    })

    it('applyMinimums enforces minimum for signal subgraphs', () => {
      const store = useWizardStore()
      store.toggleDeployment('QmSignal')
      store.toggleDeployment('QmNoSignal')
      store.setAmount('QmSignal', '100')
      store.setAmount('QmNoSignal', '50')
      store.minAllocation = 500
      store.minAllocation0Signal = 200

      const subgraphs = [
        makeSubgraph('QmSignal', { signalledTokens: '1000000000000000000000' }),
        makeSubgraph('QmNoSignal', { signalledTokens: '0' }),
      ]

      store.applyMinimums(subgraphs)

      expect(store.allocationAmounts.get('QmSignal')).toBe('500')
      expect(store.allocationAmounts.get('QmNoSignal')).toBe('200')
    })

    it('applyMinimums does not lower existing amounts', () => {
      const store = useWizardStore()
      store.toggleDeployment('QmA')
      store.setAmount('QmA', '10000')
      store.minAllocation = 500

      const subgraphs = [makeSubgraph('QmA')]
      store.applyMinimums(subgraphs)

      expect(store.allocationAmounts.get('QmA')).toBe('10000')
    })

    it('resetAllos sets all amounts to 0', () => {
      const store = useWizardStore()
      store.setAmount('QmA', '5000')
      store.setAmount('QmB', '3000')

      store.resetAllos()

      expect(store.allocationAmounts.get('QmA')).toBe('0')
      expect(store.allocationAmounts.get('QmB')).toBe('0')
    })
  })

  describe('Step 5: buildActions', () => {
    it('generates unallocate actions for pure closings', () => {
      const store = useWizardStore()
      store.toggleClosingAllocation(makeAlloc('0x1', 'QmClose', 5000))

      const actions = store.buildActions('arbitrum-one')

      expect(actions).toHaveLength(1)
      expect(actions[0].type).toBe('unallocate')
      expect(actions[0].deploymentID).toBe('QmClose')
      expect(actions[0].allocationID).toBe('0x1')
      expect(actions[0].priority).toBe(1)
    })

    it('generates allocate actions for new deployments', () => {
      const store = useWizardStore()
      store.toggleDeployment('QmNew')
      store.setAmount('QmNew', '8000')

      const actions = store.buildActions('arbitrum-one')

      expect(actions).toHaveLength(1)
      expect(actions[0].type).toBe('allocate')
      expect(actions[0].deploymentID).toBe('QmNew')
      expect(actions[0].priority).toBe(2)
    })

    it('generates reallocate-decrease (priority 1) when current > new', () => {
      const store = useWizardStore()
      // Closing allocation of 10000 GRT
      store.toggleClosingAllocation(makeAlloc('0x1', 'QmSame', 10000))
      // Re-opening with 3000 GRT
      store.toggleDeployment('QmSame')
      store.setAmount('QmSame', '3000')

      const actions = store.buildActions('arbitrum-one')

      expect(actions).toHaveLength(1)
      expect(actions[0].type).toBe('reallocate')
      expect(actions[0].priority).toBe(1) // decrease = P1
      expect(actions[0].amount).toBe('3000')
    })

    it('generates reallocate-increase (priority 2) when current < new', () => {
      const store = useWizardStore()
      // Closing allocation of 1000 GRT
      store.toggleClosingAllocation(makeAlloc('0x1', 'QmSame', 1000))
      // Re-opening with 5000 GRT
      store.toggleDeployment('QmSame')
      store.setAmount('QmSame', '5000')

      const actions = store.buildActions('arbitrum-one')

      expect(actions).toHaveLength(1)
      expect(actions[0].type).toBe('reallocate')
      expect(actions[0].priority).toBe(2) // increase = P2
    })

    it('orders actions: unallocate, reallocate-decrease, allocate, reallocate-increase', () => {
      const store = useWizardStore()

      // Pure close
      store.toggleClosingAllocation(makeAlloc('0xClose', 'QmClose', 5000))
      // Reallocate decrease (10000 → 3000)
      store.toggleClosingAllocation(makeAlloc('0xDec', 'QmDec', 10000))
      // Reallocate increase (1000 → 5000)
      store.toggleClosingAllocation(makeAlloc('0xInc', 'QmInc', 1000))

      store.toggleDeployment('QmDec')
      store.setAmount('QmDec', '3000')
      store.toggleDeployment('QmInc')
      store.setAmount('QmInc', '5000')
      store.toggleDeployment('QmNew')
      store.setAmount('QmNew', '2000')

      const actions = store.buildActions('arbitrum-one')

      expect(actions).toHaveLength(4)
      expect(actions[0].type).toBe('unallocate')
      expect(actions[0].deploymentID).toBe('QmClose')
      expect(actions[1].type).toBe('reallocate')
      expect(actions[1].deploymentID).toBe('QmDec')
      expect(actions[1].priority).toBe(1) // decrease
      expect(actions[2].type).toBe('allocate')
      expect(actions[2].deploymentID).toBe('QmNew')
      expect(actions[3].type).toBe('reallocate')
      expect(actions[3].deploymentID).toBe('QmInc')
      expect(actions[3].priority).toBe(2) // increase
    })

    it('includes custom POI data in actions', () => {
      const store = useWizardStore()
      store.toggleClosingAllocation(makeAlloc('0x1', 'QmPOI', 5000))
      store.setCustomPOI('QmPOI', '0xmypoi', 42, '0xmypubpoi')

      const actions = store.buildActions('arbitrum-one')

      expect(actions[0].poi).toBe('0xmypoi')
      expect(actions[0].poiBlockNumber).toBe(42)
      expect(actions[0].publicPOI).toBe('0xmypubpoi')
      expect(actions[0].force).toBe(true)
    })

    it('handles 0x0 POI special case in actions', () => {
      const store = useWizardStore()
      store.toggleClosingAllocation(makeAlloc('0x1', 'QmZero', 5000))
      store.setCustomPOI('QmZero', '0x0', 0, '')

      const actions = store.buildActions('arbitrum-one')

      const zeroPoi = '0x0000000000000000000000000000000000000000000000000000000000000000'
      expect(actions[0].poi).toBe(zeroPoi)
      expect(actions[0].poiBlockNumber).toBe(0)
      expect(actions[0].publicPOI).toBe(zeroPoi)
    })

    it('skips new allocations with 0 amount', () => {
      const store = useWizardStore()
      store.toggleDeployment('QmZero')
      store.setAmount('QmZero', '0')

      const actions = store.buildActions('arbitrum-one')
      expect(actions).toHaveLength(0)
    })
  })

  describe('clearAll', () => {
    it('resets all wizard state', () => {
      const store = useWizardStore()
      store.toggleClosingAllocation(makeAlloc('0x1', 'QmA', 5000))
      store.setCustomPOI('QmA', '0xpoi', 1, '0xpub')
      store.toggleDeployment('QmB')
      store.setAmount('QmB', '3000')
      store.minAllocation = 500
      store.minAllocation0Signal = 100

      store.clearAll()

      expect(store.closingAllocations.size).toBe(0)
      expect(store.customPOIs.size).toBe(0)
      expect(store.customBlockHeights.size).toBe(0)
      expect(store.customPublicPOIs.size).toBe(0)
      expect(store.selectedDeployments.size).toBe(0)
      expect(store.allocationAmounts.size).toBe(0)
      expect(store.minAllocation).toBe(0)
      expect(store.minAllocation0Signal).toBe(0)
    })
  })
})
