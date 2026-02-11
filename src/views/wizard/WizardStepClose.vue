<script setup lang="ts">
import { computed, h } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'
import { formatUnits } from 'viem'

// PrimeVue components
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

// Project components
import {
  DataTable,
  TokenCell,
  PercentCell,
  HealthCell,
} from '@/components/DataTable'

// Composables
import {
  useAllocationsQuery,
  useNetworkQuery,
  useStatusQuery,
  useIndexerQuery,
  useEpochQuery,
  useRewardsQuery,
  useAllocationComputations,
} from '@/composables'
import type { AllocationDescriptor } from '@/composables'

// Stores
import { useFilterStore, useWizardStore, useChainStore } from '@/stores'

// Types
import type { AllocationComputed, AllocationRaw, HealthStatus } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'
import { weiToGrt } from '@/services/calculations/tokenMath'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const filterStore = useFilterStore()
const wizardStore = useWizardStore()
const chainStore = useChainStore()

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const allocationsQuery = useAllocationsQuery()
const networkQuery = useNetworkQuery()
const statusQuery = useStatusQuery()
const indexerQuery = useIndexerQuery()
const epochQuery = useEpochQuery()

// ---------------------------------------------------------------------------
// Rewards query (on-demand)
// ---------------------------------------------------------------------------
const allocationDescriptors = computed<AllocationDescriptor[]>(() => {
  const raw = allocationsQuery.data.value
  if (!raw) return []
  return raw.map((a) => ({
    id: a.id as `0x${string}`,
    isLegacy: a.isLegacy,
  }))
})

const rewardsQuery = useRewardsQuery(allocationDescriptors)

const rewardsFetched = computed(
  () => rewardsQuery.isSuccess.value || rewardsQuery.isError.value,
)

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------
const { computed: computedAllocations } = useAllocationComputations({
  allocations: computed(() => allocationsQuery.data.value),
  networkMetrics: computed(() => networkQuery.data.value),
  statuses: computed(() => statusQuery.data.value),
  indexingRewardCut: computed(
    () => indexerQuery.data.value?.indexingRewardCut ?? 0,
  ),
  blocksPerDay: computed(() => chainStore.chainConfig.blocksPerDay),
  pendingRewardsMap: computed(() => rewardsQuery.data.value),
  rewardsLoading: computed(() => rewardsQuery.isFetching.value),
  rewardsFetched,
  qosData: computed(() => undefined),
  epochData: computed(() => epochQuery.data.value),
  otherIndexersStatus: computed(() => undefined),
})

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
const filteredAllocations = computed(() => {
  const all = computedAllocations.value
  const search = filterStore.allocationFilters.search.toLowerCase().trim()
  if (!search) return all

  return all.filter((alloc) => {
    const d = alloc.subgraphDeployment
    const name = getDeploymentName(alloc)
    return (
      name.toLowerCase().includes(search) ||
      d.ipfsHash.toLowerCase().includes(search) ||
      alloc.id.toLowerCase().includes(search)
    )
  })
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
const isLoading = computed(
  () => allocationsQuery.isLoading.value || networkQuery.isLoading.value,
)

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------
const totalCount = computed(() => allocationsQuery.data.value?.length ?? 0)
const filteredCount = computed(() => filteredAllocations.value.length)

// ---------------------------------------------------------------------------
// Selection — sync with wizardStore.closingAllocations
// ---------------------------------------------------------------------------

/** Derive the selected keys Set from the wizard store Map */
const selectedKeys = computed<Set<string>>(
  () => new Set(wizardStore.closingAllocations.keys()),
)

/** Build a lookup from allocation ID to AllocationRaw from the query data */
const allocationsById = computed<Map<string, AllocationRaw>>(() => {
  const map = new Map<string, AllocationRaw>()
  const raw = allocationsQuery.data.value
  if (!raw) return map
  for (const alloc of raw) {
    map.set(alloc.id, alloc)
  }
  return map
})

/**
 * When the DataTable emits a selection change, rebuild the wizard store Map
 * by looking up each selected ID in the raw allocations data.
 */
function handleSelectionChange(ids: Set<string>) {
  const newMap = new Map<string, AllocationRaw>()
  for (const id of ids) {
    const raw = allocationsById.value.get(id)
    if (raw) {
      newMap.set(id, raw)
    }
  }
  wizardStore.setClosingAllocations(newMap)
}

function getRowId(row: AllocationComputed) {
  return row.id
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a display name for a deployment */
function getDeploymentName(alloc: AllocationComputed): string {
  const d = alloc.subgraphDeployment
  if (d.originalName) return d.originalName
  const firstVersion = d.versions?.[0]
  const displayName = firstVersion?.subgraph?.metadata?.displayName
  if (displayName) return displayName
  return d.ipfsHash.slice(0, 8)
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<AllocationComputed>()

const columns: ColumnDef<AllocationComputed, any>[] = [
  // 1. Deployment Name
  columnHelper.accessor(
    (row) => getDeploymentName(row),
    {
      id: 'name',
      header: 'Name',
      size: 250,
      cell: (info) => {
        const row = info.row.original
        const name = getDeploymentName(row)
        const hash = row.subgraphDeployment.ipfsHash.slice(0, 8)
        return h('div', { class: 'name-cell' }, [
          h('span', { class: 'name-primary' }, name),
          h('span', { class: 'name-hash' }, hash),
        ])
      },
    },
  ),

  // 2. Network
  columnHelper.accessor(
    (row) => row.subgraphDeployment.manifest.network ?? 'unknown',
    {
      id: 'network',
      header: 'Network',
      size: 120,
      cell: (info) => {
        const val = info.getValue() as string
        return h('span', { class: 'network-cell' }, val)
      },
    },
  ),

  // 3. Allocated (GRT)
  columnHelper.accessor((row) => row.allocatedTokens, {
    id: 'allocated',
    header: 'Allocated (GRT)',
    size: 150,
    cell: (info) =>
      h(TokenCell, { value: info.getValue() as string, decimals: 0 }),
  }),

  // 4. APR (%)
  columnHelper.accessor('apr', {
    id: 'apr',
    header: 'APR (%)',
    size: 100,
    cell: (info) =>
      h(PercentCell, { value: info.getValue() as number, decimals: 2 }),
  }),

  // 5. Daily Rewards (GRT)
  columnHelper.accessor('dailyRewardsCut', {
    id: 'dailyRewardsCut',
    header: 'Daily Rewards (GRT)',
    size: 160,
    cell: (info) => {
      const val = info.getValue() as number
      // dailyRewardsCut is in wei, convert to GRT for display
      const grt = weiToGrt(String(val))
      return h(
        'span',
        { class: 'token-value' },
        `${formatNumber(grt, 0)} GRT`,
      )
    },
  }),

  // 6. Duration (days)
  columnHelper.accessor('duration', {
    id: 'duration',
    header: 'Duration',
    size: 100,
    cell: (info) => {
      const days = info.getValue() as number
      const daysRounded = Math.floor(days)
      let colorClass = 'duration-green'
      if (days >= 28) {
        colorClass = 'duration-red'
      } else if (days >= 14) {
        colorClass = 'duration-yellow'
      }
      return h(
        'span',
        { class: `duration-cell ${colorClass}` },
        `${daysRounded}d`,
      )
    },
  }),

  // 7. Pending Rewards (GRT)
  columnHelper.accessor(
    (row) => row.pendingRewards,
    {
      id: 'pendingRewards',
      header: 'Pending (GRT)',
      size: 150,
      cell: (info) => {
        const pr = info.getValue() as AllocationComputed['pendingRewards']
        if (pr.loading) {
          return h('span', { class: 'pending-loading' }, [
            h('span', { class: 'spinner' }),
          ])
        }
        if (!pr.loaded) {
          return h('span', { class: 'text-muted' }, '?')
        }
        const grt = Number(formatUnits(pr.value, 18))
        return h(
          'span',
          { class: 'token-value' },
          `${formatNumber(grt, 0)} GRT`,
        )
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.pendingRewards
        const b = rowB.original.pendingRewards
        if (!a.loaded && !b.loaded) return 0
        if (!a.loaded) return -1
        if (!b.loaded) return 1
        if (a.value < b.value) return -1
        if (a.value > b.value) return 1
        return 0
      },
    },
  ),

  // 8. Pending Rewards After Cut (GRT)
  columnHelper.accessor(
    (row) => row.pendingRewards,
    {
      id: 'pendingRewardsCut',
      header: 'Pending Cut (GRT)',
      size: 160,
      cell: (info) => {
        const pr = info.getValue() as AllocationComputed['pendingRewards']
        if (pr.loading) {
          return h('span', { class: 'pending-loading' }, [
            h('span', { class: 'spinner' }),
          ])
        }
        if (!pr.loaded) {
          return h('span', { class: 'text-muted' }, '?')
        }
        const cut = indexerQuery.data.value?.indexingRewardCut ?? 0
        const afterCut = (pr.value * BigInt(cut)) / 1_000_000n
        const grt = Number(formatUnits(afterCut, 18))
        return h(
          'span',
          { class: 'token-value' },
          `${formatNumber(grt, 0)} GRT`,
        )
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.pendingRewards
        const b = rowB.original.pendingRewards
        if (!a.loaded && !b.loaded) return 0
        if (!a.loaded) return -1
        if (!b.loaded) return 1
        if (a.value < b.value) return -1
        if (a.value > b.value) return 1
        return 0
      },
    },
  ),

  // 9. Health (from graph-node status endpoint)
  columnHelper.accessor(
    (row) =>
      (row.deploymentStatus?.health ?? null) as HealthStatus | null,
    {
      id: 'health',
      header: 'Health',
      size: 100,
      cell: (info) => {
        const val = info.getValue() as HealthStatus | null
        return h(HealthCell, { status: val })
      },
    },
  ),

  // 8. Status checks (multi-indicator with colored dots)
  columnHelper.accessor(
    (row) => row.statusChecks,
    {
      id: 'status',
      header: 'Status',
      size: 200,
      cell: (info) => {
        const row = info.row.original
        const sc = row.statusChecks

        const indicators: ReturnType<typeof h>[] = []

        // Synced indicator (EBO epoch check)
        if (sc.synced !== null) {
          indicators.push(
            h('span', {
              class: 'status-check',
              title: sc.synced ? 'Synced to epoch' : 'Behind epoch',
            }, [
              h('span', { class: `dot ${sc.synced ? 'dot-green' : 'dot-red'}` }),
              h('span', { class: 'check-label' }, 'Synced'),
            ]),
          )
        }

        // Other indexers health comparison
        if (sc.healthyCount > 0 || sc.failedCount > 0) {
          indicators.push(
            h('span', {
              class: 'status-check',
              title: `Other indexers: ${sc.healthyCount} healthy, ${sc.failedCount} failed`,
            }, [
              h('span', { class: `dot ${sc.healthComparison ? 'dot-green' : 'dot-red'}` }),
              h('span', { class: 'check-label' }, `${sc.healthyCount}/${sc.failedCount}`),
            ]),
          )
        }

        // Deterministic failure
        if (sc.deterministicFailure !== null && sc.deterministicFailure) {
          indicators.push(
            h('span', {
              class: 'status-check',
              title: sc.closable
                ? 'Deterministic failure - safe to close'
                : 'Deterministic failure - not safe to close',
            }, [
              h('span', { class: `dot ${sc.closable ? 'dot-yellow' : 'dot-red'}` }),
              h('span', { class: 'check-label' }, 'Det.'),
            ]),
          )
        }

        // Closable composite indicator
        indicators.push(
          h('span', {
            class: 'status-check',
            title: sc.closable ? 'Safe to close' : 'Not safe to close',
          }, [
            h('span', { class: `dot ${sc.closable ? 'dot-green' : 'dot-red'}` }),
            h('span', { class: 'check-label' }, 'Close'),
          ]),
        )

        return h('div', { class: 'status-indicators' }, indicators)
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.statusChecks.closable ? 1 : 0
        const b = rowB.original.statusChecks.closable ? 1 : 0
        return a - b
      },
    },
  ),
]
</script>

<template>
  <div class="wizard-step-close">
    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-item filter-search">
        <InputText
          v-model="filterStore.allocationFilters.search"
          placeholder="Search name, IPFS hash, or allocation ID..."
          class="filter-input"
        />
      </div>
      <Button
        label="Fetch Rewards"
        icon="pi pi-download"
        severity="info"
        outlined
        size="small"
        :loading="rewardsQuery.isFetching.value"
        @click="rewardsQuery.refetch()"
      />
      <span class="row-count">
        {{ filteredCount }} / {{ totalCount }} allocations
      </span>
    </div>

    <!-- Data table -->
    <div class="table-wrapper">
      <DataTable
        :data="filteredAllocations"
        :columns="columns"
        :loading="isLoading"
        :enable-selection="true"
        :selected-keys="selectedKeys"
        :get-row-id="getRowId"
        table-height="100%"
        empty-message="No allocations found. Try adjusting your search filter."
        @selection-change="handleSelectionChange"
      />
    </div>
  </div>
</template>

<style scoped>
.wizard-step-close {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

/* --- Filter bar --- */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 10px 14px;
  background-color: var(--app-surface-50);
  border: 1px solid var(--app-surface-200);
  border-radius: 10px;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-search {
  flex: 0 1 360px;
  min-width: 200px;
}

.filter-input {
  width: 100%;
}

.row-count {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  margin-left: auto;
  white-space: nowrap;
}

/* --- Table wrapper --- */
.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* --- Cell styles --- */
:deep(.name-cell) {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
}

:deep(.name-primary) {
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.name-hash) {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.network-cell) {
  font-size: 0.8125rem;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.token-value) {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.text-muted) {
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Status indicators with colored dots --- */
:deep(.status-indicators) {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  overflow: hidden;
}

:deep(.status-check) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

:deep(.dot) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

:deep(.dot-green) {
  background-color: var(--p-green-400);
}

:deep(.dot-yellow) {
  background-color: var(--p-yellow-400);
}

:deep(.dot-red) {
  background-color: var(--p-red-400);
}

:deep(.check-label) {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
}

/* --- Duration color coding --- */
:deep(.duration-cell) {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.duration-green) {
  color: var(--p-green-400);
}

:deep(.duration-yellow) {
  color: var(--p-yellow-400);
}

:deep(.duration-red) {
  color: var(--p-red-400);
}

/* --- Pending rewards loading spinner --- */
:deep(.pending-loading) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
  max-width: 100%;
  overflow: hidden;
}

:deep(.spinner) {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--app-surface-300);
  border-top-color: var(--p-primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
