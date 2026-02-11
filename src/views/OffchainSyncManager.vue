<script setup lang="ts">
import { computed, h } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'
import { storeToRefs } from 'pinia'

// PrimeVue components
import Button from 'primevue/button'

// Project components
import { DataTable, HealthCell, AddressCell } from '@/components/DataTable'

// Composables
import { useStatusQuery } from '@/composables'

// Stores
import { useAccountStore } from '@/stores'

// Types
import type { DeploymentStatus, HealthStatus } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const accountStore = useAccountStore()
const { activeAccount } = storeToRefs(accountStore)

// ---------------------------------------------------------------------------
// Endpoint check
// ---------------------------------------------------------------------------
const hasEndpoint = computed(() => !!activeAccount.value?.agentEndpoint)

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const statusQuery = useStatusQuery()

// ---------------------------------------------------------------------------
// Flatten Map to array
// ---------------------------------------------------------------------------
const allDeployments = computed<DeploymentStatus[]>(() => {
  const map = statusQuery.data.value
  if (!map) return []
  return Array.from(map.values())
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
const isLoading = computed(() => statusQuery.isLoading.value)

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------
const totalCount = computed(() => allDeployments.value.length)

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

const columns: ColumnDef<DeploymentStatus, unknown>[] = [
  // 1. Deployment (IPFS hash)
  columnHelper.accessor('subgraph', {
    id: 'deployment',
    header: 'Deployment',
    size: 200,
    cell: (info) => {
      const hash = info.getValue() as string
      return h(AddressCell, { address: hash })
    },
  }),

  // 2. Network (node field)
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

  // 3. Health
  columnHelper.accessor('health', {
    id: 'health',
    header: 'Health',
    size: 120,
    cell: (info) => {
      const val = info.getValue() as HealthStatus
      return h(HealthCell, { status: val })
    },
  }),

  // 4. Synced
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

  // 5. Latest Block
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

  // 6. Blocks Behind (color-coded)
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
]
</script>

<template>
  <div class="offchain-sync-manager">
    <!-- No endpoint message -->
    <div v-if="!hasEndpoint" class="no-endpoint-message">
      <div class="no-endpoint-card">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h2>Graph Node Status Endpoint Not Configured</h2>
        <p>
          To manage offchain sync, configure your graph node status endpoint in
          <strong>Settings</strong>.
        </p>
      </div>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="dashboard-header">
        <div class="header-left">
          <h1 class="page-title">Offchain Sync</h1>
          <span class="row-count">
            {{ totalCount }} deployments
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

      <!-- Data table -->
      <div class="table-wrapper">
        <DataTable
          :data="allDeployments"
          :columns="columns"
          :loading="isLoading"
          :get-row-id="getRowId"
          table-height="100%"
          empty-message="No deployments found. The graph node may not have any indexed subgraphs."
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.offchain-sync-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 24px;
  overflow: hidden;
}

/* --- No endpoint message --- */
.no-endpoint-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.no-endpoint-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px;
  text-align: center;
  color: var(--p-text-muted-color);
}

.no-endpoint-card h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.no-endpoint-card p {
  margin: 0;
  font-size: 0.875rem;
  max-width: 400px;
  line-height: 1.5;
}

.no-endpoint-card svg {
  opacity: 0.3;
  color: var(--p-surface-400);
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
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.blocks-behind) {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
