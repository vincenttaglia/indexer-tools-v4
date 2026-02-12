<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'

// PrimeVue components
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'

// Project components
import { DataTable, HealthCell, AddressCell, ErrorDetailCell } from '@/components/DataTable'

// Composables
import { useStatusQuery } from '@/composables'

// Types
import type { DeploymentStatus, HealthStatus } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const statusQuery = useStatusQuery()

// ---------------------------------------------------------------------------
// Local filter state
// ---------------------------------------------------------------------------
const search = ref('')
const showUnhealthyOnly = ref(false)

// ---------------------------------------------------------------------------
// Flatten Map to array
// ---------------------------------------------------------------------------
const allDeployments = computed<DeploymentStatus[]>(() => {
  const map = statusQuery.data.value
  if (!map) return []
  return Array.from(map.values())
})

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
const filteredDeployments = computed(() => {
  let list = allDeployments.value

  // Filter unhealthy only
  if (showUnhealthyOnly.value) {
    list = list.filter((d) => d.health !== 'healthy')
  }

  // Search filter
  const term = search.value.toLowerCase().trim()
  if (term) {
    list = list.filter((d) => {
      return (
        d.subgraph.toLowerCase().includes(term) ||
        (d.node ?? '').toLowerCase().includes(term)
      )
    })
  }

  return list
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
const isLoading = computed(() => statusQuery.isLoading.value)

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------
const totalCount = computed(() => allDeployments.value.length)
const filteredCount = computed(() => filteredDeployments.value.length)

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------
function refreshAll() {
  statusQuery.refetch()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the latest block number from the first chain status */
function getLatestBlock(status: DeploymentStatus): number | null {
  const chain = status.chains[0]
  return chain?.latestBlock?.number ?? null
}

/** Get the chain head block number from the first chain status */
function getChainHeadBlock(status: DeploymentStatus): number | null {
  const chain = status.chains[0]
  return chain?.chainHeadBlock?.number ?? null
}

/** Calculate blocks behind */
function getBlocksBehind(status: DeploymentStatus): number | null {
  const latest = getLatestBlock(status)
  const chainHead = getChainHeadBlock(status)
  if (latest === null || chainHead === null) return null
  return Math.max(0, chainHead - latest)
}

// ---------------------------------------------------------------------------
// Row ID
// ---------------------------------------------------------------------------
function getRowId(row: DeploymentStatus) {
  return row.subgraph
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<DeploymentStatus>()

const columns: ColumnDef<DeploymentStatus, any>[] = [
  // 1. Deployment (IPFS hash, shortened with copy)
  columnHelper.accessor('subgraph', {
    id: 'deployment',
    header: 'Deployment',
    size: 200,
    cell: (info) => {
      const hash = info.getValue() as string
      return h(AddressCell, { address: hash })
    },
  }),

  // 2. Node
  columnHelper.accessor('node', {
    id: 'node',
    header: 'Node',
    size: 140,
    cell: (info) => {
      const val = info.getValue() as string | null
      if (!val) return h('span', { class: 'text-muted' }, '-')
      return h('span', { class: 'node-cell' }, val)
    },
  }),

  // 3. Network/Chain (derived from node field)
  columnHelper.accessor(
    (row) => row.node ?? 'unknown',
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

  // 4. Health
  columnHelper.accessor('health', {
    id: 'health',
    header: 'Health',
    size: 120,
    cell: (info) => {
      const val = info.getValue() as HealthStatus
      return h(HealthCell, { status: val })
    },
  }),

  // 5. Synced
  columnHelper.accessor('synced', {
    id: 'synced',
    header: 'Synced',
    size: 90,
    cell: (info) => {
      const val = info.getValue() as boolean
      return h(
        'span',
        { class: val ? 'synced-yes' : 'synced-no' },
        val ? 'Yes' : 'No',
      )
    },
  }),

  // 6. Latest Block
  columnHelper.accessor(
    (row) => getLatestBlock(row),
    {
      id: 'latestBlock',
      header: 'Latest Block',
      size: 130,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')
        return h('span', { class: 'block-number' }, formatNumber(val, 0))
      },
    },
  ),

  // 7. Chain Head Block
  columnHelper.accessor(
    (row) => getChainHeadBlock(row),
    {
      id: 'chainHeadBlock',
      header: 'Chain Head',
      size: 130,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')
        return h('span', { class: 'block-number' }, formatNumber(val, 0))
      },
    },
  ),

  // 8. Blocks Behind (color-coded)
  columnHelper.accessor(
    (row) => getBlocksBehind(row),
    {
      id: 'blocksBehind',
      header: 'Blocks Behind',
      size: 130,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')

        let colorClass = 'behind-green'
        if (val > 1000) {
          colorClass = 'behind-red'
        } else if (val > 100) {
          colorClass = 'behind-yellow'
        }

        return h(
          'span',
          { class: `blocks-behind ${colorClass}` },
          formatNumber(val, 0),
        )
      },
    },
  ),

  // 9. Fatal Error (clickable with popover detail)
  columnHelper.accessor('fatalError', {
    id: 'fatalError',
    header: 'Fatal Error',
    size: 200,
    cell: (info) => {
      const err = info.getValue() as DeploymentStatus['fatalError']
      if (!err) return h('span', { class: 'text-muted' }, '-')

      return h(ErrorDetailCell, { fatalError: err })
    },
  }),
]
</script>

<template>
  <div class="deployment-status-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1 class="page-title">Deployment Status</h1>
        <span class="row-count">
          {{ filteredCount }} / {{ totalCount }}
        </span>
      </div>
      <div class="header-right">
        <Button
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          :loading="isLoading"
          @click="refreshAll"
        />
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-item filter-search">
        <InputText
          v-model="search"
          placeholder="Search by deployment hash or node..."
          class="filter-input"
        />
      </div>
      <div class="filter-item">
        <label class="toggle-label">
          <ToggleSwitch v-model="showUnhealthyOnly" />
          <span>Unhealthy only</span>
        </label>
      </div>
    </div>

    <!-- Data table -->
    <div class="table-wrapper">
      <DataTable
        :data="filteredDeployments"
        :columns="columns"
        :loading="isLoading"
        :get-row-id="getRowId"
        table-height="100%"
        empty-message="No deployments found. Try adjusting your filters."
      />
    </div>
  </div>
</template>

<style scoped>
.deployment-status-dashboard {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 24px;
  overflow: hidden;
}

/* --- Header --- */
.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0;
  letter-spacing: -0.01em;
}

.row-count {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* --- Filter bar --- */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 12px 16px;
  background-color: var(--app-surface-50);
  border: 1px solid var(--app-surface-200);
  border-radius: 12px;
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

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: var(--p-text-color);
  cursor: pointer;
  user-select: none;
}

/* --- Table wrapper --- */
.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* --- Cell styles --- */
:deep(.text-muted) {
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
  white-space: nowrap;
}

:deep(.node-cell) {
  font-size: 0.8125rem;
  color: var(--p-text-color);
  white-space: nowrap;
}

:deep(.network-cell) {
  font-size: 0.8125rem;
  color: var(--p-text-color);
  white-space: nowrap;
}

:deep(.synced-yes) {
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--p-green-400);
  white-space: nowrap;
}

:deep(.synced-no) {
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--p-red-400);
  white-space: nowrap;
}

:deep(.block-number) {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
  color: var(--p-text-color);
}

:deep(.blocks-behind) {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
}

:deep(.behind-green) {
  color: var(--p-green-400);
}

:deep(.behind-yellow) {
  color: var(--p-yellow-400);
}

:deep(.behind-red) {
  color: var(--p-red-400);
}

</style>
