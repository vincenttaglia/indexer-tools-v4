<script setup lang="ts">
import { computed, ref, h } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'

// PrimeVue components
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
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
  useSubgraphFilters,
  useSubgraphComputations,
} from '@/composables'

// Stores
import { useFilterStore, useWizardStore, useChainStore } from '@/stores'

// Types
import type { SubgraphComputed, HealthStatus } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const filterStore = useFilterStore()
const wizardStore = useWizardStore()
const chainStore = useChainStore()

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const subgraphsQuery = useSubgraphsQuery()
const networkQuery = useNetworkQuery()
const allocationsQuery = useAllocationsQuery()
const statusQuery = useStatusQuery()
const indexerQuery = useIndexerQuery()

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
  const sorted = [...networks].sort()
  return [
    { label: 'All Networks', value: null },
    ...sorted.map((n) => ({ label: n, value: n })),
  ]
})

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
const { filtered: filteredSubgraphs } = useSubgraphFilters(
  computed(() => subgraphsQuery.data.value),
  allocatedDeployments,
)

// ---------------------------------------------------------------------------
// Computation inputs
// ---------------------------------------------------------------------------
const targetApr = ref(10)
const newAllocation = ref('0')

const { computed: computedSubgraphs } = useSubgraphComputations({
  subgraphs: filteredSubgraphs,
  networkMetrics: computed(() => networkQuery.data.value),
  statuses: computed(() => statusQuery.data.value),
  queryFees: computed(() => undefined),
  allocatedDeployments,
  indexingRewardCut: computed(() => indexerQuery.data.value?.indexingRewardCut ?? 0),
  blocksPerDay: computed(() => chainStore.chainConfig.blocksPerDay),
  targetApr,
  newAllocation,
  closingAllocations: computed(() => wizardStore.closingAllocations),
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
// Selection — sync with wizardStore.selectedDeployments
// ---------------------------------------------------------------------------
function handleSelectionChange(ids: Set<string>) {
  const current = wizardStore.selectedDeployments
  for (const key of current) {
    if (!ids.has(key)) wizardStore.toggleDeployment(key)
  }
  for (const key of ids) {
    if (!current.has(key)) wizardStore.toggleDeployment(key)
  }
}

function getRowId(row: SubgraphComputed) {
  return row.deployment.ipfsHash
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<SubgraphComputed>()

const columns: ColumnDef<SubgraphComputed, unknown>[] = [
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
  columnHelper.accessor('apr', {
    id: 'apr',
    header: 'APR (%)',
    size: 100,
    cell: (info) =>
      h(PercentCell, { value: info.getValue() as number, decimals: 2 }),
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
]
</script>

<template>
  <div class="step-select">
    <!-- Header -->
    <div class="step-header">
      <div class="header-left">
        <h2 class="step-title">Select Subgraphs</h2>
        <span class="row-count">
          {{ filteredCount }} / {{ totalCount }}
        </span>
        <span v-if="wizardStore.selectedDeployments.size > 0" class="selection-count">
          ({{ wizardStore.selectedDeployments.size }} selected)
        </span>
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

      <div class="filter-item filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.hideDenied" />
          <span>Hide Denied</span>
        </label>
      </div>

      <div class="filter-item filter-toggle filter-signal-group">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.hideSmallSignal" />
          <span>Hide Small Signal</span>
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

      <div class="filter-item filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.onlyAllocated" />
          <span>Only Allocated</span>
        </label>
      </div>

      <div class="filter-item filter-network">
        <Select
          v-model="filterStore.subgraphFilters.network"
          :options="networkOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="All Networks"
          class="network-select"
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
        :selected-keys="wizardStore.selectedDeployments"
        :get-row-id="getRowId"
        table-height="100%"
        empty-message="No subgraphs found."
        @selection-change="handleSelectionChange"
      />
    </div>
  </div>
</template>

<style scoped>
.step-select {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

/* --- Header --- */
.step-header {
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

.step-title {
  font-size: 1.125rem;
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

.selection-count {
  font-size: 0.8125rem;
  color: var(--p-primary-color);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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

.filter-network {
  min-width: 160px;
}

.network-select {
  width: 100%;
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
