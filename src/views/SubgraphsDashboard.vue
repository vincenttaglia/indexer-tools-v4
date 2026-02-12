<script setup lang="ts">
import { computed, h, watchEffect } from 'vue'
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
import StatusCheckDots from '@/components/StatusCheckDots.vue'
import SubgraphNameCell from '@/components/SubgraphNameCell.vue'

// Composables
import {
  useSubgraphsQuery,
  useNetworkQuery,
  useAllocationsQuery,
  useStatusQuery,
  useIndexerQuery,
  useQueryFeesQuery,
  useEpochQuery,
  useOtherIndexersQuery,
  useSubgraphFilters,
  useSubgraphComputations,
  useColumnPreferences,
} from '@/composables'

// Stores
import { useFilterStore, useSelectionStore, useChainStore, useWizardStore, useAccountStore } from '@/stores'

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
const wizardStore = useWizardStore()
const accountStore = useAccountStore()

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const subgraphsQuery = useSubgraphsQuery()
const networkQuery = useNetworkQuery()
const allocationsQuery = useAllocationsQuery()
const statusQuery = useStatusQuery()
const indexerQuery = useIndexerQuery()
const queryFeesQuery = useQueryFeesQuery()
const epochQuery = useEpochQuery()
const otherIndexersQuery = useOtherIndexersQuery()

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

/** Set of IPFS hashes that the indexer currently has allocations on */
const allocatedDeployments = computed(() => {
  const allocations = allocationsQuery.data.value
  if (!allocations) return new Set<string>()
  return new Set(allocations.map((a) => a.subgraphDeployment.ipfsHash))
})

/** IPFS hashes of deployments being closed in wizard Step 1 */
const closingDeployments = computed(() => {
  const set = new Set<string>()
  for (const alloc of wizardStore.closingAllocations.values()) {
    set.add(alloc.subgraphDeployment.ipfsHash)
  }
  return set
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
  { label: 'Healthy', value: 'healthy' },
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
  closingDeployments,
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
  epochData: computed(() => epochQuery.data.value),
  otherIndexersStatus: computed(() => otherIndexersQuery.data.value),
})

// ---------------------------------------------------------------------------
// Post-computation filter: closable uses statusChecks.closable
// ---------------------------------------------------------------------------
const displaySubgraphs = computed(() => {
  const statusFilter = filterStore.subgraphFilters.statusFilter
  if (statusFilter !== 'closable') return computedSubgraphs.value
  return computedSubgraphs.value.filter((sg) => sg.statusChecks.closable)
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
const filteredCount = computed(() => displaySubgraphs.value.length)

// ---------------------------------------------------------------------------
// Totals row
// ---------------------------------------------------------------------------
const totals = computed(() => {
  const subs = displaySubgraphs.value

  let totalSignal = 0
  let totalStake = 0
  let totalDailyRewardsCut = 0
  let totalMaxAllo = 0
  let aprWeightedSum = 0
  let aprWeightDenom = 0

  for (const sg of subs) {
    const signalGrt = weiToGrt(sg.deployment.signalledTokens)
    const stakeGrt = weiToGrt(sg.deployment.stakedTokens)
    totalSignal += signalGrt
    totalStake += stakeGrt
    totalDailyRewardsCut += sg.dailyRewardsCut

    if (isFinite(sg.maxAllo) && sg.maxAllo !== Number.MIN_SAFE_INTEGER && sg.maxAllo > 0) {
      totalMaxAllo += sg.maxAllo
    }

    // Weighted APR by signal
    if (isFinite(sg.apr) && signalGrt > 0) {
      aprWeightedSum += sg.apr * signalGrt
      aprWeightDenom += signalGrt
    }
  }

  const avgApr = aprWeightDenom > 0 ? aprWeightedSum / aprWeightDenom : 0
  const dailyRewardsCutGrt = weiToGrt(String(totalDailyRewardsCut))

  return {
    count: subs.length,
    totalSignal,
    totalStake,
    avgApr,
    dailyRewardsCutGrt,
    totalMaxAllo,
  }
})

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
// Prune stale selections when displayed subgraphs change
// ---------------------------------------------------------------------------
watchEffect(() => {
  const visibleHashes = new Set(displaySubgraphs.value.map((sg) => sg.deployment.ipfsHash))
  for (const hash of selectionStore.selectedSubgraphs) {
    if (!visibleHashes.has(hash)) {
      selectionStore.selectedSubgraphs.delete(hash)
    }
  }
})

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
      return meta?.displayName ?? row.deployment.ipfsHash
    },
    {
      id: 'name',
      header: 'Name',
      size: 250,
      cell: (info) => {
        const row = info.row.original
        const ipfsHash = row.deployment.ipfsHash
        const versions = row.deployment.versions
        const meta =
          versions?.[0]?.metadata?.subgraphVersion?.subgraph?.metadata
        const name = meta?.displayName ?? 'Unknown'
        const imageUrl = meta?.image ?? null
        const network = row.deployment.manifest.network ?? null
        const health = row.deploymentStatus?.health ?? null
        const synced = row.statusChecks.synced
        const denied = !!(row.deployment.deniedAt)
        const isDeployed = !!row.deploymentStatus
        const isAllocated = allocatedDeployments.value.has(ipfsHash) && !closingDeployments.value.has(ipfsHash)

        // Get epoch block for this network
        const epochData = epochQuery.data.value
        const epochBlock = epochData?.blockNumbers?.find(
          (b) => b.network.alias === network
        )?.blockNumber ?? null

        const agentConnected = !!accountStore.activeAccount?.agentEndpoint

        return h(SubgraphNameCell, {
          displayName: name,
          ipfsHash,
          imageUrl,
          network,
          health,
          synced,
          denied,
          isDeployed,
          isAllocated,
          deploymentStatus: row.deploymentStatus ?? null,
          epochBlockNumber: epochBlock,
          isOffchainSynced: false,
          agentConnected,
        })
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
      id: 'health',
      header: 'Health',
      size: 120,
      cell: (info) => {
        const val = info.getValue() as HealthStatus | null
        return h(HealthCell, { status: val })
      },
    },
  ),
  // Status checks (multi-indicator with colored dots)
  columnHelper.accessor(
    (row) => row.statusChecks,
    {
      id: 'statusChecks',
      header: 'Status Checks',
      size: 200,
      cell: (info) => {
        const row = info.row.original
        return h(StatusCheckDots, {
          statusChecks: row.statusChecks,
          fatalError: row.deploymentStatus?.fatalError ?? null,
        })
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.statusChecks.closable ? 1 : 0
        const b = rowB.original.statusChecks.closable ? 1 : 0
        return a - b
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

// ---------------------------------------------------------------------------
// Column preferences (visibility + ordering from settings)
// ---------------------------------------------------------------------------
const { visibleColumns } = useColumnPreferences('subgraphs', columns)
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
          label="Fetch Other Indexers"
          icon="pi pi-users"
          severity="secondary"
          outlined
          :loading="otherIndexersQuery.loading.value"
          :disabled="!otherIndexersQuery.enabled.value"
          @click="otherIndexersQuery.fetch()"
        />
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
      <div class="filter-group filter-search">
        <label class="filter-label">Search</label>
        <InputText
          v-model="filterStore.subgraphFilters.search"
          placeholder="Name or IPFS hash..."
        />
      </div>

      <div class="filter-group filter-select">
        <label class="filter-label">Rewards</label>
        <Select
          v-model="filterStore.subgraphFilters.rewardsFilter"
          :options="rewardsFilterOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div class="filter-group filter-select">
        <label class="filter-label">Status</label>
        <Select
          v-model="filterStore.subgraphFilters.statusFilter"
          :options="statusFilterOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div class="filter-group filter-select">
        <label class="filter-label">Network</label>
        <MultiSelect
          v-model="filterStore.subgraphFilters.networks"
          :options="networkOptions"
          placeholder="All"
          :maxSelectedLabels="2"
          selectedItemsLabel="{0} networks"
        />
      </div>

      <div class="filter-group filter-number">
        <label class="filter-label">Min Signal</label>
        <div class="toggle-input">
          <ToggleSwitch v-model="filterStore.subgraphFilters.hideSmallSignal" />
          <InputNumber
            v-if="filterStore.subgraphFilters.hideSmallSignal"
            v-model="filterStore.subgraphFilters.minSignal"
            placeholder="GRT"
            :min="0"
            suffix=" GRT"
          />
        </div>
      </div>

      <div class="filter-group filter-number">
        <label class="filter-label">Max Signal</label>
        <InputNumber
          v-model="filterStore.subgraphFilters.maxSignal"
          placeholder="0 = off"
          :min="0"
          suffix=" GRT"
        />
      </div>

      <div class="filter-group filter-number">
        <label class="filter-label">Target APR</label>
        <InputNumber
          v-model="filterStore.subgraphFilters.targetApr"
          :min="0"
          :maxFractionDigits="4"
          suffix="%"
        />
      </div>

      <div class="filter-group filter-number">
        <label class="filter-label">New Allocation</label>
        <InputNumber
          v-model="filterStore.subgraphFilters.newAllocation"
          :min="0"
          suffix=" GRT"
        />
      </div>

      <div class="filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.onlyDeployed" />
          <span>Only Deployed</span>
        </label>
      </div>

      <div class="filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.onlyAllocated" />
          <span>Only Allocated</span>
        </label>
      </div>

      <div class="filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.hideCurrentlyAllocated" />
          <span>Hide Allocated</span>
        </label>
      </div>

      <div class="filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.activateBlacklist" />
          <span>Blacklist</span>
        </label>
      </div>

      <div class="filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.subgraphFilters.activateSynclist" />
          <span>Synclist</span>
        </label>
      </div>
    </div>

    <!-- Data table -->
    <div class="table-wrapper">
      <DataTable
        :data="displaySubgraphs"
        :columns="visibleColumns"
        :loading="isLoading"
        :enable-selection="true"
        :selected-keys="selectedSubgraphs"
        :get-row-id="getRowId"
        table-height="100%"
        empty-message="No subgraphs found. Try adjusting your filters."
        @selection-change="handleSelectionChange"
      />
      <!-- Totals bar -->
      <div class="totals-bar">
        <span class="total-item total-label">
          <strong>{{ totals.count }}</strong> subgraphs
        </span>
        <span class="total-item">
          <span class="total-key">Signal:</span>
          <strong>{{ formatNumber(totals.totalSignal, 0) }} GRT</strong>
        </span>
        <span class="total-item">
          <span class="total-key">Stake:</span>
          <strong>{{ formatNumber(totals.totalStake, 0) }} GRT</strong>
        </span>
        <span class="total-item">
          <span class="total-key">Avg APR:</span>
          <strong>{{ formatNumber(totals.avgApr, 2) }}%</strong>
        </span>
        <span class="total-item">
          <span class="total-key">Daily (Cut):</span>
          <strong>{{ formatNumber(totals.dailyRewardsCutGrt, 0) }} GRT</strong>
        </span>
        <span class="total-item">
          <span class="total-key">Max Allo:</span>
          <strong>{{ formatNumber(totals.totalMaxAllo, 0) }} GRT</strong>
        </span>
      </div>
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
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 12px 16px;
  background-color: var(--app-surface-50);
  border: 1px solid var(--app-surface-200);
  border-radius: 12px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.filter-search {
  flex: 0 1 280px;
  min-width: 180px;
}

.filter-search :deep(.p-inputtext) {
  width: 100%;
}

.filter-select {
  min-width: 150px;
}

.filter-select :deep(.p-select),
.filter-select :deep(.p-multiselect) {
  width: 100%;
}

.filter-number :deep(.p-inputnumber) {
  display: inline-flex;
  width: 120px;
}

.filter-number :deep(.p-inputnumber-input) {
  width: 100%;
  min-width: 0;
}

.toggle-input {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 35px;
}

.filter-toggle {
  white-space: nowrap;
  padding-bottom: 2px;
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
  position: relative;
  padding-bottom: 40px;
}

/* --- Totals bar --- */
.totals-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 16px;
  background-color: var(--app-surface-50);
  border-top: 1px solid var(--app-surface-200);
  border-radius: 0 0 12px 12px;
  z-index: 3;
  overflow-x: auto;
  overflow-y: hidden;
}

.total-item {
  font-size: 0.75rem;
  color: var(--p-text-color);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}

.total-label {
  font-weight: 600;
}

.total-key {
  color: var(--p-text-muted-color);
  font-weight: 500;
}

/* --- Cell styles --- */

:deep(.network-cell) {
  font-size: 0.8125rem;
  color: var(--p-text-color);
  white-space: nowrap;
}

:deep(.token-value) {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
  color: var(--p-text-color);
}

:deep(.text-muted) {
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
  white-space: nowrap;
}

</style>
