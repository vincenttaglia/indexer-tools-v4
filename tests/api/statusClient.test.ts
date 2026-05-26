import { describe, it, expect } from 'vitest'
import { normalizeDeploymentStatus } from '@/api/status/client'
import type { DeploymentStatus } from '@/types'

/**
 * Regression test for the bug where graph-node returns block numbers as
 * BigInt JSON strings, and downstream `>=` comparisons against those
 * strings are lexicographic — so "69820004" >= "466983967" evaluated to
 * true and a subgraph 397M blocks behind chain head was reported as
 * fully synced and closable.
 *
 * The fix coerces all block-number fields to numbers at the parse
 * boundary so every consumer sees real numbers.
 */
describe('normalizeDeploymentStatus', () => {
  function makeRawStatus(overrides: Partial<DeploymentStatus> = {}): DeploymentStatus {
    return {
      subgraph: 'QmTest',
      synced: true,
      health: 'healthy',
      entityCount: '1000',
      fatalError: null,
      node: 'index-node-0',
      chains: [
        {
          // graph-node returns these as strings even though our types say number
          latestBlock: { number: '69820004' as unknown as number },
          chainHeadBlock: { number: '466983967' as unknown as number },
          earliestBlock: { number: '69820004' as unknown as number },
        },
      ],
      ...overrides,
    }
  }

  it('coerces chain block numbers from strings to numbers', () => {
    const normalized = normalizeDeploymentStatus(makeRawStatus())
    const chain = normalized.chains[0]!
    expect(typeof chain.latestBlock!.number).toBe('number')
    expect(typeof chain.chainHeadBlock!.number).toBe('number')
    expect(typeof chain.earliestBlock!.number).toBe('number')
    expect(chain.latestBlock!.number).toBe(69820004)
    expect(chain.chainHeadBlock!.number).toBe(466983967)
  })

  it('produces values where numeric >= behaves correctly', () => {
    // The regression: "69820004" >= "466983967" is true (lexicographic).
    // After normalization the comparison must be numeric.
    const normalized = normalizeDeploymentStatus(makeRawStatus())
    const latest = normalized.chains[0]!.latestBlock!.number
    const head = normalized.chains[0]!.chainHeadBlock!.number
    expect(latest >= head).toBe(false)
    expect(latest < head).toBe(true)
  })

  it('preserves null block fields as null', () => {
    const raw = makeRawStatus({
      chains: [
        {
          latestBlock: null,
          chainHeadBlock: null,
          earliestBlock: null,
        },
      ],
    })
    const normalized = normalizeDeploymentStatus(raw)
    const chain = normalized.chains[0]!
    expect(chain.latestBlock).toBeNull()
    expect(chain.chainHeadBlock).toBeNull()
    expect(chain.earliestBlock).toBeNull()
  })

  it('coerces a fatal error block number from string to number', () => {
    const raw = makeRawStatus({
      fatalError: {
        message: 'boom',
        deterministic: true,
        block: {
          hash: '0xabc',
          number: '12345678' as unknown as number,
        },
      },
    })
    const normalized = normalizeDeploymentStatus(raw)
    expect(typeof normalized.fatalError!.block!.number).toBe('number')
    expect(normalized.fatalError!.block!.number).toBe(12345678)
  })

  it('falls back to 0 for unparseable block numbers', () => {
    const raw = makeRawStatus({
      chains: [
        {
          latestBlock: { number: 'not-a-number' as unknown as number },
          chainHeadBlock: { number: 100 },
          earliestBlock: { number: 50 },
        },
      ],
    })
    const normalized = normalizeDeploymentStatus(raw)
    // Unparseable → 0 (matches the user's "missing should mean zero" intent).
    expect(normalized.chains[0]!.latestBlock!.number).toBe(0)
  })

  it('preserves non-block fields untouched', () => {
    const raw = makeRawStatus({
      subgraph: 'QmFoo',
      synced: false,
      health: 'unhealthy',
      entityCount: '42',
      node: 'index-node-3',
    })
    const normalized = normalizeDeploymentStatus(raw)
    expect(normalized.subgraph).toBe('QmFoo')
    expect(normalized.synced).toBe(false)
    expect(normalized.health).toBe('unhealthy')
    expect(normalized.entityCount).toBe('42')
    expect(normalized.node).toBe('index-node-3')
  })
})
