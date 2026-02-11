import { describe, it, expect, vi } from 'vitest'
import {
  ACTIONS_QUERY,
  QUEUE_ACTIONS_MUTATION,
  DELETE_ACTIONS_MUTATION,
  EXECUTE_APPROVED_ACTIONS_MUTATION,
  APPROVE_ACTIONS_MUTATION,
  CANCEL_ACTIONS_MUTATION,
  fetchActions,
  queueActions,
  deleteActions,
  executeApprovedActions,
  approveActions,
  cancelActions,
} from '@/api/graphql/mutations/actions'
import type { Action, ActionInput } from '@/types'
import type { GraphQLClient } from 'graphql-request'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock Action for canned responses */
function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 1,
    status: 'queued',
    type: 'allocate',
    deploymentID: 'QmTest',
    allocationID: null,
    amount: '1000',
    poi: null,
    publicPOI: null,
    poiBlockNumber: null,
    force: null,
    priority: 1,
    source: 'indexerTools',
    reason: 'test',
    transaction: null,
    failureReason: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    protocolNetwork: 'arbitrum-one',
    isLegacy: false,
    ...overrides,
  }
}

/** Build a minimal mock ActionInput */
function makeActionInput(overrides: Partial<ActionInput> = {}): ActionInput {
  return {
    status: 'queued',
    type: 'allocate',
    deploymentID: 'QmTest',
    amount: '1000',
    protocolNetwork: 'arbitrum-one',
    source: 'indexerTools',
    reason: 'test',
    priority: 1,
    isLegacy: false,
    ...overrides,
  }
}

/** Create a mock GraphQLClient that returns a canned response for any request */
function mockClient(response: unknown): GraphQLClient {
  return {
    request: vi.fn().mockResolvedValue(response),
  } as unknown as GraphQLClient
}

// ---------------------------------------------------------------------------
// Bug 1: queueActions phantom nesting
// ---------------------------------------------------------------------------

describe('Bug 1: QUEUE_ACTIONS_MUTATION — no phantom nesting', () => {
  it('does NOT contain a nested "actions {" block inside queueActions', () => {
    // The mutation string, after interpolation by gql, is a plain string.
    // A correct mutation looks like:
    //   queueActions(actions: $actions) { id status type ... }
    // A buggy version had:
    //   queueActions(actions: $actions) { actions { id status type ... } }
    const mutationStr = QUEUE_ACTIONS_MUTATION as string

    // Find everything after `queueActions(actions: $actions) {`
    const openIdx = mutationStr.indexOf('queueActions(actions: $actions)')
    expect(openIdx).toBeGreaterThan(-1)

    // Extract the selection set that follows `queueActions(actions: $actions) {`
    const afterOpen = mutationStr.slice(openIdx)
    // The first `{` after the field name opens the selection set
    const braceIdx = afterOpen.indexOf('{')
    expect(braceIdx).toBeGreaterThan(-1)

    const selectionSet = afterOpen.slice(braceIdx + 1)

    // The selection set should NOT start with `actions {` — that would be the
    // phantom nesting bug. Strip whitespace and check.
    const trimmed = selectionSet.trimStart()
    expect(trimmed.startsWith('actions')).toBe(false)
  })

  it('fields (id, status, type) appear directly inside queueActions selection set', () => {
    const mutationStr = QUEUE_ACTIONS_MUTATION as string

    // Extract the queueActions selection set
    const match = mutationStr.match(/queueActions\(actions: \$actions\)\s*\{([^}]+)\}/)
    expect(match).not.toBeNull()

    const selectionBody = match![1]
    // These fields should appear directly, not inside a nested block
    expect(selectionBody).toContain('id')
    expect(selectionBody).toContain('status')
    expect(selectionBody).toContain('type')
    expect(selectionBody).toContain('deploymentID')
  })
})

// ---------------------------------------------------------------------------
// Bug 2: deleteActions expects Action[] but API returns Int
// ---------------------------------------------------------------------------

describe('Bug 2: DELETE_ACTIONS_MUTATION — no selection set on scalar', () => {
  it('does NOT contain a selection set after deleteActions(actionIDs: $actionIDs)', () => {
    const mutationStr = DELETE_ACTIONS_MUTATION as string

    // Find `deleteActions(actionIDs: $actionIDs)`
    const fieldIdx = mutationStr.indexOf('deleteActions(actionIDs: $actionIDs)')
    expect(fieldIdx).toBeGreaterThan(-1)

    // Everything after the closing `)` of the field should NOT contain `{`
    // before the mutation's own closing `}`
    const afterField = mutationStr.slice(
      fieldIdx + 'deleteActions(actionIDs: $actionIDs)'.length,
    )

    // Strip whitespace; the next non-whitespace character should be `}` (closing the mutation),
    // NOT `{` (which would open a selection set on a scalar).
    const trimmed = afterField.trimStart()
    expect(trimmed.startsWith('{')).toBe(false)
  })

  it('does NOT request fields like id, status, type on deleteActions', () => {
    const mutationStr = DELETE_ACTIONS_MUTATION as string

    // After `deleteActions(actionIDs: $actionIDs)` there should be no field names
    const afterDelete = mutationStr.split('deleteActions(actionIDs: $actionIDs)')[1] ?? ''

    // Remove the closing braces of the mutation/operation
    // If there were a selection set, these field names would appear
    expect(afterDelete).not.toContain('status')
    expect(afterDelete).not.toContain('deploymentID')
    expect(afterDelete).not.toContain('allocationID')
  })
})

// ---------------------------------------------------------------------------
// Bug 3: executeApprovedActions requests non-existent fields
// ---------------------------------------------------------------------------

describe('Bug 3: EXECUTE_APPROVED_ACTIONS_MUTATION — no createdAt/updatedAt', () => {
  it('does NOT contain createdAt in the mutation string', () => {
    const mutationStr = EXECUTE_APPROVED_ACTIONS_MUTATION as string
    expect(mutationStr).not.toContain('createdAt')
  })

  it('does NOT contain updatedAt in the mutation string', () => {
    const mutationStr = EXECUTE_APPROVED_ACTIONS_MUTATION as string
    expect(mutationStr).not.toContain('updatedAt')
  })

  it('does still request other valid ActionResult fields', () => {
    const mutationStr = EXECUTE_APPROVED_ACTIONS_MUTATION as string
    expect(mutationStr).toContain('id')
    expect(mutationStr).toContain('status')
    expect(mutationStr).toContain('type')
    expect(mutationStr).toContain('deploymentID')
    expect(mutationStr).toContain('transaction')
    expect(mutationStr).toContain('failureReason')
  })
})

// ---------------------------------------------------------------------------
// Bug 4: actions query filter should be optional
// ---------------------------------------------------------------------------

describe('Bug 4: ACTIONS_QUERY — filter is optional', () => {
  it('uses $filter: ActionFilter (without !) in the query', () => {
    const queryStr = ACTIONS_QUERY as string
    // Should contain optional filter
    expect(queryStr).toContain('$filter: ActionFilter')
    // Should NOT contain required filter (ActionFilter!)
    expect(queryStr).not.toContain('$filter: ActionFilter!')
  })
})

// ---------------------------------------------------------------------------
// Bug 5: Response type correctness — typed fetch functions
// ---------------------------------------------------------------------------

describe('Bug 5: Response type correctness with mock client', () => {
  describe('queueActions', () => {
    it('spreads data.queueActions directly as a flat array', async () => {
      const actions = [makeAction({ id: 1 }), makeAction({ id: 2 })]
      // The API returns { queueActions: Action[] } (flat, no nesting)
      const client = mockClient({ queueActions: actions })

      const result = await queueActions(client, [makeActionInput(), makeActionInput()])

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
      expect(result[1].id).toBe(2)
    })

    it('would fail if response had phantom nesting { queueActions: { actions: [...] } }', async () => {
      // Simulate the buggy nested response shape that the old code expected.
      // The corrected code does `...data.queueActions` expecting an array.
      // If the API returned a nested object instead, the spread would throw
      // because a plain object is not iterable.
      const actions = [makeAction({ id: 1 })]
      const client = mockClient({ queueActions: { actions } })

      await expect(queueActions(client, [makeActionInput()])).rejects.toThrow()
    })

    it('batches requests in groups of 100', async () => {
      const singleAction = makeAction()
      const client = mockClient({ queueActions: [singleAction] })

      // Create 250 inputs — should produce 3 batches (100 + 100 + 50)
      const inputs = Array.from({ length: 250 }, (_, i) =>
        makeActionInput({ deploymentID: `Qm${i}` }),
      )

      const result = await queueActions(client, inputs)

      // The mock always returns [singleAction], so 3 batches = 3 results
      expect(result).toHaveLength(3)
      expect(client.request).toHaveBeenCalledTimes(3)
    })
  })

  describe('deleteActions', () => {
    it('returns a number (count of deleted actions)', async () => {
      // The API returns { deleteActions: Int }
      const client = mockClient({ deleteActions: 5 })

      const result = await deleteActions(client, ['1', '2', '3', '4', '5'])

      expect(result).toBe(5)
      expect(typeof result).toBe('number')
    })

    it('would break if code tried to access sub-fields on the scalar', async () => {
      // If the mutation had a selection set, graphql-request would fail at the API.
      // Here we verify the function just returns the scalar directly.
      const client = mockClient({ deleteActions: 0 })

      const result = await deleteActions(client, [])

      expect(result).toBe(0)
      expect(typeof result).toBe('number')
    })
  })

  describe('fetchActions', () => {
    it('returns data.actions array', async () => {
      const actions = [makeAction({ id: 10 }), makeAction({ id: 20 })]
      const client = mockClient({ actions })

      const result = await fetchActions(client)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(10)
      expect(result[1].id).toBe(20)
    })

    it('passes filter as an optional variable', async () => {
      const client = mockClient({ actions: [] })

      await fetchActions(client, { status: 'queued' })

      expect(client.request).toHaveBeenCalledWith(
        expect.anything(),
        { filter: { status: 'queued' } },
      )
    })

    it('defaults filter to empty object when omitted', async () => {
      const client = mockClient({ actions: [] })

      await fetchActions(client)

      expect(client.request).toHaveBeenCalledWith(
        expect.anything(),
        { filter: {} },
      )
    })
  })

  describe('executeApprovedActions', () => {
    it('returns data.executeApprovedActions array', async () => {
      const actions = [makeAction({ id: 99, status: 'success' })]
      const client = mockClient({ executeApprovedActions: actions })

      const result = await executeApprovedActions(client)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(99)
      expect(result[0].status).toBe('success')
    })
  })

  describe('approveActions', () => {
    it('returns data.approveActions array', async () => {
      const actions = [makeAction({ id: 5, status: 'approved' })]
      const client = mockClient({ approveActions: actions })

      const result = await approveActions(client, ['5'])

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('approved')
    })
  })

  describe('cancelActions', () => {
    it('returns data.cancelActions array', async () => {
      const actions = [makeAction({ id: 7, status: 'canceled' })]
      const client = mockClient({ cancelActions: actions })

      const result = await cancelActions(client, ['7'])

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('canceled')
    })
  })
})

// ---------------------------------------------------------------------------
// Structural sanity checks (catch regressions on other mutations too)
// ---------------------------------------------------------------------------

describe('Structural sanity: all mutation strings are well-formed', () => {
  it('APPROVE_ACTIONS_MUTATION contains action fields directly', () => {
    const mutationStr = APPROVE_ACTIONS_MUTATION as string
    expect(mutationStr).toContain('approveActions(actionIDs: $actionIDs)')
    expect(mutationStr).toContain('id')
    expect(mutationStr).toContain('status')
  })

  it('CANCEL_ACTIONS_MUTATION contains action fields directly', () => {
    const mutationStr = CANCEL_ACTIONS_MUTATION as string
    expect(mutationStr).toContain('cancelActions(actionIDs: $actionIDs)')
    expect(mutationStr).toContain('id')
    expect(mutationStr).toContain('status')
  })

  it('QUEUE_ACTIONS_MUTATION requests createdAt/updatedAt (full Action type)', () => {
    // The queue mutation returns full Action (which includes createdAt/updatedAt),
    // unlike executeApprovedActions which returns ActionResult (without those fields).
    const mutationStr = QUEUE_ACTIONS_MUTATION as string
    expect(mutationStr).toContain('createdAt')
    expect(mutationStr).toContain('updatedAt')
  })

  it('ACTIONS_QUERY requests createdAt/updatedAt (full Action type)', () => {
    const queryStr = ACTIONS_QUERY as string
    expect(queryStr).toContain('createdAt')
    expect(queryStr).toContain('updatedAt')
  })
})
