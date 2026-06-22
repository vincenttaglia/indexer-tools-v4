<script setup lang="ts">
import { computed, h, watchEffect, watch, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'

// PrimeVue components
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import MultiSelect from 'primevue/multiselect'
import ToggleSwitch from 'primevue/toggleswitch'
import InputNumber from 'primevue/inputnumber'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'

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
import { useFilterStore, useWizardStore, useChainStore, useAccountStore } from '@/stores'

// Types
import type { SubgraphComputed, QueryFeeData, HealthStatus } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'
import { weiToGrt } from '@/services/calculations'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const filterStore = useFilterStore()
const wizardStore = useWizardStore()
const chainStore = useChainStore()
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

// Network MultiSelect binds to a local ref so checkbox toggles feel instant;
// the value is debounced into the store, which drives the expensive re-filter
// and per-subgraph recompute. Rapid multi-selects then coalesce into one pass.
const selectedNetworks = ref<string[]>([...filterStore.subgraphFilters.networks])
watchDebounced(
  selectedNetworks,
  (val) => {
    filterStore.subgraphFilters.networks = [...val]
  },
  { debounce: 250 },
)
// Keep the local copy in sync if the store value changes elsewhere (e.g. reset).
watch(
  () => filterStore.subgraphFilters.networks,
  (val) => {
    if (val.join(' ') !== selectedNetworks.value.join(' ')) {
      selectedNetworks.value = [...val]
    }
  },
)

// Network MultiSelect: after selecting an option, clear the typed search and
// return focus to the filter input so the user can keep typing the next network.
const networkSelect = ref<{ filterValue: string | null; $refs: Record<string, { $el?: HTMLElement }> } | null>(null)
function handleNetworkChange() {
  const ms = networkSelect.value
  if (!ms) return
  const input = ms.$refs.filterInput?.$el
  // Refocus synchronously first so focus isn't queued behind the list re-render
  // that clearing the filter triggers, then clear and re-assert after paint.
  input?.focus()
  ms.filterValue = ''
  requestAnimationFrame(() => input?.focus())
}

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
  { label: 'Not Closable', value: 'not-closable' },
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
  { label: 'Include', value: 1 },
  { label: 'Exclude', value: 0 },
  { label: 'Only', value: 2 },
]

const allocationFilterOptions = [
  { label: 'Include', value: 'none' },
  { label: 'Exclude', value: 'hide' },
  { label: 'Only', value: 'only' },
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

const { computed: computedSubgraphs } = useSubgraphComputations({
  subgraphs: filteredSubgraphs,
  networkMetrics: computed(() => networkQuery.data.value),
  statuses: computed(() => statusQuery.data.value),
  queryFees: queryFeesMap,
  allocatedDeployments,
  indexingRewardCut: computed(() => indexerQuery.data.value?.indexingRewardCut ?? 0),
  blocksPerDay: computed(() => chainStore.chainConfig.blocksPerDay),
  targetApr,
  closingAllocations: computed(() => wizardStore.closingAllocations),
  epochData: computed(() => epochQuery.data.value),
  otherIndexersStatus: computed(() => otherIndexersQuery.data.value),
})

// ---------------------------------------------------------------------------
// Post-computation filter: closable uses statusChecks.closable
// ---------------------------------------------------------------------------
const displaySubgraphs = computed(() => {
  const statusFilter = filterStore.subgraphFilters.statusFilter
  if (statusFilter === 'closable')
    return computedSubgraphs.value.filter((sg) => sg.statusChecks.closable)
  if (statusFilter === 'not-closable')
    return computedSubgraphs.value.filter((sg) => !sg.statusChecks.closable)
  return computedSubgraphs.value
})

// ---------------------------------------------------------------------------
// Prune stale selections when displayed subgraphs change
// ---------------------------------------------------------------------------
// If filters remove a subgraph from the visible list, its selection must be
// cleared.  Otherwise Step 4 (which bypasses filters) would include subgraphs
// that no longer match the user's filter criteria (e.g. unsynced subgraphs
// sneaking through when the closable filter is active).
watchEffect(() => {
  const visibleHashes = new Set(displaySubgraphs.value.map((sg) => sg.deployment.ipfsHash))
  const selected = wizardStore.selectedDeployments
  for (const hash of selected) {
    if (!visibleHashes.has(hash)) {
      wizardStore.toggleDeployment(hash)
    }
  }
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
// Is Arbitrum?
// ---------------------------------------------------------------------------
const isArbitrum = computed(() => chainStore.selectedChain === 'arbitrum-one')

// ---------------------------------------------------------------------------
// Totals row
// ---------------------------------------------------------------------------
const totals = computed(() => {
  const subs = displaySubgraphs.value

  let totalSignal = 0
  let totalStake = 0
  let aprWeightedSum = 0
  let aprWeightDenom = 0

  for (const sg of subs) {
    const signalGrt = weiToGrt(sg.deployment.signalledTokens)
    const stakeGrt = weiToGrt(sg.deployment.stakedTokens)
    totalSignal += signalGrt
    totalStake += stakeGrt

    if (isFinite(sg.apr) && signalGrt > 0) {
      aprWeightedSum += sg.apr * signalGrt
      aprWeightDenom += signalGrt
    }
  }

  const avgApr = aprWeightDenom > 0 ? aprWeightedSum / aprWeightDenom : 0

  return {
    count: subs.length,
    totalSignal,
    totalStake,
    avgApr,
  }
})

// ---------------------------------------------------------------------------
// Refresh all queries
// ---------------------------------------------------------------------------
function refreshAll() {
  subgraphsQuery.refetch()
  networkQuery.refetch()
  allocationsQuery.refetch()
  statusQuery.refetch()
  indexerQuery.refetch()
  if (isArbitrum.value) queryFeesQuery.refetch()
}

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
      return h('span', { class: 'token-value' }, formatNumber(val, 2))
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
      const fromOthers = info.row.original.entityCountFromOthers
      return h('span', { class: 'token-value', title: fromOthers ? 'From other indexers' : undefined }, [
        formatNumber(val, 0),
        fromOthers ? h('span', { class: 'text-muted', style: 'margin-left:2px' }, '*') : null,
      ])
    },
  }),
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
  columnHelper.accessor(
    (row) => row.queryFees?.totalQueryFees ?? null,
    {
      id: 'totalQueryFees',
      header: 'Query Fees (GRT)',
      size: 130,
      cell: (info) => {
        const val = info.getValue() as number | null
        if (val === null) return h('span', { class: 'text-muted' }, '-')
        return h('span', { class: 'token-value' }, `${formatNumber(val, 2)} GRT`)
      },
    },
  ),
  columnHelper.accessor(
    (row) => row.queryFees?.avgGatewayLatencyMs ?? null,
    {
      id: 'gwLatency',
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

const { visibleColumns } = useColumnPreferences('subgraphs', columns)
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
      <div class="header-right">
        <Button
          label="Fetch Other Indexers"
          icon="pi pi-users"
          severity="secondary"
          outlined
          size="small"
          :loading="otherIndexersQuery.loading.value"
          :disabled="!otherIndexersQuery.enabled.value"
          @click="otherIndexersQuery.fetch()"
        />
        <Button
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
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
          ref="networkSelect"
          v-model="selectedNetworks"
          :options="networkOptions"
          placeholder="All"
          :maxSelectedLabels="2"
          selectedItemsLabel="{0} networks"
          filter
          filterPlaceholder="Search networks..."
          :resetFilterOnHide="true"
          :autoFilterFocus="true"
          :showToggleAll="false"
          :virtualScrollerOptions="{ itemSize: 38 }"
          panelClass="network-multiselect-panel"
          @change="handleNetworkChange"
        >
          <template #header>
            <button
              type="button"
              class="network-deselect-all"
              :disabled="selectedNetworks.length === 0"
              @click="selectedNetworks = []"
            >
              Deselect all
            </button>
          </template>
        </MultiSelect>
      </div>

      <div class="filter-group filter-segmented">
        <label class="filter-label">Allocations</label>
        <SelectButton
          v-model="filterStore.subgraphFilters.allocationFilter"
          :options="allocationFilterOptions"
          optionLabel="label"
          optionValue="value"
          :allowEmpty="false"
          fluid
        />
      </div>

      <div class="filter-group filter-segmented">
        <label class="filter-label">Denied Rewards</label>
        <SelectButton
          v-model="filterStore.subgraphFilters.rewardsFilter"
          :options="rewardsFilterOptions"
          optionLabel="label"
          optionValue="value"
          :allowEmpty="false"
          fluid
        />
      </div>

      <div class="filter-group filter-number">
        <label class="filter-label">Target APR</label>
        <InputGroup>
          <InputNumber
            v-model="filterStore.subgraphFilters.targetApr"
            :min="0"
            :maxFractionDigits="4"
          />
          <InputGroupAddon>%</InputGroupAddon>
        </InputGroup>
      </div>

      <div class="filter-group filter-number">
        <label class="filter-label">Min Signal</label>
        <InputGroup>
          <InputNumber
            v-model="filterStore.subgraphFilters.minSignal"
            placeholder="0 = off"
            :min="0"
          />
          <InputGroupAddon>GRT</InputGroupAddon>
        </InputGroup>
      </div>

      <div class="filter-group filter-number">
        <label class="filter-label">Max Signal</label>
        <InputGroup>
          <InputNumber
            v-model="filterStore.subgraphFilters.maxSignal"
            placeholder="0 = off"
            :min="0"
          />
          <InputGroupAddon>GRT</InputGroupAddon>
        </InputGroup>
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
        :selected-keys="wizardStore.selectedDeployments"
        :get-row-id="getRowId"
        table-height="100%"
        empty-message="No subgraphs found."
        @selection-change="handleSelectionChange"
      />
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
      </div>
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

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
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

.filter-number :deep(.p-inputgroup) {
  width: 150px;
}

.filter-number :deep(.p-inputnumber) {
  display: inline-flex;
  flex: 1 1 auto;
}

.filter-number :deep(.p-inputnumber-input) {
  width: 100%;
  min-width: 0;
}

/* Compact, muted unit add-on so it reads as a label, not a control */
.filter-number :deep(.p-inputgroupaddon) {
  padding-inline: 8px;
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  min-width: auto;
}

.filter-segmented {
  min-width: 260px;
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

<!-- Non-scoped: the MultiSelect panel is teleported to <body>, so the header
     slot button can't be reached by scoped styles. -->
<style>
.network-multiselect-panel .network-deselect-all {
  width: 100%;
  padding: 6px 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  color: var(--p-primary-color);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.network-multiselect-panel .network-deselect-all:hover:not(:disabled) {
  background-color: var(--p-content-hover-background);
}

.network-multiselect-panel .network-deselect-all:disabled {
  color: var(--p-text-muted-color);
  opacity: 0.5;
  cursor: default;
}
</style>
