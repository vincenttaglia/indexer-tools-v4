<script setup lang="ts">
import { computed, h } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'
import { storeToRefs } from 'pinia'

// PrimeVue components
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import ToggleSwitch from 'primevue/toggleswitch'
import InputNumber from 'primevue/inputnumber'

// Project components
import { DataTable, TokenCell, PercentCell, HealthCell } from '@/components/DataTable'

// Composables
import {
  useSubgraphsQuery,
  useNetworkQuery,
  useAllocationsQuery,
  useStatusQuery,
  useIndexerQuery,
  useQueryFeesQuery,
  useSubgraphFilters,
  useSubgraphComputations,
} from '@/composables'

// Stores
import { useFilterStore, useSelectionStore, useChainStore } from '@/stores'

// Types
import type { SubgraphComputed, QueryFeeData, HealthStatus } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'
import { weiToGrt } from '@/services/calculations'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const filterStore = useFilterStore()
const selectionStore = useSelectionStore()
const chainStore = useChainStore()

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const subgraphsQuery = useSubgraphsQuery()
const networkQuery = useNetworkQuery()
const allocationsQuery = useAllocationsQuery()
const statusQuery = useStatusQuery()
const indexerQuery = useIndexerQuery()
const queryFeesQuery = useQueryFeesQuery()

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

/** Set of IPFS hashes that the indexer currently has allocations on */
const allocatedDeployments = computed(() => {
  const allocations = allocationsQuery.data.value
  if (!allocations) return new Set<string>()
  return new Set(allocations.map((a) => a.subgraphDeployment.ipfsHash))
})

/** Unique networks from the raw subgraph data, for the network filter dropdown */
const networkOptions = computed(() => {
  const raw = subgraphsQuery.data.value ?? []
  const networks = new Set<string>()
  for (const sg of raw) {
    const net = sg.deployment.manifest.network
    if (net) networks.add(net)
  }
  return [...networks].sort()
})

/** Transform QueryDailyDataPoint[] into Map<string, QueryFeeData> */
const queryFeesMap = computed<Map<string, QueryFeeData> | undefined>(() => {
  const points = queryFeesQuery.data.value
  if (!points) return undefined
  const map = new Map<string, QueryFeeData>()
  for (const p of points) {
    map.set(p.subgraphDeployment.id, {
      avgQueryFee: Number(p.avg_query_fee),
      totalQueryFees: weiToGrt(p.total_query_fees),
      queryCount: p.query_count,
      avgGatewayLatencyMs: p.avg_gateway_latency_ms,
      successRate: p.gateway_query_success_rate,
    })
  }
  return map
})

// ---------------------------------------------------------------------------
// Status filter options
// ---------------------------------------------------------------------------
const statusFilterOptions = [
  { label: 'No Filter', value: 'none' },
  { label: 'All Statuses', value: 'all' },
  { label: 'Closable', value: 'closable' },
  { label: 'Healthy & Synced', value: 'healthy-synced' },
  { label: 'Syncing', value: 'syncing' },
  { label: 'Failed', value: 'failed' },
  { label: 'Non-Deterministic', value: 'non-deterministic' },
  { label: 'Deterministic', value: 'deterministic' },
]

// ---------------------------------------------------------------------------
// Rewards filter options (3-way)
// ---------------------------------------------------------------------------
const rewardsFilterOptions = [
  { label: 'Exclude Denied', value: 0 },
  { label: 'Include Denied', value: 1 },
  { label: 'Only Denied', value: 2 },
]

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
const { filtered: filteredSubgraphs } = useSubgraphFilters(
  computed(() => subgraphsQuery.data.value),
  allocatedDeployments,
  computed(() => statusQuery.data.value),
)

// ---------------------------------------------------------------------------
// Computation inputs
// ---------------------------------------------------------------------------
const targetApr = computed(() => filterStore.subgraphFilters.targetApr)
const newAllocation = computed(() => String(filterStore.subgraphFilters.newAllocation))

const { computed: computedSubgraphs } = useSubgraphComputations({
  subgraphs: filteredSubgraphs,
  networkMetrics: computed(() => networkQuery.data.value),
  statuses: computed(() => statusQuery.data.value),
  queryFees: queryFeesMap,
  allocatedDeployments,
  indexingRewardCut: computed(() => indexerQuery.data.value?.indexingRewardCut ?? 0),
  blocksPerDay: computed(() => chainStore.chainConfig.blocksPerDay),
  targetApr,
  newAllocation,
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
const isLoading = computed(
  () => subgraphsQuery.isLoading.value || networkQuery.isLoading.value,
)

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------
const totalCount = computed(() => subgraphsQuery.data.value?.length ?? 0)
const filteredCount = computed(() => computedSubgraphs.value.length)

// ---------------------------------------------------------------------------
// Refresh all queries
// ---------------------------------------------------------------------------
const isArbitrum = computed(() => chainStore.selectedChain === 'arbitrum-one')

function refreshAll() {
  subgraphsQuery.refetch()
  networkQuery.refetch()
  allocationsQuery.refetch()
  statusQuery.refetch()
  indexerQuery.refetch()
  if (isArbitrum.value) queryFeesQuery.refetch()
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
const { selectedSubgraphs } = storeToRefs(selectionStore)

function handleSelectionChange(ids: Set<string>) {
  selectionStore.selectAllSubgraphs([...ids])
}

function getRowId(row: SubgraphComputed) {
  return row.deployment.ipfsHash
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<SubgraphComputed>()

const columns: ColumnDef<SubgraphComputed, any>[] = [
  columnHelper.accessor(
    (row) => {
      const versions = row.deployment.versions
      const meta =
        versions?.[0]?.metadata?.subgraphVersion?.subgraph?.metadata
      return meta?.displayName ?? row.deployment.ipfsHash.slice(0, 8)
    },
    {
      id: 'name',
      header: 'Name',
      size: 250,
      cell: (info) => {
        const row = info.row.original
        const versions = row.deployment.versions
        const meta =
          versions?.[0]?.metadata?.subgraphVersion?.subgraph?.metadata
        const name = meta?.displayName ?? 'Unknown'
        const hash = row.deployment.ipfsHash.slice(0, 8)
        return h('div', { class: 'name-cell' }, [
          h('span', { class: 'name-primary' }, name),
          h('span', { class: 'name-hash' }, hash),
        ])
      },
    },
  ),
  columnHelper.accessor((row) => row.deployment.manifest.network ?? 'unknown', {
    id: 'network',
    header: 'Network',
    size: 120,
    cell: (info) => {
      const val = info.getValue() as string
      return h('span', { class: 'network-cell' }, val)
    },
  }),
  columnHelper.accessor((row) => row.deployment.signalledTokens, {
    id: 'signal',
    header: 'Signal (GRT)',
    size: 140,
    cell: (info) =>
      h(TokenCell, { value: info.getValue() as string, decimals: 0 }),
  }),
  columnHelper.accessor((row) => row.deployment.stakedTokens, {
    id: 'stake',
    header: 'Stake (GRT)',
    size: 140,
    cell: (info) =>
      h(TokenCell, { value: info.getValue() as string, decimals: 0 }),
  }),
  columnHelper.accessor('apr', {
    id: 'apr',
    header: 'APR (%)',
    size: 100,
    cell: (info) =>
      h(PercentCell, { value: info.getValue() as number, decimals: 2 }),
  }),
  columnHelper.accessor('dailyRewardsCut', {
    id: 'dailyRewardsCut',
    header: 'Daily Rewards (GRT)',
    size: 160,
    cell: (info) => {
      const val = info.getValue() as number
      const grt = weiToGrt(String(val))
      return h(
        'span',
        { class: 'token-value' },
        `${formatNumber(grt, 0)} GRT`,
      )
    },
  }),
  columnHelper.accessor('maxAllo', {
    id: 'maxAllo',
    header: 'Max Allo (GRT)',
    size: 140,
    cell: (info) => {
      const val = info.getValue() as number
      if (val === Number.MIN_SAFE_INTEGER || !isFinite(val)) {
        return h('span', { class: 'text-muted' }, '-')
      }
      return h(
        'span',
        { class: 'token-value' },
        `${formatNumber(val, 0)} GRT`,
      )
    },
  }),
  columnHelper.accessor('proportion', {
    id: 'proportion',
    header: 'Proportion',
    size: 110,
    cell: (info) => {
      const val = info.getValue() as number
      return h('span', { class: 'token-value' }, val.toFixed(4))
    },
  }),
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
  columnHelper.accessor('entityCount', {
    id: 'entityCount',
    header: 'Entity Count',
    size: 120,
    cell: (info) => {
      const val = info.getValue() as number | null
      if (val === null || val === undefined) {
        return h('span', { class: 'text-muted' }, '?')
      }
      return h('span', { class: 'token-value' }, formatNumber(val, 0))
    },
  }),
  // QueryFees: Query Count
  columnHelper.accessor(
    (row) => row.queryFees?.queryCount ?? null,
    {
      id: 'queryCount',
      header: 'Queries',
      size: 100,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')
        return h('span', { class: 'token-value' }, formatNumber(val, 0))
      },
    },
  ),
  // QueryFees: Total Fees (GRT)
  columnHelper.accessor(
    (row) => row.queryFees?.totalQueryFees ?? null,
    {
      id: 'totalQueryFees',
      header: 'Query Fees (GRT)',
      size: 130,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')
        return h('span', { class: 'token-value' }, `${formatNumber(val, 4)} GRT`)
      },
    },
  ),
  // QueryFees: Avg Gateway Latency (ms)
  columnHelper.accessor(
    (row) => row.queryFees?.avgGatewayLatencyMs ?? null,
    {
      id: 'avgGatewayLatency',
      header: 'Gw Latency (ms)',
      size: 120,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')
        return h('span', { class: 'token-value' }, `${formatNumber(val, 0)}ms`)
      },
    },
  ),
]
</script>

<template>
  <div class="subgraphs-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1 class="page-title">Subgraphs</h1>
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
          v-model="filterStore.subgraphFilters.search"
          placeholder="Search name or IPFS hash..."
          class="filter-input"
        />
      </div>

      <div class="filter-item filter-rewards">
        <Select
          v-model="filterStore.subgraphFilters.rewardsFilter"
          :options="rewardsFilterOptions"
          optionLabel="label"
          optionValue="value"
          class="rewards-select"
        />
      </div>

      <div class="filter-item filter-status">
        <Select
          v-model="filterStore.subgraphFilters.statusFilter"
          :options="statusFilterOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Status Filter"
          class="status-select"
        />
      </div>

      <div class="filter-item filter-toggle filter-signal-group">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.hideSmallSignal" />
          <span>Min Signal</span>
        </label>
        <InputNumber
          v-if="filterStore.subgraphFilters.hideSmallSignal"
          v-model="filterStore.subgraphFilters.minSignal"
          placeholder="Min GRT"
          class="signal-input"
          :min="0"
          suffix=" GRT"
        />
      </div>

      <div class="filter-item filter-number">
        <label class="field-label-sm">Max Signal</label>
        <InputNumber
          v-model="filterStore.subgraphFilters.maxSignal"
          placeholder="0 = off"
          class="number-input"
          :min="0"
          suffix=" GRT"
        />
      </div>

      <div class="filter-item filter-network">
        <MultiSelect
          v-model="filterStore.subgraphFilters.networks"
          :options="networkOptions"
          placeholder="All Networks"
          class="network-select"
          :maxSelectedLabels="2"
          selectedItemsLabel="{0} networks"
        />
      </div>

      <div class="filter-item filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.onlyAllocated" />
          <span>Only Allocated</span>
        </label>
      </div>

      <div class="filter-item filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.hideCurrentlyAllocated" />
          <span>Hide Allocated</span>
        </label>
      </div>

      <div class="filter-item filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.activateBlacklist" />
          <span>Blacklist</span>
        </label>
      </div>

      <div class="filter-item filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.activateSynclist" />
          <span>Synclist</span>
        </label>
      </div>

      <div class="filter-item filter-number">
        <label class="field-label-sm">Target APR</label>
        <InputNumber
          v-model="filterStore.subgraphFilters.targetApr"
          class="number-input"
          :min="0"
          suffix="%"
        />
      </div>

      <div class="filter-item filter-number">
        <label class="field-label-sm">New Allo</label>
        <InputNumber
          v-model="filterStore.subgraphFilters.newAllocation"
          class="number-input"
          :min="0"
          suffix=" GRT"
        />
      </div>
    </div>

    <!-- Data table -->
    <div class="table-wrapper">
      <DataTable
        :data="computedSubgraphs"
        :columns="columns"
        :loading="isLoading"
        :enable-selection="true"
        :selected-keys="selectedSubgraphs"
        :get-row-id="getRowId"
        table-height="100%"
        empty-message="No subgraphs found. Try adjusting your filters."
        @selection-change="handleSelectionChange"
      />
    </div>
  </div>
</template>

<style scoped>
.subgraphs-dashboard {
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
  flex: 0 1 280px;
  min-width: 180px;
}

.filter-input {
  width: 100%;
}

.filter-toggle {
  white-space: nowrap;
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

.filter-signal-group {
  gap: 12px;
}

.signal-input {
  width: 120px;
}

.filter-rewards {
  min-width: 150px;
}

.rewards-select {
  width: 100%;
}

.filter-status {
  min-width: 160px;
}

.status-select {
  width: 100%;
}

.filter-network {
  min-width: 160px;
}

.network-select {
  width: 100%;
}

.filter-number {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.field-label-sm {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.number-input {
  width: 120px;
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
</style>
