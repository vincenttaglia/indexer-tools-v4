import { describe, it, expect } from 'vitest'
import { isSyncedToEpoch } from '@/services/calculations/sync'

describe('isSyncedToEpoch', () => {
  it('returns true when latestBlock is at or above the epoch start block', () => {
    expect(isSyncedToEpoch(100, 100)).toBe(true)
    expect(isSyncedToEpoch(101, 100)).toBe(true)
    expect(isSyncedToEpoch(466_983_967, 466_730_398)).toBe(true)
  })

  it('returns false when latestBlock is below the epoch start block', () => {
    // The exact field bug: 69M block treated as synced because string compare
    // saw "69820004" >= "466730398". After the boundary fix these are real
    // numbers; the helper returns false.
    expect(isSyncedToEpoch(69_820_004, 466_730_398)).toBe(false)
    expect(isSyncedToEpoch(99, 100)).toBe(false)
  })

  it('returns null when either input is null or undefined', () => {
    expect(isSyncedToEpoch(null, 100)).toBeNull()
    expect(isSyncedToEpoch(100, null)).toBeNull()
    expect(isSyncedToEpoch(undefined, 100)).toBeNull()
    expect(isSyncedToEpoch(100, undefined)).toBeNull()
    expect(isSyncedToEpoch(null, null)).toBeNull()
  })

  it('returns null when either input is zero or negative', () => {
    // Boundary normalizer falls back to 0 for unparseable block numbers.
    // Without this guard, 0 >= 0 would evaluate true and a deployment with
    // garbage data on both sides would be reported as synced.
    expect(isSyncedToEpoch(0, 100)).toBeNull()
    expect(isSyncedToEpoch(100, 0)).toBeNull()
    expect(isSyncedToEpoch(0, 0)).toBeNull()
    expect(isSyncedToEpoch(-1, 100)).toBeNull()
    expect(isSyncedToEpoch(100, -1)).toBeNull()
  })
})
