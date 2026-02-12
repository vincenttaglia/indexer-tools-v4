<script setup lang="ts">
import { computed, h, watchEffect } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'
import { storeToRefs } from 'pinia'
import { formatUnits } from 'viem'

// PrimeVue components
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import ToggleSwitch from 'primevue/toggleswitch'

// Project components
import {
  DataTable,
  TokenCell,
  PercentCell,
  HealthCell,
  AddressCell,
  DurationCell,
} from '@/components/DataTable'
import StatusCheckDots from '@/components/StatusCheckDots.vue'
import SubgraphNameCell from '@/components/SubgraphNameCell.vue'

// Composables
import {
  useAllocationsQuery,
  useNetworkQuery,
  useStatusQuery,
  useIndexerQuery,
  useRewardsQuery,
  useQosDailyDataQuery,
  useEpochQuery,
  useAllocationComputations,
  useOtherIndexersQuery,
} from '@/composables'
import { useAllocationFilters } from '@/composables/useAllocationFilters'
import type { AllocationDescriptor } from '@/composables'

// Stores
import { useFilterStore, useSelectionStore, useChainStore, useAccountStore } from '@/stores'

// Types
import type { AllocationComputed, HealthStatus } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'
import { weiToGrt } from '@/services/calculations/tokenMath'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const filterStore = useFilterStore()
const selectionStore = useSelectionStore()
const chainStore = useChainStore()
const accountStore = useAccountStore()

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const allocationsQuery = useAllocationsQuery()
const networkQuery = useNetworkQuery()
const statusQuery = useStatusQuery()
const indexerQuery = useIndexerQuery()
const qosQuery = useQosDailyDataQuery()
const epochQuery = useEpochQuery()

// ---------------------------------------------------------------------------
// Other indexers status (manually triggered)
// ---------------------------------------------------------------------------
const otherIndexersQuery = useOtherIndexersQuery()

// ---------------------------------------------------------------------------
// Rewards query (on-demand, disabled by default)
// ---------------------------------------------------------------------------

/** Build allocation descriptors for the rewards query */
const allocationDescriptors = computed<AllocationDescriptor[]>(() => {
  const raw = allocationsQuery.data.value
  if (!raw) return []
  return raw.map((a) => ({
    id: a.id as `0x${string}`,
    isLegacy: a.isLegacy,
  }))
})

const rewardsQuery = useRewardsQuery(allocationDescriptors)

/** Track whether we have ever triggered a rewards fetch */
const rewardsFetched = computed(
  () => rewardsQuery.isSuccess.value || rewardsQuery.isError.value,
)

// ---------------------------------------------------------------------------
// Is Arbitrum?
// ---------------------------------------------------------------------------
const isArbitrum = computed(() => chainStore.selectedChain === 'arbitrum-one')

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
  qosData: computed(() => qosQuery.data.value),
  epochData: computed(() => epochQuery.data.value),
  otherIndexersStatus: computed(() => otherIndexersQuery.data.value),
})

// ---------------------------------------------------------------------------
// Unique networks for filter dropdown
// ---------------------------------------------------------------------------
const networkOptions = computed(() => {
  const allocs = allocationsQuery.data.value ?? []
  const networks = new Set<string>()
  for (const a of allocs) {
    const net = a.subgraphDeployment.manifest.network
    if (net) networks.add(net)
  }
  return [...networks].sort()
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
// Filtering
// ---------------------------------------------------------------------------
const { filtered: filteredAllocations } = useAllocationFilters(
  computedAllocations,
  computed(() => statusQuery.data.value),
)

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
// Totals row
// ---------------------------------------------------------------------------
const totals = computed(() => {
  const allocs = filteredAllocations.value
  const cut = indexerQuery.data.value?.indexingRewardCut ?? 0

  let totalAllocated = 0
  let totalDailyRewardsCut = 0
  let totalPendingRewards = 0n
  let totalPendingRewardsCut = 0n
  let aprWeightedSum = 0
  let aprWeightDenom = 0

  for (const a of allocs) {
    const allocGrt = Number(a.allocatedTokens) / 1e18
    totalAllocated += allocGrt
    totalDailyRewardsCut += a.dailyRewardsCut

    // Weighted APR: weight by allocated tokens
    if (isFinite(a.apr) && allocGrt > 0) {
      aprWeightedSum += a.apr * allocGrt
      aprWeightDenom += allocGrt
    }

    if (a.pendingRewards.loaded) {
      totalPendingRewards += a.pendingRewards.value
      totalPendingRewardsCut += (a.pendingRewards.value * BigInt(cut)) / 1_000_000n
    }
  }

  const avgApr = aprWeightDenom > 0 ? aprWeightedSum / aprWeightDenom : 0
  const dailyRewardsCutGrt = weiToGrt(String(totalDailyRewardsCut))
  const pendingGrt = Number(formatUnits(totalPendingRewards, 18))
  const pendingCutGrt = Number(formatUnits(totalPendingRewardsCut, 18))

  return {
    count: allocs.length,
    totalAllocated,
    avgApr,
    dailyRewardsCutGrt,
    pendingGrt,
    pendingCutGrt,
  }
})

// ---------------------------------------------------------------------------
// Refresh all queries
// ---------------------------------------------------------------------------
function refreshAll() {
  allocationsQuery.refetch()
  networkQuery.refetch()
  statusQuery.refetch()
  indexerQuery.refetch()
  epochQuery.refetch()
  if (isArbitrum.value) qosQuery.refetch()
}

// ---------------------------------------------------------------------------
// Fetch rewards (on-demand)
// ---------------------------------------------------------------------------
function fetchRewards() {
  rewardsQuery.refetch()
}

// ---------------------------------------------------------------------------
// Prune stale selections when filtered allocations change
// ---------------------------------------------------------------------------
watchEffect(() => {
  const visibleIds = new Set(filteredAllocations.value.map((a) => a.id))
  for (const id of selectionStore.selectedAllocations) {
    if (!visibleIds.has(id)) {
      selectionStore.selectedAllocations.delete(id)
    }
  }
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
const { selectedAllocations } = storeToRefs(selectionStore)

function handleSelectionChange(ids: Set<string>) {
  selectionStore.selectAllAllocations([...ids])
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
  return d.ipfsHash
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
        const d = row.subgraphDeployment
        const name = getDeploymentName(row)
        const imageUrl = d.versions?.[0]?.subgraph?.metadata?.image ?? null
        const ipfsHash = d.ipfsHash
        const network = d.manifest.network ?? null
        const health = row.deploymentStatus?.health ?? null
        const synced = row.statusChecks.synced
        const denied = !!(d.deniedAt)
        const isDeployed = !!row.deploymentStatus

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
          isAllocated: true,
          deploymentStatus: row.deploymentStatus ?? null,
          epochBlockNumber: epochBlock,
          isOffchainSynced: false,
          agentConnected,
        })
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
      const grt = weiToGrt(String(val))
      return h(
        'span',
        { class: 'token-value' },
        `${formatNumber(grt, 0)} GRT`,
      )
    },
  }),

  // 6. Duration (live counter from allocation createdAt timestamp)
  columnHelper.accessor(
    (row) => Math.floor(Date.now() / 1000) - row.createdAt,
    {
      id: 'duration',
      header: 'Duration',
      size: 180,
      cell: (info) => {
        const row = info.row.original
        return h(DurationCell, {
          createdAt: row.createdAt,
          createdAtEpoch: row.createdAtEpoch,
          createdAtBlockNumber: row.createdAtBlockNumber,
          createdAtBlockHash: row.createdAtBlockHash,
        })
      },
    },
  ),

  // 7. Pending Rewards (GRT)
  columnHelper.accessor(
    (row) => row.pendingRewards,
    {
      id: 'pendingRewards',
      header: 'Pending Rewards (GRT)',
      size: 180,
      cell: (info) => {
        const pr = info.getValue() as AllocationComputed['pendingRewards']
        if (pr.loading) {
          return h('span', { class: 'pending-loading' }, [
            h('span', { class: 'spinner' }),
            h('span', null, ' Loading...'),
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

  // 9. QoS: Query Count
  columnHelper.accessor(
    (row) => row.qosData?.queryCount ?? null,
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

  // 9. QoS: Total Query Fees (GRT)
  columnHelper.accessor(
    (row) => row.qosData?.totalQueryFees ?? null,
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

  // 10. QoS: Avg Latency (ms)
  columnHelper.accessor(
    (row) => row.qosData?.avgLatencyMs ?? null,
    {
      id: 'avgLatency',
      header: 'Latency (ms)',
      size: 110,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')
        return h('span', { class: 'token-value' }, `${formatNumber(val, 0)}ms`)
      },
    },
  ),

  // 11. QoS: Avg Blocks Behind (color-coded)
  columnHelper.accessor(
    (row) => row.qosData?.avgBlocksBehind ?? null,
    {
      id: 'blocksBehind',
      header: 'Blocks Behind',
      size: 120,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')
        let colorClass = 'status-green'
        if (val > 100) colorClass = 'status-red'
        else if (val > 10) colorClass = 'status-yellow'
        return h('span', { class: `token-value ${colorClass}` }, formatNumber(val, 0))
      },
    },
  ),

  // 12. QoS: Success Rate (%, color-coded)
  columnHelper.accessor(
    (row) => row.qosData?.successRate ?? null,
    {
      id: 'successRate',
      header: 'Success %',
      size: 100,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')
        const pct = val * 100
        let colorClass = 'status-green'
        if (pct < 90) colorClass = 'status-red'
        else if (pct < 95) colorClass = 'status-yellow'
        return h('span', { class: `token-value ${colorClass}` }, `${formatNumber(pct, 1)}%`)
      },
    },
  ),

  // 13. Health (from graph-node status endpoint)
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

  // 14. Status checks (multi-indicator with colored dots)
  columnHelper.accessor(
    (row) => row.statusChecks,
    {
      id: 'status',
      header: 'Status',
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

  // 15. Allocation ID
  columnHelper.accessor('id', {
    id: 'allocationId',
    header: 'Allocation ID',
    size: 160,
    cell: (info) => {
      return h(AddressCell, { address: info.getValue() as string })
    },
  }),
]
</script>

<template>
  <div class="allocations-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1 class="page-title">Allocations</h1>
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
          label="Fetch Rewards"
          icon="pi pi-download"
          severity="info"
          outlined
          :loading="rewardsQuery.isFetching.value"
          @click="fetchRewards"
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
          v-model="filterStore.allocationFilters.search"
          placeholder="Name, IPFS hash, or allocation ID..."
        />
      </div>

      <div class="filter-group filter-select">
        <label class="filter-label">Status</label>
        <Select
          v-model="filterStore.allocationFilters.statusFilter"
          :options="statusFilterOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div class="filter-group filter-select">
        <label class="filter-label">Network</label>
        <MultiSelect
          v-model="filterStore.allocationFilters.networks"
          :options="networkOptions"
          placeholder="All"
          :maxSelectedLabels="2"
          selectedItemsLabel="{0} networks"
        />
      </div>

      <div class="filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.allocationFilters.activateBlacklist" />
          <span>Blacklist</span>
        </label>
      </div>

      <div class="filter-toggle">
        <label class="toggle-label">
          <ToggleSwitch v-model="filterStore.allocationFilters.activateSynclist" />
          <span>Synclist</span>
        </label>
      </div>
    </div>

    <!-- Data table -->
    <div class="table-wrapper">
      <DataTable
        :data="filteredAllocations"
        :columns="columns"
        :loading="isLoading"
        :enable-selection="true"
        :selected-keys="selectedAllocations"
        :get-row-id="getRowId"
        table-height="100%"
        empty-message="No allocations found. Try adjusting your filters."
        @selection-change="handleSelectionChange"
      />
      <!-- Totals bar -->
      <div class="totals-bar">
        <span class="total-item total-label">
          <strong>{{ totals.count }}</strong> allocations
        </span>
        <span class="total-item">
          <span class="total-key">Allocated:</span>
          <strong>{{ formatNumber(totals.totalAllocated, 0) }} GRT</strong>
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
          <span class="total-key">Pending:</span>
          <strong>{{ formatNumber(totals.pendingGrt, 0) }} GRT</strong>
        </span>
        <span class="total-item">
          <span class="total-key">Pending (Cut):</span>
          <strong>{{ formatNumber(totals.pendingCutGrt, 0) }} GRT</strong>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.allocations-dashboard {
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
  flex: 0 1 360px;
  min-width: 200px;
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

/* --- Status color coding --- */
:deep(.status-green) {
  color: var(--p-green-400);
}

:deep(.status-yellow) {
  color: var(--p-yellow-400);
}

:deep(.status-red) {
  color: var(--p-red-400);
}

/* --- Pending rewards loading spinner --- */
:deep(.pending-loading) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
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
