import { describe, it, expect } from 'vitest'
import { weiToGrt } from '@/services/calculations/tokenMath'
import { formatNumber } from '@/services/formatting/numbers'

/**
 * Regression tests for bugs found in ActionsManager.vue.
 *
 * These are pure unit tests that exercise the logic patterns that caused
 * real bugs, without needing to mount Vue components.
 */

// ---------------------------------------------------------------------------
// Bug 1: getRowId returned number instead of string
// ---------------------------------------------------------------------------
// DataTable requires getRowId to return a string. The original implementation
// was `(row) => row.id` which returned a number because Action.id is typed
// as number. TanStack Table uses the return value as a Map/object key, so
// returning a number caused row identification failures.
// ---------------------------------------------------------------------------

describe('Bug 1: getRowId must return string', () => {
  // The FIXED version (current code)
  const getRowId = (row: { id: number }): string => String(row.id)

  // The BUGGY version (original code before fix)
  const getRowIdBuggy = (row: { id: number }) => row.id

  it('returns a string type, not a number', () => {
    const action = { id: 42 }
    const result = getRowId(action)

    expect(typeof result).toBe('string')
    expect(result).toBe('42')
  })

  it('returns string for various numeric IDs', () => {
    const ids = [0, 1, 100, 999999]
    for (const id of ids) {
      const result = getRowId({ id })
      expect(typeof result).toBe('string')
      expect(result).toBe(String(id))
    }
  })

  it('buggy version returns number (demonstrating the original bug)', () => {
    const action = { id: 42 }
    const result = getRowIdBuggy(action)

    // This is the bug: typeof returns 'number' instead of 'string'
    expect(typeof result).toBe('number')
    expect(typeof result).not.toBe('string')
  })

  it('string and number row IDs do not match as Map keys', () => {
    // TanStack Table uses row IDs as string keys internally.
    // If getRowId returns a number, lookups by string key fail.
    const rowMap = new Map<string, boolean>()
    rowMap.set('42', true)

    // String key works
    expect(rowMap.get('42')).toBe(true)

    // Number key fails - this is what happened with the buggy getRowId
    expect(rowMap.get(42 as any)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Bug 2: Set<string>.has(number) strict equality failure
// ---------------------------------------------------------------------------
// Selection state used Set<string>, but when comparing against action IDs
// (which are numbers), `Set<string>.has(someNumber)` always returns false
// because Set uses strict equality (===) internally.
// ---------------------------------------------------------------------------

describe('Bug 2: Set<string>.has(number) strict equality', () => {
  it('Set<string>.has() returns false when given a number', () => {
    const selectedIds = new Set<string>(['123', '456', '789'])

    // String lookup works
    expect(selectedIds.has('123')).toBe(true)
    expect(selectedIds.has('456')).toBe(true)

    // Number lookup FAILS due to strict equality - this is the bug
    // TypeScript types prevent this at compile time, but at runtime it
    // silently returns false
    expect(selectedIds.has(123 as any)).toBe(false)
    expect(selectedIds.has(456 as any)).toBe(false)
  })

  it('strict equality: "123" !== 123', () => {
    // This is the underlying JavaScript behavior that causes the bug
    expect('123' === (123 as any)).toBe(false)
    expect('123' == (123 as any)).toBe(true) // loose equality works, but Set uses strict
  })

  it('String() conversion fixes the comparison', () => {
    const selectedIds = new Set<string>(['123', '456'])
    const numericId = 123

    // The fix: always convert to string before checking
    expect(selectedIds.has(String(numericId))).toBe(true)
  })

  it('demonstrates the fixed selection filter pattern', () => {
    // This mirrors the fixed pattern in ActionsManager:
    //   allActions.value.filter((a) => selectedActions.value.has(String(a.id)))
    const selectedActions = new Set<string>(['10', '20', '30'])
    const allActions = [
      { id: 10, type: 'allocate' },
      { id: 20, type: 'unallocate' },
      { id: 30, type: 'reallocate' },
      { id: 40, type: 'allocate' },
    ]

    // BUGGY: without String() conversion, nothing matches
    const buggyResult = allActions.filter((a) => selectedActions.has(a.id as any))
    expect(buggyResult).toHaveLength(0) // Bug: no matches!

    // FIXED: with String() conversion, correct actions are found
    const fixedResult = allActions.filter((a) => selectedActions.has(String(a.id)))
    expect(fixedResult).toHaveLength(3)
    expect(fixedResult.map((a) => a.id)).toEqual([10, 20, 30])
  })
})

// ---------------------------------------------------------------------------
// Bug 3: Action amounts displayed as wei instead of GRT
// ---------------------------------------------------------------------------
// The ActionsManager originally used TokenCell (which calls weiToGrt /
// formatUnits) to display action amounts. But action amounts from the
// Indexer Agent API are already in GRT (e.g. "906562" = 906,562 GRT),
// NOT in wei. Passing them through wei-to-GRT conversion divided by 1e18,
// showing absurdly small values like 0.000000000000906562.
// ---------------------------------------------------------------------------

describe('Bug 3: action amounts are GRT, not wei', () => {
  const sampleAmount = '906562' // From Indexer Agent API: 906,562 GRT

  it('parseFloat gives correct GRT value (the fix)', () => {
    // The fixed approach: parse the string directly as a float
    const grt = parseFloat(sampleAmount)
    expect(grt).toBe(906562)
    expect(grt).toBeCloseTo(906562, 0)
  })

  it('weiToGrt gives wildly wrong value for action amounts (the bug)', () => {
    // The buggy approach: treating the amount as wei and dividing by 1e18
    const wrongGrt = weiToGrt(sampleAmount)

    // 906562 / 1e18 = 9.06562e-13 -- effectively zero
    expect(wrongGrt).toBeCloseTo(9.06562e-13, 20)
    expect(wrongGrt).toBeLessThan(0.000001) // Absurdly small

    // The correct value is 906,562 -- off by a factor of 1e18!
    const correctGrt = parseFloat(sampleAmount)
    expect(correctGrt / wrongGrt).toBeCloseTo(1e18, -3)
  })

  it('formatted display shows correct value with parseFloat', () => {
    // The fixed display logic from ActionsManager:
    //   const parsed = parseFloat(val)
    //   formatNumber(parsed, 0) + ' GRT'
    const parsed = parseFloat(sampleAmount)
    const display = `${formatNumber(parsed, 0)} GRT`

    expect(display).toBe('906,562 GRT')
  })

  it('formatted display shows wrong value with weiToGrt', () => {
    // What the buggy version would have displayed
    const wrongGrt = weiToGrt(sampleAmount)
    const buggyDisplay = `${formatNumber(wrongGrt, 0)} GRT`

    // Shows "0 GRT" instead of "906,562 GRT"
    expect(buggyDisplay).toBe('0 GRT')
    expect(buggyDisplay).not.toBe('906,562 GRT')
  })

  it('handles various real action amounts correctly', () => {
    const amounts = [
      { raw: '0', expectedGrt: 0 },
      { raw: '1000', expectedGrt: 1000 },
      { raw: '906562', expectedGrt: 906562 },
      { raw: '1500000', expectedGrt: 1500000 },
      { raw: '100', expectedGrt: 100 },
    ]

    for (const { raw, expectedGrt } of amounts) {
      const parsed = parseFloat(raw)
      expect(parsed).toBe(expectedGrt)

      // weiToGrt would give wrong values for all non-zero amounts
      if (expectedGrt > 0) {
        const wrongGrt = weiToGrt(raw)
        expect(wrongGrt).not.toBeCloseTo(expectedGrt, 0)
      }
    }
  })

  it('fractional GRT amounts also work with parseFloat', () => {
    // Some action amounts may have decimals
    const fractionalAmount = '1500.5'
    const parsed = parseFloat(fractionalAmount)
    expect(parsed).toBe(1500.5)

    const display = `${formatNumber(parsed, 0)} GRT`
    expect(display).toBe('1,501 GRT') // rounded to 0 decimals
  })
})
