import { describe, it, expect } from 'vitest'
import { calculateMaxAllocation } from '@/services/calculations/maxAllocation'

/**
 * Realistic test values inspired by The Graph network on Arbitrum.
 */
const TOTAL_TOKENS_SIGNALLED = '1600000000000000000000000000' // 1.6B GRT
const ISSUANCE_PER_BLOCK = '6700000000000000000'              // 6.7 GRT
const BLOCKS_PER_DAY_ARBITRUM = 5760

describe('maxAllocation', () => {
  describe('calculateMaxAllocation', () => {
    it('calculates the max allocation for a target APR', () => {
      const maxAllo = calculateMaxAllocation({
        targetApr: 10,
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '5000000000000000000000000',       // 5M GRT
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })

      // targetAprDecimal = 10 / 100 = 0.1
      // issuancePerYear = 6.7e18 * 5760 * 365 = 6.7e18 * 2102400 = 1.40860800e25
      // maxAllo(wei) = (50M / 1.6B) * 1.40860800e25 / 0.1 - 5e24
      //             = 0.03125 * 1.40860800e25 / 0.1 - 5e24
      //             = 0.03125 * 1.40860800e26 - 5e24
      //             = 4.4019e24 - 5e24
      //             = -5.981e23
      // maxAllo(GRT) = -5.981e23 / 1e18 = -598,100 GRT
      // Negative: the subgraph is already over-allocated for 10% APR target.
      // Current APR is ~8.8%, which is below 10%, so max allo is negative.
      expect(maxAllo).toBeLessThan(0)
    })

    it('returns positive when target APR is achievable', () => {
      const maxAllo = calculateMaxAllocation({
        targetApr: 5,
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '5000000000000000000000000',       // 5M GRT
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })

      // targetAprDecimal = 0.05
      // maxAllo(wei) = 0.03125 * 1.40860800e25 / 0.05 - 5e24
      //             = 0.03125 * 2.81721600e26 - 5e24
      //             = 8.8038e24 - 5e24
      //             = 3.8038e24
      // maxAllo(GRT) = 3.8038e24 / 1e18 = 3,803,800 GRT
      expect(maxAllo).toBeGreaterThan(0)
      expect(maxAllo).toBeCloseTo(3_803_800, -3) // within thousands
    })

    it('returns 0 when targetApr is 0', () => {
      const maxAllo = calculateMaxAllocation({
        targetApr: 0,
        signalledTokens: '50000000000000000000000000',
        stakedTokens: '5000000000000000000000000',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })
      expect(maxAllo).toBe(0)
    })

    it('returns 0 when targetApr is negative', () => {
      const maxAllo = calculateMaxAllocation({
        targetApr: -5,
        signalledTokens: '50000000000000000000000000',
        stakedTokens: '5000000000000000000000000',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })
      expect(maxAllo).toBe(0)
    })

    it('handles zero staked tokens', () => {
      const maxAllo = calculateMaxAllocation({
        targetApr: 10,
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '0',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })

      // maxAllo(wei) = 0.03125 * 1.40860800e25 / 0.1 - 0
      //             = 0.03125 * 1.40860800e26
      //             = 4.4019e24
      // maxAllo(GRT) = 4,401,900
      expect(maxAllo).toBeGreaterThan(4_000_000)
      expect(maxAllo).toBeCloseTo(4_401_900, -3)
    })

    it('higher target APR means smaller max allocation', () => {
      const baseParams = {
        signalledTokens: '50000000000000000000000000',
        stakedTokens: '1000000000000000000000000',       // 1M GRT
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      }

      const maxAlloLow = calculateMaxAllocation({ ...baseParams, targetApr: 5 })
      const maxAlloHigh = calculateMaxAllocation({ ...baseParams, targetApr: 20 })

      expect(maxAlloLow).toBeGreaterThan(maxAlloHigh)
    })

    it('more signal means larger max allocation', () => {
      const baseParams = {
        targetApr: 10,
        stakedTokens: '1000000000000000000000000',       // 1M GRT
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      }

      const lowSignal = calculateMaxAllocation({
        ...baseParams,
        signalledTokens: '10000000000000000000000000',   // 10M GRT
      })
      const highSignal = calculateMaxAllocation({
        ...baseParams,
        signalledTokens: '50000000000000000000000000',   // 50M GRT
      })

      expect(highSignal).toBeGreaterThan(lowSignal)
    })
  })
})
