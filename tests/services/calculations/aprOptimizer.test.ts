import { describe, it, expect } from 'vitest'
import { optimizeAllocations } from '@/services/calculations/aprOptimizer'
import type { OptimizableSubgraph, OptimizationParams } from '@/services/calculations/aprOptimizer'

/**
 * Realistic test values inspired by The Graph network on Arbitrum.
 */
const TOTAL_TOKENS_SIGNALLED = '1600000000000000000000000000' // 1.6B GRT
const ISSUANCE_PER_BLOCK = '6700000000000000000' // 6.7 GRT
const BLOCKS_PER_DAY_ARBITRUM = 5760
const INDEXING_REWARD_CUT = 900000 // 90%

/** Helper to build a standard OptimizableSubgraph */
function makeSg(
  ipfsHash: string,
  signalledTokensGrt: number,
  stakedTokensGrt: number,
  displayName?: string,
): OptimizableSubgraph {
  return {
    ipfsHash,
    signalledTokens: String(signalledTokensGrt * 1e18),
    stakedTokens: String(stakedTokensGrt * 1e18),
    displayName: displayName ?? ipfsHash,
  }
}

/** Helper to build standard optimization params */
function makeParams(
  subgraphs: OptimizableSubgraph[],
  totalBudgetGrt: number,
  minAllocationGrt?: number,
): OptimizationParams {
  return {
    subgraphs,
    totalBudgetGrt,
    totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
    networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
    blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
    indexingRewardCut: INDEXING_REWARD_CUT,
    minAllocationGrt,
  }
}

describe('aprOptimizer', () => {
  describe('optimizeAllocations', () => {
    it('returns empty result for empty subgraphs', () => {
      const result = optimizeAllocations(makeParams([], 100000))

      expect(result.allocations.size).toBe(0)
      expect(result.totalDailyRewardsCut).toBe(0)
      expect(result.perSubgraph).toHaveLength(0)
    })

    it('returns empty result for zero budget', () => {
      const subgraphs = [makeSg('Qm1', 50_000_000, 5_000_000)]
      const result = optimizeAllocations(makeParams(subgraphs, 0))

      expect(result.allocations.size).toBe(0)
      expect(result.totalDailyRewardsCut).toBe(0)
      expect(result.perSubgraph).toHaveLength(0)
    })

    it('gives single subgraph the full budget', () => {
      const subgraphs = [makeSg('Qm1', 50_000_000, 5_000_000, 'Subgraph A')]
      const result = optimizeAllocations(makeParams(subgraphs, 100000))

      expect(result.allocations.size).toBe(1)
      expect(result.allocations.get('Qm1')).toBe(100000)
      expect(result.perSubgraph).toHaveLength(1)
      expect(result.perSubgraph[0].allocationGrt).toBe(100000)
      expect(result.perSubgraph[0].displayName).toBe('Subgraph A')
      expect(result.perSubgraph[0].apr).toBeGreaterThan(0)
      expect(result.perSubgraph[0].dailyRewardsCut).toBeGreaterThan(0)
      expect(result.totalDailyRewardsCut).toBeGreaterThan(0)
    })

    it('allocates more to higher-signal subgraph (two subgraphs)', () => {
      // Subgraph A: high signal (100M), moderate stake (5M) -> high marginal
      // Subgraph B: low signal (10M), moderate stake (5M) -> low marginal
      const subgraphs = [
        makeSg('QmHigh', 100_000_000, 5_000_000, 'High Signal'),
        makeSg('QmLow', 10_000_000, 5_000_000, 'Low Signal'),
      ]

      const result = optimizeAllocations(makeParams(subgraphs, 200000))

      const highAlloc = result.allocations.get('QmHigh')!
      const lowAlloc = result.allocations.get('QmLow')!

      // Higher-signal subgraph should receive more allocation
      expect(highAlloc).toBeGreaterThan(lowAlloc)
      // Both should be present
      expect(result.perSubgraph).toHaveLength(2)
    })

    it('respects minimum allocation constraint', () => {
      const subgraphs = [
        makeSg('QmHigh', 100_000_000, 5_000_000),
        makeSg('QmLow', 10_000_000, 5_000_000),
      ]
      const minAllocationGrt = 10000

      const result = optimizeAllocations(makeParams(subgraphs, 200000, minAllocationGrt))

      // Both subgraphs should have at least the minimum
      for (const entry of result.perSubgraph) {
        expect(entry.allocationGrt).toBeGreaterThanOrEqual(minAllocationGrt)
      }
    })

    it('allocations sum to total budget within rounding tolerance', () => {
      const subgraphs = [
        makeSg('Qm1', 50_000_000, 5_000_000),
        makeSg('Qm2', 30_000_000, 3_000_000),
        makeSg('Qm3', 10_000_000, 8_000_000),
      ]
      const totalBudget = 500000

      const result = optimizeAllocations(makeParams(subgraphs, totalBudget))

      const sum = result.perSubgraph.reduce((acc, e) => acc + e.allocationGrt, 0)
      // Allow tiny floating-point tolerance
      expect(Math.abs(sum - totalBudget)).toBeLessThan(1)
    })

    it('produces positive daily rewards for all subgraphs with signal', () => {
      const subgraphs = [
        makeSg('Qm1', 50_000_000, 5_000_000),
        makeSg('Qm2', 20_000_000, 2_000_000),
      ]

      const result = optimizeAllocations(makeParams(subgraphs, 100000))

      for (const entry of result.perSubgraph) {
        // Any subgraph with signal and a nonzero allocation should earn rewards
        if (entry.allocationGrt > 0) {
          expect(entry.dailyRewardsCut).toBeGreaterThan(0)
          expect(entry.apr).toBeGreaterThan(0)
        }
      }
      expect(result.totalDailyRewardsCut).toBeGreaterThan(0)
    })

    it('optimized result yields at least as much as equal distribution', () => {
      const subgraphs = [
        makeSg('QmHigh', 100_000_000, 1_000_000),
        makeSg('QmLow', 5_000_000, 10_000_000),
      ]
      const totalBudget = 200000

      // Optimized
      const optimized = optimizeAllocations(makeParams(subgraphs, totalBudget))

      // Equal distribution (simulate by giving a huge minimum that forces equal split)
      const equalParams = makeParams(subgraphs, totalBudget)
      const equalResult = optimizeAllocations({
        ...equalParams,
        minAllocationGrt: totalBudget / subgraphs.length,
      })

      // Optimized should produce >= equal distribution rewards
      expect(optimized.totalDailyRewardsCut).toBeGreaterThanOrEqual(
        equalResult.totalDailyRewardsCut,
      )
    })
  })
})
