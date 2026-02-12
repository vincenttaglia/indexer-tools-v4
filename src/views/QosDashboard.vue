<script setup lang="ts">
import { computed, h } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'

// PrimeVue components
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

// Project components
import { DataTable, DeploymentNameCell } from '@/components/DataTable'

// Composables
import { useQosDailyDataQuery, useSubgraphMetadataMap } from '@/composables'

// Stores
import { useFilterStore, useChainStore } from '@/stores'

// Types
import type { AllocationDailyDataPoint } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'
import { weiToGrt } from '@/services/calculations/tokenMath'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const filterStore = useFilterStore()
const chainStore = useChainStore()
const isArbitrum = computed(() => chainStore.selectedChain === 'arbitrum-one')

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const qosQuery = useQosDailyDataQuery()
const { metadataMap } = useSubgraphMetadataMap()

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
const isLoading = computed(() => qosQuery.isLoading.value)

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
const filteredData = computed(() => {
  const all = qosQuery.data.value ?? []
  const search = filterStore.qosFilters.search.toLowerCase().trim()
  if (!search) return all

  return all.filter((row) =>
    row.subgraph_deployment_ipfs_hash.toLowerCase().includes(search) ||
    row.id.toLowerCase().includes(search),
  )
})

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------
const totalCount = computed(() => qosQuery.data.value?.length ?? 0)
const filteredCount = computed(() => filteredData.value.length)

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------
function refreshAll() {
  qosQuery.refetch()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorten an IPFS hash for display */
function shortenHash(hash: string): string {
  return hash
}

/** Color class for blocks behind values */
function blocksBehindColorClass(value: number): string {
  if (value < 10) return 'metric-green'
  if (value <= 100) return 'metric-yellow'
  return 'metric-red'
}

/** Color class for success rate values (proportion is 0-1) */
function successRateColorClass(rate: number): string {
  const pct = rate * 100
  if (pct > 95) return 'metric-green'
  if (pct >= 90) return 'metric-yellow'
  return 'metric-red'
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<AllocationDailyDataPoint>()

const columns: ColumnDef<AllocationDailyDataPoint, any>[] = [
  // 1. Deployment (IPFS hash + subgraph name)
  columnHelper.accessor('subgraph_deployment_ipfs_hash', {
    id: 'deployment',
    header: 'Deployment',
    size: 220,
    cell: (info) => {
      const hash = info.getValue() as string
      const meta = metadataMap.value.get(hash)
      return h(DeploymentNameCell, {
        displayName: meta?.displayName ?? hash,
        ipfsHash: hash,
        imageUrl: meta?.image ?? null,
      })
    },
  }),

  // 2. Chain ID
  columnHelper.accessor('chain_id', {
    id: 'chainId',
    header: 'Chain ID',
    size: 100,
    cell: (info) => h('span', { class: 'chain-cell' }, info.getValue() as string),
  }),

  // 3. Avg Blocks Behind
  columnHelper.accessor('avg_indexer_blocks_behind', {
    id: 'avgBlocksBehind',
    header: 'Avg Blocks Behind',
    size: 160,
    cell: (info) => {
      const val = info.getValue() as number
      return h(
        'span',
        { class: `metric-cell ${blocksBehindColorClass(val)}` },
        formatNumber(val, 1),
      )
    },
  }),

  // 4. Max Blocks Behind
  columnHelper.accessor('max_indexer_blocks_behind', {
    id: 'maxBlocksBehind',
    header: 'Max Blocks Behind',
    size: 160,
    cell: (info) => {
      const val = info.getValue() as number
      return h('span', { class: 'metric-cell' }, formatNumber(val, 0))
    },
  }),

  // 5. Avg Latency (ms)
  columnHelper.accessor('avg_indexer_latency_ms', {
    id: 'avgLatency',
    header: 'Avg Latency (ms)',
    size: 150,
    cell: (info) => {
      const val = info.getValue() as number
      return h('span', { class: 'metric-cell' }, formatNumber(val, 0))
    },
  }),

  // 6. Max Latency (ms)
  columnHelper.accessor('max_indexer_latency_ms', {
    id: 'maxLatency',
    header: 'Max Latency (ms)',
    size: 150,
    cell: (info) => {
      const val = info.getValue() as number
      return h('span', { class: 'metric-cell' }, formatNumber(val, 0))
    },
  }),

  // 7. Avg Query Fee
  columnHelper.accessor('avg_query_fee', {
    id: 'avgQueryFee',
    header: 'Avg Query Fee',
    size: 140,
    cell: (info) => {
      const wei = info.getValue() as string
      const grt = weiToGrt(wei)
      return h(
        'span',
        { class: 'token-value' },
        `${formatNumber(grt, 6)} GRT`,
      )
    },
    sortingFn: (rowA, rowB) => {
      const a = Number(rowA.original.avg_query_fee)
      const b = Number(rowB.original.avg_query_fee)
      return a - b
    },
  }),

  // 8. Query Count
  columnHelper.accessor('query_count', {
    id: 'queryCount',
    header: 'Query Count',
    size: 130,
    cell: (info) => {
      const val = info.getValue() as number
      return h('span', { class: 'metric-cell' }, formatNumber(val, 0))
    },
  }),

  // 9. Total Query Fees
  columnHelper.accessor('total_query_fees', {
    id: 'totalQueryFees',
    header: 'Total Query Fees',
    size: 160,
    cell: (info) => {
      const wei = info.getValue() as string
      const grt = weiToGrt(wei)
      return h(
        'span',
        { class: 'token-value' },
        `${formatNumber(grt, 4)} GRT`,
      )
    },
    sortingFn: (rowA, rowB) => {
      const a = Number(rowA.original.total_query_fees)
      const b = Number(rowB.original.total_query_fees)
      return a - b
    },
  }),

  // 10. Success Rate
  columnHelper.accessor('proportion_indexer_200_responses', {
    id: 'successRate',
    header: 'Success Rate',
    size: 130,
    cell: (info) => {
      const rate = info.getValue() as number
      const pct = rate * 100
      return h(
        'span',
        { class: `metric-cell ${successRateColorClass(rate)}` },
        `${formatNumber(pct, 1)}%`,
      )
    },
  }),
]
</script>

<template>
  <div class="qos-dashboard">
    <!-- Non-Arbitrum notice -->
    <div v-if="!isArbitrum" class="chain-notice">
      <div class="chain-notice-card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h2>QoS Data Not Available</h2>
        <p>QoS metrics are only available for <strong>Arbitrum One</strong>. Switch to Arbitrum in settings to view QoS data.</p>
      </div>
    </div>

    <template v-else>
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1 class="page-title">QoS Metrics</h1>
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
          v-model="filterStore.qosFilters.search"
          placeholder="Search deployment hash or allocation ID..."
          class="filter-input"
        />
      </div>
    </div>

    <!-- Data table -->
    <div class="table-wrapper">
      <DataTable
        :data="filteredData"
        :columns="columns"
        :loading="isLoading"
        table-height="100%"
        empty-message="No QoS data found. Ensure you have an API key configured and active allocations."
      />
    </div>
    </template>
  </div>
</template>

<style scoped>
.qos-dashboard {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 24px;
  overflow: hidden;
}

/* --- Chain notice --- */
.chain-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.chain-notice-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px;
  text-align: center;
  color: var(--p-text-muted-color);
}

.chain-notice-card h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.chain-notice-card p {
  margin: 0;
  font-size: 0.875rem;
  max-width: 400px;
  line-height: 1.5;
}

.chain-notice-card svg {
  opacity: 0.3;
  color: var(--app-surface-400);
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

/* --- Table wrapper --- */
.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* --- Cell styles --- */
:deep(.hash-cell) {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  font-size: 0.75rem;
  color: var(--p-text-color);
  overflow-x: auto;
  white-space: nowrap;
  user-select: all;
  min-width: 0;
}

:deep(.chain-cell) {
  font-size: 0.8125rem;
  color: var(--p-text-color);
  white-space: nowrap;
}

:deep(.metric-cell) {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
  font-weight: 500;
}

:deep(.token-value) {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
  color: var(--p-text-color);
}

/* --- Color coding --- */
:deep(.metric-green) {
  color: var(--p-green-400);
}

:deep(.metric-yellow) {
  color: var(--p-yellow-400);
}

:deep(.metric-red) {
  color: var(--p-red-400);
}
</style>
