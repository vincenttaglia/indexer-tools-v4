<script setup lang="ts">
import { computed, h } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'

// PrimeVue components
import InputText from 'primevue/inputtext'

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
  useAllocationComputations,
} from '@/composables'

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
  // No rewards in wizard close step — keep lightweight
  pendingRewardsMap: computed(() => undefined),
  rewardsLoading: computed(() => false),
  rewardsFetched: computed(() => false),
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

  // 7. Status
  columnHelper.accessor(
    (row) =>
      (row.deploymentStatus?.health ?? null) as HealthStatus | null,
    {
      id: 'status',
      header: 'Status',
      size: 120,
      cell: (info) => {
        const val = info.getValue() as HealthStatus | null
        return h(HealthCell, { status: val })
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
</style>
