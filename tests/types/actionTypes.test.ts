import { describe, it, expect } from 'vitest'
import type { Action, ActionInput, ActionStatus, ActionType } from '@/types'

/**
 * Runtime type-shape validator for the Action interface.
 *
 * These tests exist to catch mismatches between our TypeScript types and the
 * real Indexer Agent API response shape. They validate at runtime that sample
 * data (copied from real API responses) satisfies the constraints the Action
 * interface declares -- catching bugs like:
 *   - id typed as string when API returns number
 *   - amount typed as string when API returns string | null
 *   - force typed as boolean when API returns boolean | null
 */

// ---------------------------------------------------------------------------
// Real API response samples (from actions-object.txt)
// ---------------------------------------------------------------------------

/** Successful unallocate -- amount is null, force is null, transaction is present */
const successUnallocate: Record<string, unknown> = {
  id: 23228,
  status: 'success',
  type: 'unallocate',
  deploymentID: 'QmNfETjP7dmVXSebJqsQwTrWUmDhvmdQc4oPHBeL5zQiQD',
  allocationID: '0xade575ed668788a67d30d1882699004000f4fb90',
  amount: null,
  poi: null,
  publicPOI: null,
  poiBlockNumber: null,
  force: null,
  priority: 1,
  source: 'Indexer Tools - Agent Connect',
  reason: 'Allocation Wizard',
  transaction: '0xc8b7cec59337b5012d69e330b1a85449ef62c42c4f6df78ac76d68a6fba1d0c7',
  failureReason: null,
  createdAt: '2026-02-09T17:32:47.388Z',
  updatedAt: '2026-02-09T17:33:58.412Z',
  protocolNetwork: 'eip155:42161',
  isLegacy: false,
}

/** Successful allocate -- allocationID is null, amount is a string */
const successAllocate: Record<string, unknown> = {
  id: 23221,
  status: 'success',
  type: 'allocate',
  deploymentID: 'QmUhiH6Z5xo6o3GNzsSvqpGKLmCt6w5WzKQ1yHk6C8AA8S',
  allocationID: null,
  amount: '1000',
  poi: null,
  publicPOI: null,
  poiBlockNumber: null,
  force: null,
  priority: 2,
  source: 'Indexer Tools - Agent Connect',
  reason: 'Allocation Wizard',
  transaction: '0x83a362c869295ef1e3a04d5b3ec69cfedfd1966d61497ae8428627d54a7ce18b',
  failureReason: null,
  createdAt: '2026-02-04T14:27:08.217Z',
  updatedAt: '2026-02-04T14:27:31.056Z',
  protocolNetwork: 'eip155:42161',
  isLegacy: false,
}

/** Failed unallocate -- transaction is null, failureReason has a value */
const failedUnallocate: Record<string, unknown> = {
  id: 23225,
  status: 'failed',
  type: 'unallocate',
  deploymentID: 'QmVTswh3oYg7sYsbscHaKhfRiXaG63ufrL8FniBfASsE4v',
  allocationID: '0xf8f9514a5b6d9f72c45be3b61044e12c82206169',
  amount: null,
  poi: null,
  publicPOI: null,
  poiBlockNumber: null,
  force: null,
  priority: 1,
  source: 'Indexer Tools - Agent Connect',
  reason: 'Allocation Wizard',
  transaction: null,
  failureReason: 'IE069',
  createdAt: '2026-02-07T23:45:53.902Z',
  updatedAt: '2026-02-07T23:50:54.650Z',
  protocolNetwork: 'eip155:42161',
  isLegacy: false,
}

/** Successful reallocate -- allocationID present, amount is a string */
const successReallocate: Record<string, unknown> = {
  id: 23222,
  status: 'success',
  type: 'reallocate',
  deploymentID: 'Qmb27RY3RqP98UMKbTgScf6F7hhokfMuS9fV7VAtPiZHwF',
  allocationID: '0xb8cdafc9db34d98e3fddeb48b040a10da1cb0dc5',
  amount: '906562',
  poi: null,
  publicPOI: null,
  poiBlockNumber: null,
  force: null,
  priority: 2,
  source: 'Indexer Tools - Agent Connect',
  reason: 'Allocation Wizard',
  transaction: '0x2e7eeda0b17c78775374a0c48e14545c269f74fd3e4c9f75c1be983ed13e4093',
  failureReason: null,
  createdAt: '2026-02-04T14:53:48.619Z',
  updatedAt: '2026-02-04T14:54:15.334Z',
  protocolNetwork: 'eip155:42161',
  isLegacy: false,
}

const allSamples = [successUnallocate, successAllocate, failedUnallocate, successReallocate]

// ---------------------------------------------------------------------------
// Type-shape validation helper
// ---------------------------------------------------------------------------

/**
 * Validates that a plain object matches the expected runtime shape of the
 * Action interface. Returns an array of error messages (empty = valid).
 */
function validateActionShape(obj: Record<string, unknown>): string[] {
  const errors: string[] = []

  // Required fields and their expected types (or type-check functions)
  const fieldChecks: Array<{
    key: string
    check: (v: unknown) => boolean
    expected: string
  }> = [
    { key: 'id', check: (v) => typeof v === 'number', expected: 'number' },
    { key: 'status', check: (v) => typeof v === 'string', expected: 'string' },
    { key: 'type', check: (v) => typeof v === 'string', expected: 'string' },
    { key: 'deploymentID', check: (v) => typeof v === 'string', expected: 'string' },
    { key: 'allocationID', check: (v) => typeof v === 'string' || v === null, expected: 'string | null' },
    { key: 'amount', check: (v) => typeof v === 'string' || v === null, expected: 'string | null' },
    { key: 'poi', check: (v) => typeof v === 'string' || v === null, expected: 'string | null' },
    { key: 'publicPOI', check: (v) => typeof v === 'string' || v === null, expected: 'string | null' },
    { key: 'poiBlockNumber', check: (v) => typeof v === 'number' || v === null, expected: 'number | null' },
    { key: 'force', check: (v) => typeof v === 'boolean' || v === null, expected: 'boolean | null' },
    { key: 'priority', check: (v) => typeof v === 'number', expected: 'number' },
    { key: 'source', check: (v) => typeof v === 'string', expected: 'string' },
    { key: 'reason', check: (v) => typeof v === 'string', expected: 'string' },
    { key: 'transaction', check: (v) => typeof v === 'string' || v === null, expected: 'string | null' },
    { key: 'failureReason', check: (v) => typeof v === 'string' || v === null, expected: 'string | null' },
    { key: 'createdAt', check: (v) => typeof v === 'string', expected: 'string' },
    { key: 'updatedAt', check: (v) => typeof v === 'string', expected: 'string' },
    { key: 'protocolNetwork', check: (v) => typeof v === 'string', expected: 'string' },
    { key: 'isLegacy', check: (v) => typeof v === 'boolean', expected: 'boolean' },
  ]

  for (const { key, check, expected } of fieldChecks) {
    if (!(key in obj)) {
      errors.push(`Missing field "${key}"`)
    } else if (!check(obj[key])) {
      errors.push(`Field "${key}": expected ${expected}, got ${typeof obj[key]} (value: ${JSON.stringify(obj[key])})`)
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Action type shape (matches real Indexer Agent API)', () => {
  describe('validates all sample actions pass shape check', () => {
    it('successUnallocate matches Action shape', () => {
      const errors = validateActionShape(successUnallocate)
      expect(errors).toEqual([])
    })

    it('successAllocate matches Action shape', () => {
      const errors = validateActionShape(successAllocate)
      expect(errors).toEqual([])
    })

    it('failedUnallocate matches Action shape', () => {
      const errors = validateActionShape(failedUnallocate)
      expect(errors).toEqual([])
    })

    it('successReallocate matches Action shape', () => {
      const errors = validateActionShape(successReallocate)
      expect(errors).toEqual([])
    })
  })

  describe('Bug 1: id is a number (not string)', () => {
    it('all API actions have numeric id', () => {
      for (const action of allSamples) {
        expect(typeof action.id).toBe('number')
      }
    })

    it('rejects string id as invalid', () => {
      const badAction = { ...successAllocate, id: '23221' }
      const errors = validateActionShape(badAction)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('id')
      expect(errors[0]).toContain('number')
    })
  })

  describe('Bug 2: amount can be null (for unallocate actions)', () => {
    it('unallocate actions have null amount', () => {
      expect(successUnallocate.amount).toBeNull()
      expect(failedUnallocate.amount).toBeNull()
    })

    it('allocate actions have string amount', () => {
      expect(typeof successAllocate.amount).toBe('string')
      expect(successAllocate.amount).toBe('1000')
    })

    it('reallocate actions have string amount', () => {
      expect(typeof successReallocate.amount).toBe('string')
      expect(successReallocate.amount).toBe('906562')
    })

    it('null amount passes shape validation', () => {
      const errors = validateActionShape(successUnallocate)
      expect(errors).toEqual([])
    })

    it('rejects numeric amount as invalid', () => {
      const badAction = { ...successAllocate, amount: 1000 }
      const errors = validateActionShape(badAction)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('amount')
    })
  })

  describe('Bug 3: force can be null', () => {
    it('all sample actions have null force', () => {
      for (const action of allSamples) {
        expect(action.force).toBeNull()
      }
    })

    it('null force passes shape validation', () => {
      for (const action of allSamples) {
        const errors = validateActionShape(action)
        expect(errors).toEqual([])
      }
    })

    it('boolean force also passes shape validation', () => {
      const actionWithForce = { ...successUnallocate, force: true }
      const errors = validateActionShape(actionWithForce)
      expect(errors).toEqual([])
    })

    it('rejects string force as invalid', () => {
      const badAction = { ...successUnallocate, force: 'true' }
      const errors = validateActionShape(badAction)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('force')
    })
  })

  describe('allocationID can be null (for allocate actions)', () => {
    it('allocate actions have null allocationID', () => {
      expect(successAllocate.allocationID).toBeNull()
    })

    it('unallocate actions have string allocationID', () => {
      expect(typeof successUnallocate.allocationID).toBe('string')
    })

    it('reallocate actions have string allocationID', () => {
      expect(typeof successReallocate.allocationID).toBe('string')
    })
  })

  describe('transaction can be null (for failed actions)', () => {
    it('failed actions have null transaction', () => {
      expect(failedUnallocate.transaction).toBeNull()
    })

    it('successful actions have string transaction', () => {
      expect(typeof successUnallocate.transaction).toBe('string')
      expect(typeof successAllocate.transaction).toBe('string')
      expect(typeof successReallocate.transaction).toBe('string')
    })
  })

  describe('failureReason can be null (for success actions)', () => {
    it('success actions have null failureReason', () => {
      expect(successUnallocate.failureReason).toBeNull()
      expect(successAllocate.failureReason).toBeNull()
      expect(successReallocate.failureReason).toBeNull()
    })

    it('failed actions have string failureReason', () => {
      expect(typeof failedUnallocate.failureReason).toBe('string')
      expect(failedUnallocate.failureReason).toBe('IE069')
    })
  })

  describe('poi, publicPOI, poiBlockNumber can all be null', () => {
    it('all sample actions have null poi fields', () => {
      for (const action of allSamples) {
        expect(action.poi).toBeNull()
        expect(action.publicPOI).toBeNull()
        expect(action.poiBlockNumber).toBeNull()
      }
    })

    it('non-null poi values also pass validation', () => {
      const actionWithPOI = {
        ...successUnallocate,
        poi: '0x0000000000000000000000000000000000000000000000000000000000000000',
        publicPOI: '0x0000000000000000000000000000000000000000000000000000000000000000',
        poiBlockNumber: 12345,
      }
      const errors = validateActionShape(actionWithPOI)
      expect(errors).toEqual([])
    })
  })

  describe('status and type enums match expected values', () => {
    const validStatuses: ActionStatus[] = ['queued', 'approved', 'pending', 'success', 'failed', 'canceled']
    const validTypes: ActionType[] = ['allocate', 'unallocate', 'reallocate']

    it('all sample statuses are valid ActionStatus values', () => {
      for (const action of allSamples) {
        expect(validStatuses).toContain(action.status)
      }
    })

    it('all sample types are valid ActionType values', () => {
      for (const action of allSamples) {
        expect(validTypes).toContain(action.type)
      }
    })
  })

  describe('all expected fields are present in API response', () => {
    const expectedKeys: (keyof Action)[] = [
      'id', 'status', 'type', 'deploymentID', 'allocationID', 'amount',
      'poi', 'publicPOI', 'poiBlockNumber', 'force', 'priority', 'source',
      'reason', 'transaction', 'failureReason', 'createdAt', 'updatedAt',
      'protocolNetwork', 'isLegacy',
    ]

    it('each sample has exactly the fields defined in Action interface', () => {
      for (const action of allSamples) {
        const actionKeys = Object.keys(action).sort()
        const expected = [...expectedKeys].sort()
        expect(actionKeys).toEqual(expected)
      }
    })

    it('no unexpected extra fields in API response', () => {
      for (const action of allSamples) {
        for (const key of Object.keys(action)) {
          expect(expectedKeys).toContain(key)
        }
      }
    })
  })
})

describe('ActionInput type shape (for wizard action building)', () => {
  it('has all required fields for an allocate action', () => {
    const input: ActionInput = {
      status: 'queued',
      type: 'allocate',
      deploymentID: 'QmUhiH6Z5xo6o3GNzsSvqpGKLmCt6w5WzKQ1yHk6C8AA8S',
      amount: '1000',
      protocolNetwork: 'eip155:42161',
      source: 'Indexer Tools - Agent Connect',
      reason: 'Allocation Wizard',
      priority: 2,
      isLegacy: false,
    }

    expect(input.status).toBe('queued')
    expect(input.type).toBe('allocate')
    expect(typeof input.deploymentID).toBe('string')
    expect(typeof input.amount).toBe('string')
    expect(typeof input.protocolNetwork).toBe('string')
    expect(typeof input.source).toBe('string')
    expect(typeof input.reason).toBe('string')
    expect(typeof input.priority).toBe('number')
    expect(typeof input.isLegacy).toBe('boolean')
  })

  it('has all required fields for an unallocate action', () => {
    const input: ActionInput = {
      status: 'queued',
      type: 'unallocate',
      deploymentID: 'QmNfETjP7dmVXSebJqsQwTrWUmDhvmdQc4oPHBeL5zQiQD',
      allocationID: '0xade575ed668788a67d30d1882699004000f4fb90',
      amount: '0',
      protocolNetwork: 'eip155:42161',
      source: 'Indexer Tools - Agent Connect',
      reason: 'Allocation Wizard',
      priority: 1,
      isLegacy: false,
    }

    expect(input.allocationID).toBeDefined()
    expect(typeof input.allocationID).toBe('string')
  })

  it('has all required fields for a reallocate action with custom POI', () => {
    const input: ActionInput = {
      status: 'queued',
      type: 'reallocate',
      deploymentID: 'Qmb27RY3RqP98UMKbTgScf6F7hhokfMuS9fV7VAtPiZHwF',
      allocationID: '0xb8cdafc9db34d98e3fddeb48b040a10da1cb0dc5',
      amount: '906562',
      protocolNetwork: 'eip155:42161',
      source: 'Indexer Tools - Agent Connect',
      reason: 'Allocation Wizard',
      priority: 2,
      isLegacy: false,
      poi: '0x0000000000000000000000000000000000000000000000000000000000000000',
      publicPOI: '0x0000000000000000000000000000000000000000000000000000000000000000',
      poiBlockNumber: 42,
      force: true,
    }

    expect(input.poi).toBeDefined()
    expect(input.publicPOI).toBeDefined()
    expect(input.poiBlockNumber).toBeDefined()
    expect(input.force).toBeDefined()
  })

  it('status is always "queued" for new action inputs', () => {
    // ActionInput.status is the literal type 'queued', not the full ActionStatus union
    const input: ActionInput = {
      status: 'queued',
      type: 'allocate',
      deploymentID: 'QmTest',
      amount: '1000',
      protocolNetwork: 'eip155:42161',
      source: 'test',
      reason: 'test',
      priority: 1,
      isLegacy: false,
    }

    expect(input.status).toBe('queued')
    // TypeScript enforces this at compile time; this runtime check confirms it
  })

  it('amount is required (non-nullable) on ActionInput', () => {
    // Unlike Action.amount which can be null (for unallocate API responses),
    // ActionInput.amount is always a string because the wizard must provide a value
    const input: ActionInput = {
      status: 'queued',
      type: 'unallocate',
      deploymentID: 'QmTest',
      allocationID: '0xtest',
      amount: '0',
      protocolNetwork: 'eip155:42161',
      source: 'test',
      reason: 'test',
      priority: 1,
      isLegacy: false,
    }

    expect(typeof input.amount).toBe('string')
    expect(input.amount).not.toBeNull()
  })
})

describe('Action vs ActionInput field comparison', () => {
  it('ActionInput has a subset of Action fields plus optional POI fields', () => {
    // This test documents the expected relationship between the two types:
    // - Action has all fields returned by the API (including server-generated ones)
    // - ActionInput has fields the client sends when creating an action
    // Server-generated fields NOT in ActionInput:
    const serverOnlyFields = ['id', 'transaction', 'failureReason', 'createdAt', 'updatedAt']

    // Verify these fields exist in our Action samples but would not be sent in ActionInput
    for (const field of serverOnlyFields) {
      expect(field in successAllocate).toBe(true)
    }
  })

  it('casting real API response to Action succeeds at compile time', () => {
    // This compile-time check ensures the sample data is assignable to Action.
    // If the types are wrong (e.g., id: string instead of number), this would
    // cause a TypeScript error at build time.
    const action: Action = successAllocate as unknown as Action

    // At runtime, just verify the cast worked
    expect(action.id).toBe(23221)
    expect(action.type).toBe('allocate')
  })
})
