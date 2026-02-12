import { describe, it, expect } from 'vitest'
import { optimizeAllocations } from '@/services/calculations/aprOptimizer'
import type { OptimizableSubgraph, OptimizationParams } from '@/services/calculations/aprOptimizer'
import { calculateSubgraphDailyRewards, calculateDailyRewardsCut } from '@/services/calculations/rewards'

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

/** Helper to compute total daily rewards for an equal-distribution scenario */
function equalDistributionRewards(
  subgraphs: OptimizableSubgraph[],
  totalBudgetGrt: number,
): number {
  const perSubgraph = totalBudgetGrt / subgraphs.length
  let total = 0
  for (const sg of subgraphs) {
    const dailyRewards = calculateSubgraphDailyRewards({
      signalledTokens: sg.signalledTokens,
      stakedTokens: sg.stakedTokens,
      totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
      networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
      blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      newAllocation: String(Math.round(perSubgraph)),
    })
    total += calculateDailyRewardsCut(dailyRewards, INDEXING_REWARD_CUT)
  }
  return total
}

describe('aprOptimizer', () => {
  describe('optimizeAllocations', () => {
    // ---------------------------------------------------------------
    // 1. Empty subgraphs -> empty result
    // ---------------------------------------------------------------
    it('returns empty result for empty subgraphs', () => {
      const result = optimizeAllocations(makeParams([], 100000))

      expect(result.allocations.size).toBe(0)
      expect(result.totalDailyRewardsCut).toBe(0)
      expect(result.perSubgraph).toHaveLength(0)
    })

    // ---------------------------------------------------------------
    // 2. Zero budget -> empty result
    // ---------------------------------------------------------------
    it('returns empty result for zero budget', () => {
      const subgraphs = [makeSg('Qm1', 50_000_000, 5_000_000)]
      const result = optimizeAllocations(makeParams(subgraphs, 0))

      expect(result.allocations.size).toBe(0)
      expect(result.totalDailyRewardsCut).toBe(0)
      expect(result.perSubgraph).toHaveLength(0)
    })

    // ---------------------------------------------------------------
    // 3. Single subgraph -> gets full budget
    // ---------------------------------------------------------------
    it('gives single subgraph the full budget', () => {
      const subgraphs = [makeSg('Qm1', 50_000_000, 5_000_000, 'Subgraph A')]
      const result = optimizeAllocations(makeParams(subgraphs, 100000))

      expect(result.allocations.size).toBe(1)
      expect(result.perSubgraph).toHaveLength(1)
      expect(result.perSubgraph[0].allocationGrt).toBe(100000)
      expect(result.perSubgraph[0].displayName).toBe('Subgraph A')
      expect(result.perSubgraph[0].apr).toBeGreaterThan(0)
      expect(result.perSubgraph[0].dailyRewardsCut).toBeGreaterThan(0)
      expect(result.totalDailyRewardsCut).toBeGreaterThan(0)
    })

    // ---------------------------------------------------------------
    // 4. Two equal subgraphs -> equal allocations (within 1 GRT)
    // ---------------------------------------------------------------
    it('gives equal allocations to two identical subgraphs', () => {
      const subgraphs = [
        makeSg('QmA', 50_000_000, 5_000_000, 'Equal A'),
        makeSg('QmB', 50_000_000, 5_000_000, 'Equal B'),
      ]

      const result = optimizeAllocations(makeParams(subgraphs, 200000))

      const allocA = result.perSubgraph.find((s) => s.ipfsHash === 'QmA')!.allocationGrt
      const allocB = result.perSubgraph.find((s) => s.ipfsHash === 'QmB')!.allocationGrt

      // Should be equal within 1 GRT (rounding)
      expect(Math.abs(allocA - allocB)).toBeLessThanOrEqual(1)
      // Each should be approximately half the budget
      expect(allocA).toBeCloseTo(100000, -1)
      expect(allocB).toBeCloseTo(100000, -1)
    })

    // ---------------------------------------------------------------
    // 5. Two subgraphs with 10x signal difference -> meaningful split
    // ---------------------------------------------------------------
    it('allocates significantly more to higher-signal subgraph (10x difference)', () => {
      // Same stake, but 10x signal difference
      const subgraphs = [
        makeSg('QmHigh', 100_000_000, 5_000_000, 'High Signal'),
        makeSg('QmLow', 10_000_000, 5_000_000, 'Low Signal'),
      ]

      const result = optimizeAllocations(makeParams(subgraphs, 200000))

      const highAlloc = result.allocations.get('QmHigh')!
      const lowAlloc = result.allocations.get('QmLow')!

      // Higher-signal subgraph should receive substantially more
      expect(highAlloc).toBeGreaterThan(lowAlloc)

      // The ratio should be meaningful, NOT near 50/50.
      // With sqrt(signal * stake), ratio ~ sqrt(10) ~ 3.16x before stake offset.
      // The high-signal subgraph should get at least 60% of the budget.
      const highFraction = highAlloc / (highAlloc + lowAlloc)
      expect(highFraction).toBeGreaterThan(0.6)
    })

    // ---------------------------------------------------------------
    // 6. Budget sums correctly (within 1 GRT per subgraph tolerance)
    // ---------------------------------------------------------------
    it('allocations sum to total budget within rounding tolerance', () => {
      const subgraphs = [
        makeSg('Qm1', 50_000_000, 5_000_000),
        makeSg('Qm2', 30_000_000, 3_000_000),
        makeSg('Qm3', 10_000_000, 8_000_000),
      ]
      const totalBudget = 500000

      const result = optimizeAllocations(makeParams(subgraphs, totalBudget))

      const sum = result.perSubgraph.reduce((acc, e) => acc + e.allocationGrt, 0)
      // Allow 1 GRT rounding tolerance per subgraph
      expect(Math.abs(sum - totalBudget)).toBeLessThanOrEqual(subgraphs.length)
    })

    // ---------------------------------------------------------------
    // 7. Over-saturated subgraph gets 0 or minimum allocation
    // ---------------------------------------------------------------
    it('excludes over-saturated subgraph (very high stake, low signal)', () => {
      // Subgraph A: high signal, low stake = very attractive
      // Subgraph B: low signal, very high stake = over-saturated
      const subgraphs = [
        makeSg('QmGood', 100_000_000, 1_000_000, 'Attractive'),
        makeSg('QmSaturated', 1_000_000, 500_000_000, 'Over-saturated'),
      ]

      const result = optimizeAllocations(makeParams(subgraphs, 100000))

      const goodAlloc = result.allocations.get('QmGood')!
      const satAlloc = result.allocations.get('QmSaturated')!

      // The over-saturated subgraph should get 0 or close to 0
      expect(satAlloc).toBeLessThanOrEqual(1)
      // The attractive subgraph should get almost all the budget
      expect(goodAlloc).toBeGreaterThan(99000)
    })

    // ---------------------------------------------------------------
    // 8. Zero-signal subgraphs get 0 allocation
    // ---------------------------------------------------------------
    it('gives 0 allocation to zero-signal subgraphs', () => {
      const subgraphs = [
        makeSg('QmSignal', 50_000_000, 5_000_000, 'Has Signal'),
        makeSg('QmNoSignal', 0, 5_000_000, 'No Signal'),
      ]

      const result = optimizeAllocations(makeParams(subgraphs, 100000))

      // Zero-signal subgraph should be excluded entirely (filtered out)
      const noSignal = result.perSubgraph.find((s) => s.ipfsHash === 'QmNoSignal')
      expect(noSignal).toBeUndefined()

      // The signalled subgraph gets everything
      const signalled = result.perSubgraph.find((s) => s.ipfsHash === 'QmSignal')!
      expect(signalled.allocationGrt).toBe(100000)
    })

    // ---------------------------------------------------------------
    // 9. Optimality check: optimized >= equal distribution
    // ---------------------------------------------------------------
    it('optimized result yields at least as much as equal distribution', () => {
      const subgraphs = [
        makeSg('QmHigh', 100_000_000, 1_000_000),
        makeSg('QmMed', 30_000_000, 5_000_000),
        makeSg('QmLow', 5_000_000, 10_000_000),
      ]
      const totalBudget = 300000

      const optimized = optimizeAllocations(makeParams(subgraphs, totalBudget))
      const equalRewards = equalDistributionRewards(subgraphs, totalBudget)

      // Optimized rewards should be >= equal distribution
      expect(optimized.totalDailyRewardsCut).toBeGreaterThanOrEqual(equalRewards)
    })

    // ---------------------------------------------------------------
    // 10. Three subgraphs: proportional to sqrt(signal * stake)
    // ---------------------------------------------------------------
    it('allocations follow sqrt(signal * stake) pattern for three subgraphs', () => {
      // Use large budget relative to existing stakes so all subgraphs
      // receive positive allocations in the closed-form solution.
      // Small stakes ensure the budget dominates the formula.
      const subgraphs = [
        makeSg('QmA', 80_000_000, 100_000, 'A'), // sqrt(80M * 100K) = sqrt(8e12)    ~ 2828427
        makeSg('QmB', 20_000_000, 100_000, 'B'), // sqrt(20M * 100K) = sqrt(2e12)    ~ 1414214
        makeSg('QmC', 45_000_000, 100_000, 'C'), // sqrt(45M * 100K) = sqrt(4.5e12)  ~ 2121320
      ]
      // sumSqrt ~ 6363961, sumStake = 300K, budget = 3M
      // scale = (3M + 300K) / 6363961 = 3300000 / 6363961 ~ 0.5186
      // allocA ~ 2828427*0.5186 - 100K ~ 1367K
      // allocB ~ 1414214*0.5186 - 100K ~ 633K
      // allocC ~ 2121320*0.5186 - 100K ~ 1000K

      const result = optimizeAllocations(makeParams(subgraphs, 3_000_000))

      const allocA = result.allocations.get('QmA')!
      const allocB = result.allocations.get('QmB')!
      const allocC = result.allocations.get('QmC')!

      // With equal stakes, the ordering is purely by signal: A > C > B
      expect(allocA).toBeGreaterThan(allocC)
      expect(allocC).toBeGreaterThan(allocB)

      // All should be positive
      expect(allocA).toBeGreaterThan(0)
      expect(allocB).toBeGreaterThan(0)
      expect(allocC).toBeGreaterThan(0)

      // Budget should sum correctly
      const sum = allocA + allocB + allocC
      expect(Math.abs(sum - 3_000_000)).toBeLessThan(3) // 1 GRT per subgraph tolerance
    })

    // ---------------------------------------------------------------
    // Additional: respects minimum allocation constraint
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Additional: produces positive daily rewards for all subgraphs with signal
    // ---------------------------------------------------------------
    it('produces positive daily rewards for all subgraphs with signal', () => {
      const subgraphs = [
        makeSg('Qm1', 50_000_000, 5_000_000),
        makeSg('Qm2', 20_000_000, 2_000_000),
      ]

      const result = optimizeAllocations(makeParams(subgraphs, 100000))

      for (const entry of result.perSubgraph) {
        if (entry.allocationGrt > 0) {
          expect(entry.dailyRewardsCut).toBeGreaterThan(0)
          expect(entry.apr).toBeGreaterThan(0)
        }
      }
      expect(result.totalDailyRewardsCut).toBeGreaterThan(0)
    })
  })

  describe('rounding and budget integrity', () => {
    // Helper to generate N subgraphs with varied signal/stake
    function makeSubgraphs(count: number): OptimizableSubgraph[] {
      return Array.from({ length: count }, (_, i) =>
        makeSg(`Qm${i}`, (i + 1) * 10_000_000, (i + 1) * 1_000_000, `Sub${i}`)
      )
    }

    it('budget is never exceeded (2 subgraphs)', () => {
      const budget = 100000
      const result = optimizeAllocations(makeParams(makeSubgraphs(2), budget))
      const sum = result.perSubgraph.reduce((s, e) => s + e.allocationGrt, 0)
      expect(sum).toBeLessThanOrEqual(budget)
      expect(sum).toBeGreaterThanOrEqual(budget - 2)
    })

    it('budget is never exceeded (3 subgraphs)', () => {
      const budget = 100000
      const result = optimizeAllocations(makeParams(makeSubgraphs(3), budget))
      const sum = result.perSubgraph.reduce((s, e) => s + e.allocationGrt, 0)
      expect(sum).toBeLessThanOrEqual(budget)
      expect(sum).toBeGreaterThanOrEqual(budget - 3)
    })

    it('budget is never exceeded (5 subgraphs)', () => {
      const budget = 500000
      const result = optimizeAllocations(makeParams(makeSubgraphs(5), budget))
      const sum = result.perSubgraph.reduce((s, e) => s + e.allocationGrt, 0)
      expect(sum).toBeLessThanOrEqual(budget)
      expect(sum).toBeGreaterThanOrEqual(budget - 5)
    })

    it('budget is never exceeded (10 subgraphs)', () => {
      const budget = 1_000_000
      const result = optimizeAllocations(makeParams(makeSubgraphs(10), budget))
      const sum = result.perSubgraph.reduce((s, e) => s + e.allocationGrt, 0)
      expect(sum).toBeLessThanOrEqual(budget)
      expect(sum).toBeGreaterThanOrEqual(budget - 10)
    })

    it('handles fractional budget without over-allocation', () => {
      const budget = 100000.7
      const result = optimizeAllocations(makeParams(makeSubgraphs(3), budget))
      const sum = result.perSubgraph.reduce((s, e) => s + e.allocationGrt, 0)
      expect(sum).toBeLessThanOrEqual(Math.floor(budget))
    })

    it('all allocations are whole numbers', () => {
      const result = optimizeAllocations(makeParams(makeSubgraphs(5), 500000))
      for (const entry of result.perSubgraph) {
        expect(entry.allocationGrt % 1).toBe(0)
      }
    })

    it('allocations Map matches perSubgraph values', () => {
      const result = optimizeAllocations(makeParams(makeSubgraphs(3), 300000))
      for (const entry of result.perSubgraph) {
        expect(result.allocations.get(entry.ipfsHash)).toBe(entry.allocationGrt)
      }
    })
  })
})
