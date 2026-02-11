import { describe, it, expect } from 'vitest'
import {
  calculateSubgraphDailyRewards,
  calculateAllocationDailyRewards,
  calculateDailyRewardsCut,
} from '@/services/calculations/rewards'

/**
 * Realistic test values inspired by The Graph network on Arbitrum.
 */
const TOTAL_TOKENS_SIGNALLED = '1600000000000000000000000000' // 1.6B GRT
const ISSUANCE_PER_BLOCK = '6700000000000000000'              // 6.7 GRT
const BLOCKS_PER_DAY_ARBITRUM = 5760

describe('rewards', () => {
  describe('calculateSubgraphDailyRewards', () => {
    it('calculates daily rewards for a new allocation', () => {
      const rewards = calculateSubgraphDailyRewards({
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '5000000000000000000000000',       // 5M GRT
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
        newAllocation: '100000',                          // 100K GRT
      })

      // signalRatio = 50M / 1.6B = 0.03125
      // issuancePerDay = 6.7e18 * 5760 = 38592e18 = 3.8592e22
      // newAllocationWei = 100000 * 1e18 = 1e23
      // totalStaked = 5e24 + 1e23 = 5.1e24
      // dailyRewards = 0.03125 * 3.8592e22 * (1e23 / 5.1e24)
      //              = 1.206e21 * 0.0196078
      //              = 2.36471e19
      // That's ~23.65 GRT/day in wei
      expect(rewards).toBeGreaterThan(0)
      // In wei: should be roughly 2.36e19
      expect(rewards / 1e18).toBeCloseTo(23.647, 0)
    })

    it('returns 0 when stakedTokens is 0 and newAllocation is 0', () => {
      const rewards = calculateSubgraphDailyRewards({
        signalledTokens: '50000000000000000000000000',
        stakedTokens: '0',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
        newAllocation: '0',
      })
      expect(rewards).toBe(0)
    })

    it('works for first allocation on a zero-staked subgraph', () => {
      const rewards = calculateSubgraphDailyRewards({
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '0',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
        newAllocation: '500000',                          // 500K GRT
      })

      // newAllocationWei = 500000 * 1e18 = 5e23
      // totalStaked = 0 + 5e23 = 5e23
      // fraction = 5e23 / 5e23 = 1.0
      // dailyRewards = 0.03125 * 6.7e18 * 5760 * 1.0 = 0.03125 * 3.8592e22
      //             = 1.206e21
      // ~1206 GRT/day
      expect(rewards / 1e18).toBeCloseTo(1206, 0)
    })

    it('larger allocation captures proportionally more rewards', () => {
      const params = {
        signalledTokens: '50000000000000000000000000',
        stakedTokens: '5000000000000000000000000',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      }

      const small = calculateSubgraphDailyRewards({ ...params, newAllocation: '100000' })
      const large = calculateSubgraphDailyRewards({ ...params, newAllocation: '500000' })

      expect(large).toBeGreaterThan(small)
    })
  })

  describe('calculateAllocationDailyRewards', () => {
    it('calculates daily rewards for an existing allocation', () => {
      const rewards = calculateAllocationDailyRewards({
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '5000000000000000000000000',       // 5M GRT
        allocatedTokens: '100000000000000000000000',     // 100K GRT
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })

      // signalRatio = 50M / 1.6B = 0.03125
      // issuancePerDay = 6.7e18 * 5760 = 3.8592e22
      // allocationRatio = 100K / 5M = 0.02
      // dailyRewards = 0.03125 * 3.8592e22 * 0.02 = 1.206e21 * 0.02 = 2.412e19
      // ~24.12 GRT/day
      expect(rewards / 1e18).toBeCloseTo(24.12, 0)
    })

    it('returns 0 when stakedTokens is 0', () => {
      const rewards = calculateAllocationDailyRewards({
        signalledTokens: '50000000000000000000000000',
        stakedTokens: '0',
        allocatedTokens: '100000000000000000000000',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })
      expect(rewards).toBe(0)
    })

    it('full allocation captures all subgraph daily rewards', () => {
      // If allocatedTokens == stakedTokens, the indexer captures 100% of the subgraph's rewards
      const rewards = calculateAllocationDailyRewards({
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '5000000000000000000000000',       // 5M GRT
        allocatedTokens: '5000000000000000000000000',    // 5M GRT (100%)
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })

      // allocationRatio = 1.0
      // dailyRewards = 0.03125 * 3.8592e22 * 1.0 = 1.206e21
      // ~1206 GRT/day
      expect(rewards / 1e18).toBeCloseTo(1206, 0)
    })

    it('proportional allocation matches expected fraction', () => {
      const full = calculateAllocationDailyRewards({
        signalledTokens: '50000000000000000000000000',
        stakedTokens: '5000000000000000000000000',
        allocatedTokens: '5000000000000000000000000',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })

      const half = calculateAllocationDailyRewards({
        signalledTokens: '50000000000000000000000000',
        stakedTokens: '5000000000000000000000000',
        allocatedTokens: '2500000000000000000000000',  // 2.5M GRT (50%)
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })

      // half should be ~50% of full (within truncation tolerance)
      expect(half / full).toBeCloseTo(0.5, 2)
    })
  })

  describe('calculateDailyRewardsCut', () => {
    it('calculates indexer cut at 90% (900000 ppm)', () => {
      // 1000 GRT daily rewards in wei
      const dailyRewardsWei = 1000e18
      const cut = calculateDailyRewardsCut(dailyRewardsWei, 900000)

      // 1000e18 * 900000 / 1000000 = 900e18 => 900 GRT
      expect(cut / 1e18).toBeCloseTo(900, 0)
    })

    it('calculates indexer cut at 100% (1000000 ppm)', () => {
      const dailyRewardsWei = 500e18
      const cut = calculateDailyRewardsCut(dailyRewardsWei, 1000000)
      expect(cut / 1e18).toBeCloseTo(500, 0)
    })

    it('calculates indexer cut at 0% (0 ppm)', () => {
      const dailyRewardsWei = 500e18
      const cut = calculateDailyRewardsCut(dailyRewardsWei, 0)
      expect(cut).toBe(0)
    })

    it('returns 0 for 0 daily rewards', () => {
      expect(calculateDailyRewardsCut(0, 900000)).toBe(0)
    })

    it('truncates to integer (no fractional wei)', () => {
      // A value that would produce a fractional result
      const cut = calculateDailyRewardsCut(1000, 333333)
      // 1000 * 333333 / 1000000 = 333.333 => truncated to 333
      expect(cut).toBe(333)
    })
  })
})
