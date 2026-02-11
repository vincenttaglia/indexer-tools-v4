import { describe, it, expect } from 'vitest'
import {
  generateIndexingRuleCommands,
  generateActionQueueCommands,
  toClosingAllocations,
  toNewAllocations,
} from '@/services/export/cliCommands'
import type { AllocationRaw } from '@/types'

// Helper to build a minimal AllocationRaw for testing
function makeAlloc(
  id: string,
  ipfsHash: string,
  allocatedTokensGrt: number,
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
    isLegacy: false,
  }
}

describe('cliCommands', () => {
  describe('generateIndexingRuleCommands', () => {
    it('generates delete commands for closing allocations', () => {
      const result = generateIndexingRuleCommands({
        closingAllocations: [
          { allocationId: '0x1', ipfsHash: 'QmA', allocatedTokens: '1000', isLegacy: false },
        ],
        newAllocations: [],
        customPOIs: new Map(),
        customBlockHeights: new Map(),
        customPublicPOIs: new Map(),
        chainId: 'arbitrum-one',
      })

      expect(result).toBe(
        'graph indexer rules delete QmA --network arbitrum-one\n',
      )
    })

    it('generates set commands for new allocations', () => {
      const result = generateIndexingRuleCommands({
        closingAllocations: [],
        newAllocations: [
          { ipfsHash: 'QmB', amountGrt: 5000 },
          { ipfsHash: 'QmC', amountGrt: 10000 },
        ],
        customPOIs: new Map(),
        customBlockHeights: new Map(),
        customPublicPOIs: new Map(),
        chainId: 'arbitrum-one',
      })

      expect(result).toContain(
        'graph indexer rules set QmB allocationAmount 5000 decisionBasis always --network arbitrum-one',
      )
      expect(result).toContain(
        'graph indexer rules set QmC allocationAmount 10000 decisionBasis always --network arbitrum-one',
      )
    })

    it('skips new allocations with amount 0', () => {
      const result = generateIndexingRuleCommands({
        closingAllocations: [],
        newAllocations: [{ ipfsHash: 'QmD', amountGrt: 0 }],
        customPOIs: new Map(),
        customBlockHeights: new Map(),
        customPublicPOIs: new Map(),
        chainId: 'arbitrum-one',
      })

      expect(result).toBe('')
    })
  })

  describe('generateActionQueueCommands', () => {
    it('generates unallocate commands for pure closings', () => {
      const result = generateActionQueueCommands({
        closingAllocations: [
          { allocationId: '0xAlloc1', ipfsHash: 'QmClose', allocatedTokens: String(5000 * 1e18), isLegacy: false },
        ],
        newAllocations: [],
        customPOIs: new Map(),
        customBlockHeights: new Map(),
        customPublicPOIs: new Map(),
        chainId: 'arbitrum-one',
      })

      expect(result).toContain(
        'graph indexer actions queue unallocate QmClose 0xAlloc1 --network arbitrum-one',
      )
    })

    it('generates allocate commands for pure new allocations', () => {
      const result = generateActionQueueCommands({
        closingAllocations: [],
        newAllocations: [{ ipfsHash: 'QmNew', amountGrt: 8000 }],
        customPOIs: new Map(),
        customBlockHeights: new Map(),
        customPublicPOIs: new Map(),
        chainId: 'arbitrum-one',
      })

      expect(result).toContain(
        'graph indexer actions queue allocate QmNew 8000 --network arbitrum-one',
      )
    })

    it('generates reallocate commands when closing and reopening same deployment', () => {
      const result = generateActionQueueCommands({
        closingAllocations: [
          { allocationId: '0xAlloc2', ipfsHash: 'QmSame', allocatedTokens: String(10000 * 1e18), isLegacy: false },
        ],
        newAllocations: [{ ipfsHash: 'QmSame', amountGrt: 5000 }],
        customPOIs: new Map(),
        customBlockHeights: new Map(),
        customPublicPOIs: new Map(),
        chainId: 'arbitrum-one',
      })

      // Should be a decrease reallocate since 10000 > 5000
      expect(result).toContain(
        'graph indexer actions queue reallocate QmSame 0xAlloc2 5000 --network arbitrum-one',
      )
      // Should NOT contain an allocate for QmSame
      expect(result).not.toContain('graph indexer actions queue allocate QmSame')
    })

    it('includes custom POI in commands', () => {
      const customPOIs = new Map([['QmPOI', '0xabc123']])
      const customBlockHeights = new Map([['QmPOI', 42]])
      const customPublicPOIs = new Map([['QmPOI', '0xdef456']])

      const result = generateActionQueueCommands({
        closingAllocations: [
          { allocationId: '0xA3', ipfsHash: 'QmPOI', allocatedTokens: String(1000 * 1e18), isLegacy: false },
        ],
        newAllocations: [],
        customPOIs,
        customBlockHeights,
        customPublicPOIs,
        chainId: 'arbitrum-one',
      })

      expect(result).toContain('0xabc123 true 42 0xdef456')
    })

    it('handles 0x0 POI special case', () => {
      const customPOIs = new Map([['QmZero', '0x0']])

      const result = generateActionQueueCommands({
        closingAllocations: [
          { allocationId: '0xA4', ipfsHash: 'QmZero', allocatedTokens: String(1000 * 1e18), isLegacy: false },
        ],
        newAllocations: [],
        customPOIs,
        customBlockHeights: new Map(),
        customPublicPOIs: new Map(),
        chainId: 'arbitrum-one',
      })

      const zeroPoi = '0x0000000000000000000000000000000000000000000000000000000000000000'
      expect(result).toContain(`${zeroPoi} true 0 ${zeroPoi}`)
    })

    it('orders commands: unallocate, reallocate-decrease, allocate, reallocate-increase', () => {
      const result = generateActionQueueCommands({
        closingAllocations: [
          // Pure close
          { allocationId: '0xClose', ipfsHash: 'QmClose', allocatedTokens: String(5000 * 1e18), isLegacy: false },
          // Reallocate decrease (10000 → 3000)
          { allocationId: '0xDecrease', ipfsHash: 'QmDecrease', allocatedTokens: String(10000 * 1e18), isLegacy: false },
          // Reallocate increase (1000 → 5000)
          { allocationId: '0xIncrease', ipfsHash: 'QmIncrease', allocatedTokens: String(1000 * 1e18), isLegacy: false },
        ],
        newAllocations: [
          { ipfsHash: 'QmDecrease', amountGrt: 3000 },
          { ipfsHash: 'QmIncrease', amountGrt: 5000 },
          { ipfsHash: 'QmNew', amountGrt: 2000 },
        ],
        customPOIs: new Map(),
        customBlockHeights: new Map(),
        customPublicPOIs: new Map(),
        chainId: 'arbitrum-one',
      })

      const lines = result.trim().split('\n')
      expect(lines).toHaveLength(4)

      // Order: unallocate, reallocate-decrease, allocate, reallocate-increase
      expect(lines[0]).toContain('unallocate QmClose')
      expect(lines[1]).toContain('reallocate QmDecrease')
      expect(lines[2]).toContain('allocate QmNew')
      expect(lines[3]).toContain('reallocate QmIncrease')
    })
  })

  describe('toClosingAllocations', () => {
    it('extracts closing allocation data from a Map', () => {
      const alloc = makeAlloc('0xABC', 'QmTest', 5000)
      const map = new Map([['0xABC', alloc]])

      const result = toClosingAllocations(map)
      expect(result).toHaveLength(1)
      expect(result[0].allocationId).toBe('0xABC')
      expect(result[0].ipfsHash).toBe('QmTest')
      expect(result[0].allocatedTokens).toBe(String(5000 * 1e18))
    })
  })

  describe('toNewAllocations', () => {
    it('extracts new allocation data from wizard state', () => {
      const selected = new Set(['QmA', 'QmB'])
      const amounts = new Map([
        ['QmA', '5000'],
        ['QmB', '10000'],
      ])

      const result = toNewAllocations(selected, amounts)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ ipfsHash: 'QmA', amountGrt: 5000 })
      expect(result[1]).toEqual({ ipfsHash: 'QmB', amountGrt: 10000 })
    })

    it('returns 0 for missing amounts', () => {
      const selected = new Set(['QmC'])
      const amounts = new Map<string, string>()

      const result = toNewAllocations(selected, amounts)
      expect(result[0].amountGrt).toBe(0)
    })
  })
})
