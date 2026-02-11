import { describe, it, expect } from 'vitest'
import { calculateApr, calculateNewApr } from '@/services/calculations/apr'

/**
 * Realistic test values inspired by The Graph network on Arbitrum:
 *
 * - totalTokensSignalled: ~1.6 billion GRT in wei
 * - networkGRTIssuancePerBlock: ~6.7 GRT per block in wei
 * - blocksPerDay: 5760 (Arbitrum ~15s blocks)
 * - A subgraph with 500,000 GRT signalled and 2,000,000 GRT staked
 */
const TOTAL_TOKENS_SIGNALLED = '1600000000000000000000000000' // 1.6B GRT
const ISSUANCE_PER_BLOCK = '6700000000000000000'              // 6.7 GRT
const BLOCKS_PER_DAY_ARBITRUM = 5760

// Issuance per year in wei = 6.7e18 * 5760 * 365 = 6.7 * 5760 * 365 * 1e18
// = 6.7 * 2_102_400 = 14_086_080 GRT/year (in wei: 14086080e18)

describe('apr', () => {
  describe('calculateApr', () => {
    it('calculates a realistic APR for a well-signalled subgraph', () => {
      const apr = calculateApr({
        signalledTokens: '500000000000000000000000',     // 500K GRT
        stakedTokens: '2000000000000000000000000',       // 2M GRT
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })

      // The formula operates in wei: all values are in wei, so:
      // signalledTokens (wei) / totalTokensSignalled (wei) cancels units
      // Then * issuancePerYear (wei) / stakedTokens (wei) cancels units
      // Result * 100 = percentage
      //
      // signalRatio = 500K / 1.6B = 0.0003125
      // issuancePerYear = 6.7e18 * 5760 * 365 = 1.40860800e25
      // APR = (5e23 / 1.6e27) * 1.40860800e25 / 2e24 * 100
      //     = 3.125e-4 * 1.40860800e25 / 2e24 * 100
      //     = 4.401900e21 / 2e24 * 100
      //     = 2.20095e-3 * 100
      //     = 0.220095%
      // Low APR because signal is small (500K) relative to total signal (1.6B).
      expect(apr).toBeCloseTo(0.220095, 2)
    })

    it('calculates higher APR for a strongly signalled subgraph', () => {
      const apr = calculateApr({
        signalledTokens: '50000000000000000000000000',   // 50M GRT signalled
        stakedTokens: '5000000000000000000000000',       // 5M GRT staked
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })

      // signalRatio = 50M / 1.6B = 0.03125
      // APR = 0.03125 * 14086080e18 / 5000000e18 * 100
      //     = 440190 / 5000000 * 100
      //     = 0.088038 * 100
      //     = 8.8038%
      expect(apr).toBeCloseTo(8.8038, 1)
    })

    it('returns 0 when stakedTokens is 0', () => {
      const apr = calculateApr({
        signalledTokens: '500000000000000000000000',
        stakedTokens: '0',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })
      expect(apr).toBe(0)
    })

    it('returns 0 when signalledTokens is 0', () => {
      const apr = calculateApr({
        signalledTokens: '0',
        stakedTokens: '2000000000000000000000000',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })
      expect(apr).toBe(0)
    })

    it('returns 0 when totalTokensSignalled is 0', () => {
      const apr = calculateApr({
        signalledTokens: '500000000000000000000000',
        stakedTokens: '2000000000000000000000000',
        totalTokensSignalled: '0',
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      })
      expect(apr).toBe(0)
    })
  })

  describe('calculateNewApr', () => {
    it('with newAllocation = "0" matches calculateApr', () => {
      const params = {
        signalledTokens: '500000000000000000000000',
        stakedTokens: '2000000000000000000000000',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      }

      const apr = calculateApr(params)
      const newApr = calculateNewApr({ ...params, newAllocation: '0' })
      expect(newApr).toBe(apr)
    })

    it('adding allocation decreases APR', () => {
      const baseParams = {
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '5000000000000000000000000',       // 5M GRT
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
      }

      const currentApr = calculateApr(baseParams)
      const newApr = calculateNewApr({ ...baseParams, newAllocation: '1000000' }) // 1M GRT

      // Adding more stake should decrease APR
      expect(newApr).toBeLessThan(currentApr)
      expect(newApr).toBeGreaterThan(0)
    })

    it('calculates correctly with a specific new allocation', () => {
      const apr = calculateNewApr({
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '5000000000000000000000000',       // 5M GRT
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
        newAllocation: '1000000',                         // 1M GRT
      })

      // New total staked = 5M + 1M = 6M GRT = 6e24 wei
      // APR = (50M / 1.6B) * issuancePerYear / 6e24 * 100
      //     = 0.03125 * 14086080e18 / 6000000e18 * 100
      //     = 440190 / 6000000 * 100
      //     = 7.3365%
      expect(apr).toBeCloseTo(7.3365, 1)
    })

    it('handles allocation on a zero-staked subgraph', () => {
      const apr = calculateNewApr({
        signalledTokens: '50000000000000000000000000',   // 50M GRT
        stakedTokens: '0',
        totalTokensSignalled: TOTAL_TOKENS_SIGNALLED,
        networkGRTIssuancePerBlock: ISSUANCE_PER_BLOCK,
        blocksPerDay: BLOCKS_PER_DAY_ARBITRUM,
        newAllocation: '1000000',                         // 1M GRT
      })

      // totalStaked = 0 + 1M = 1M GRT
      // APR = 0.03125 * 14086080e18 / 1e24 * 100 = 440190 / 1000000 * 100 = 44.019%
      expect(apr).toBeCloseTo(44.019, 0)
    })
  })
})
