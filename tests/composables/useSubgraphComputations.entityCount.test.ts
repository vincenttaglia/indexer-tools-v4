import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSubgraphComputations } from '@/composables/useSubgraphComputations'
import type { OtherIndexersHealth } from '@/composables/useOtherIndexersQuery'
import type { SubgraphRaw, NetworkMetrics, DeploymentStatus } from '@/types'

const HASH = 'QmTestDeployment'

function makeSubgraph(): SubgraphRaw {
  return {
    deployment: {
      ipfsHash: HASH,
      signalledTokens: '0',
      stakedTokens: '0',
      manifest: { network: 'mainnet' },
    },
  } as unknown as SubgraphRaw
}

const metrics: NetworkMetrics = {
  totalTokensSignalled: '1',
  networkGRTIssuancePerBlock: '1',
  totalTokensAllocated: '1',
} as unknown as NetworkMetrics

function build(opts: {
  statuses?: Map<string, DeploymentStatus>
  other?: Map<string, OtherIndexersHealth>
}) {
  const { computed } = useSubgraphComputations({
    subgraphs: ref([makeSubgraph()]),
    networkMetrics: ref(metrics),
    statuses: ref(opts.statuses),
    queryFees: ref(undefined),
    allocatedDeployments: ref(new Set<string>()),
    indexingRewardCut: ref(0),
    blocksPerDay: ref(1),
    targetApr: ref(10),
    newAllocation: ref('0'),
    otherIndexersStatus: ref(opts.other),
  })
  return computed.value[0]
}

describe('entityCount fallback to other indexers', () => {
  it('falls back to other indexers max when own status is absent', () => {
    const other = new Map<string, OtherIndexersHealth>([
      [HASH, { healthyCount: 2, failedCount: 0, maxEntityCount: 5000, details: [] }],
    ])
    const row = build({ statuses: new Map(), other })
    expect(row.entityCount).toBe(5000)
    expect(row.entityCountFromOthers).toBe(true)
  })

  it('prefers own status when present', () => {
    const statuses = new Map<string, DeploymentStatus>([
      [HASH, { subgraph: HASH, entityCount: '999', health: 'healthy', synced: true, fatalError: null, node: null, chains: [] }],
    ])
    const other = new Map<string, OtherIndexersHealth>([
      [HASH, { healthyCount: 2, failedCount: 0, maxEntityCount: 5000, details: [] }],
    ])
    const row = build({ statuses, other })
    expect(row.entityCount).toBe(999)
    expect(row.entityCountFromOthers).toBe(false)
  })

  it('stays null when neither own nor others report', () => {
    const row = build({ statuses: new Map(), other: undefined })
    expect(row.entityCount).toBeNull()
    expect(row.entityCountFromOthers).toBe(false)
  })
})
