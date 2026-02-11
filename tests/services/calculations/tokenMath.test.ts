import { describe, it, expect } from 'vitest'
import { weiToGrt, grtToWei, formatGrt, parseTokenAmount } from '@/services/calculations/tokenMath'

describe('tokenMath', () => {
  describe('weiToGrt', () => {
    it('converts 1 GRT in wei to 1.0', () => {
      expect(weiToGrt('1000000000000000000')).toBe(1)
    })

    it('converts 0 wei to 0', () => {
      expect(weiToGrt('0')).toBe(0)
    })

    it('converts a realistic signalled tokens amount', () => {
      // 50,000 GRT in wei
      const wei = '50000000000000000000000'
      expect(weiToGrt(wei)).toBeCloseTo(50_000, 5)
    })

    it('converts a large total supply amount', () => {
      // ~10 billion GRT (realistic total supply)
      const wei = '10000000000000000000000000000'
      expect(weiToGrt(wei)).toBe(10_000_000_000)
    })

    it('handles fractional GRT values', () => {
      // 0.5 GRT in wei
      const wei = '500000000000000000'
      expect(weiToGrt(wei)).toBe(0.5)
    })

    it('handles very small wei amounts', () => {
      // 1 wei = 1e-18 GRT
      expect(weiToGrt('1')).toBeCloseTo(1e-18, 30)
    })

    it('converts realistic issuance per block', () => {
      // ~6.7 GRT per block (realistic for Arbitrum)
      const wei = '6700000000000000000'
      expect(weiToGrt(wei)).toBeCloseTo(6.7, 10)
    })
  })

  describe('grtToWei', () => {
    it('converts 1 GRT to wei string', () => {
      expect(grtToWei(1)).toBe('1000000000000000000')
    })

    it('converts 0 GRT to 0 wei', () => {
      expect(grtToWei(0)).toBe('0')
    })

    it('converts a typical allocation amount', () => {
      // 100,000 GRT
      const result = grtToWei(100_000)
      expect(result).toBe('100000000000000000000000')
    })

    it('converts fractional GRT', () => {
      const result = grtToWei(0.5)
      expect(result).toBe('500000000000000000')
    })
  })

  describe('formatGrt', () => {
    it('formats with default 2 decimal places', () => {
      expect(formatGrt(1500.126)).toBe('1,500.13')
    })

    it('formats a large amount with commas', () => {
      expect(formatGrt(1234567.89)).toBe('1,234,567.89')
    })

    it('formats with custom decimal places', () => {
      expect(formatGrt(1500.12345, 4)).toBe('1,500.1235')
    })

    it('formats zero', () => {
      expect(formatGrt(0)).toBe('0.00')
    })

    it('formats with 0 decimal places', () => {
      expect(formatGrt(1500.9, 0)).toBe('1,501')
    })

    it('pads with trailing zeros', () => {
      expect(formatGrt(1500, 2)).toBe('1,500.00')
    })
  })

  describe('parseTokenAmount', () => {
    it('is an alias for weiToGrt', () => {
      const wei = '50000000000000000000000'
      expect(parseTokenAmount(wei)).toBe(weiToGrt(wei))
    })

    it('converts realistic staked tokens', () => {
      // 1,000,000 GRT staked
      const wei = '1000000000000000000000000'
      expect(parseTokenAmount(wei)).toBe(1_000_000)
    })
  })
})
