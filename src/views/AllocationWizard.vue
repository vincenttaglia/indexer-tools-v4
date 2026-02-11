<script setup lang="ts">
import { computed, ref, h } from 'vue'
import { useRouter } from 'vue-router'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'
import { storeToRefs } from 'pinia'

// PrimeVue components
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import Select from 'primevue/select'
import Message from 'primevue/message'

// Project components
import { DataTable, TokenCell, PercentCell } from '@/components/DataTable'

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
import {
  useFilterStore,
  useWizardStore,
  useChainStore,
  useAccountStore,
} from '@/stores'

// Types
import type { SubgraphComputed, ActionInput } from '@/types'

// API
import { createGraphQLClient, queueActions } from '@/api'

// Calculations & formatting
import { calculateNewApr, grtToWei, weiToGrt } from '@/services/calculations'
import { formatNumber, formatPercent } from '@/services/formatting/numbers'

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const router = useRouter()

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const filterStore = useFilterStore()
const wizardStore = useWizardStore()
const chainStore = useChainStore()
const accountStore = useAccountStore()
const { activeAccount } = storeToRefs(accountStore)

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
function refreshAll() {
  subgraphsQuery.refetch()
  networkQuery.refetch()
  allocationsQuery.refetch()
  statusQuery.refetch()
  indexerQuery.refetch()
}

// ---------------------------------------------------------------------------
// Selection (syncs to wizardStore)
// ---------------------------------------------------------------------------

function handleSelectionChange(ids: Set<string>) {
  // Determine added and removed keys relative to current wizard selection
  const current = wizardStore.selectedDeployments
  // Remove keys that were deselected
  for (const key of current) {
    if (!ids.has(key)) {
      wizardStore.toggleDeployment(key)
    }
  }
  // Add keys that were newly selected
  for (const key of ids) {
    if (!current.has(key)) {
      wizardStore.toggleDeployment(key)
    }
  }
}

function getRowId(row: SubgraphComputed) {
  return row.deployment.ipfsHash
}

// ---------------------------------------------------------------------------
// Selected deployments panel data
// ---------------------------------------------------------------------------

/** Computed list of SubgraphComputed objects that are currently selected */
const selectedSubgraphsList = computed<SubgraphComputed[]>(() => {
  const selected = wizardStore.selectedDeployments
  if (selected.size === 0) return []
  return computedSubgraphs.value.filter((sg) =>
    selected.has(sg.deployment.ipfsHash),
  )
})

/** Calculate new APR for a given deployment based on the entered allocation amount */
function getNewAprForDeployment(sg: SubgraphComputed, amountGrt: string): number {
  const metrics = networkQuery.data.value
  if (!metrics) return 0
  return calculateNewApr({
    signalledTokens: sg.deployment.signalledTokens,
    stakedTokens: sg.deployment.stakedTokens,
    totalTokensSignalled: metrics.totalTokensSignalled,
    networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
    blocksPerDay: chainStore.chainConfig.blocksPerDay,
    newAllocation: amountGrt,
  })
}

/** Get display name for a subgraph */
function getDisplayName(sg: SubgraphComputed): string {
  const versions = sg.deployment.versions
  const meta = versions?.[0]?.metadata?.subgraphVersion?.subgraph?.metadata
  return meta?.displayName ?? sg.deployment.ipfsHash.slice(0, 12)
}

/** Remove a deployment from the selection */
function removeDeployment(ipfsHash: string) {
  if (wizardStore.selectedDeployments.has(ipfsHash)) {
    wizardStore.toggleDeployment(ipfsHash)
  }
}

/** Handle amount change from InputNumber */
function handleAmountChange(ipfsHash: string, value: number | null) {
  const amount = value !== null ? String(value) : '0'
  wizardStore.setAmount(ipfsHash, amount)
}

/** Get the entered amount for a deployment as a number (for InputNumber binding) */
function getAmountValue(ipfsHash: string): number | null {
  const amount = wizardStore.allocationAmounts.get(ipfsHash)
  if (!amount) return null
  const parsed = parseFloat(amount)
  return Number.isNaN(parsed) ? null : parsed
}

// ---------------------------------------------------------------------------
// Summary bar
// ---------------------------------------------------------------------------

/** Available stake from on-chain data (converted from wei to GRT) */
const availableStakeGrt = computed<number>(() => {
  const data = indexerQuery.data.value
  if (!data) return 0
  return weiToGrt(data.availableStake)
})

/** Remaining stake after all entered allocations */
const remainingStake = computed<number>(() => {
  return availableStakeGrt.value - wizardStore.totalAllocated
})

// ---------------------------------------------------------------------------
// Queue actions
// ---------------------------------------------------------------------------
const isQueueing = ref(false)
const queueError = ref<string | null>(null)
const queueSuccess = ref(false)

async function handleQueueActions() {
  const account = activeAccount.value
  if (!account) {
    queueError.value = 'No active account configured. Please set up an account in Settings.'
    return
  }
  if (!account.agentEndpoint) {
    queueError.value = 'No agent endpoint configured for the active account.'
    return
  }

  const actions: ActionInput[] = []
  for (const [ipfsHash, amount] of wizardStore.allocationAmounts.entries()) {
    if (!amount || parseFloat(amount) <= 0) continue
    actions.push({
      status: 'queued',
      type: 'allocate',
      deploymentID: ipfsHash,
      amount: grtToWei(parseFloat(amount)),
      protocolNetwork: chainStore.selectedChain,
      source: 'Indexer Tools - Agent Connect',
      reason: 'Allocation Wizard',
      priority: 1,
      isLegacy: false,
    })
  }

  if (actions.length === 0) {
    queueError.value = 'No valid allocation amounts entered.'
    return
  }

  isQueueing.value = true
  queueError.value = null
  queueSuccess.value = false

  try {
    const client = createGraphQLClient(account.agentEndpoint)
    await queueActions(client, actions)
    queueSuccess.value = true
    wizardStore.clearAll()
    // Navigate to actions page after a short delay so user sees success message
    setTimeout(() => {
      router.push({ name: 'actions' })
    }, 1500)
  } catch (err: unknown) {
    queueError.value = err instanceof Error ? err.message : 'Failed to queue actions'
  } finally {
    isQueueing.value = false
  }
}

// ---------------------------------------------------------------------------
// Column definitions for the subgraph selection table
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
]
</script>

<template>
  <div class="allocation-wizard">
    <!-- Header -->
    <div class="wizard-header">
      <div class="header-left">
        <h1 class="page-title">Allocation Wizard</h1>
        <span class="row-count">
          {{ filteredCount }} / {{ totalCount }}
        </span>
      </div>
      <div class="header-right">
        <Button
          label="Clear All"
          icon="pi pi-times"
          severity="secondary"
          outlined
          :disabled="wizardStore.selectedDeployments.size === 0"
          @click="wizardStore.clearAll()"
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

    <!-- Subgraph selection table -->
    <div class="table-wrapper">
      <DataTable
        :data="computedSubgraphs"
        :columns="columns"
        :loading="isLoading"
        :enable-selection="true"
        :selected-keys="wizardStore.selectedDeployments"
        :get-row-id="getRowId"
        table-height="100%"
        empty-message="No subgraphs found. Try adjusting your filters."
        @selection-change="handleSelectionChange"
      />
    </div>

    <!-- Selected deployments panel -->
    <div
      v-if="wizardStore.selectedDeployments.size > 0"
      class="selected-panel"
    >
      <h2 class="panel-title">
        Selected Deployments ({{ wizardStore.selectedDeployments.size }})
      </h2>

      <div class="selected-list">
        <div
          v-for="sg in selectedSubgraphsList"
          :key="sg.deployment.ipfsHash"
          class="selected-item"
        >
          <div class="selected-item-info">
            <div class="selected-item-name">
              <span class="name-primary">{{ getDisplayName(sg) }}</span>
              <span class="name-hash">{{ sg.deployment.ipfsHash.slice(0, 12) }}</span>
            </div>
            <div class="selected-item-metrics">
              <span class="metric">
                <span class="metric-label">Current APR:</span>
                <span class="metric-value">{{ formatPercent(sg.apr) }}</span>
              </span>
              <span class="metric">
                <span class="metric-label">Max Allo:</span>
                <span class="metric-value">
                  {{ (sg.maxAllo === Number.MIN_SAFE_INTEGER || !isFinite(sg.maxAllo))
                    ? '-'
                    : formatNumber(sg.maxAllo, 0) + ' GRT'
                  }}
                </span>
              </span>
              <span class="metric">
                <span class="metric-label">New APR:</span>
                <span class="metric-value apr-preview">
                  {{ formatPercent(
                    getNewAprForDeployment(
                      sg,
                      wizardStore.allocationAmounts.get(sg.deployment.ipfsHash) ?? '0',
                    )
                  ) }}
                </span>
              </span>
            </div>
          </div>

          <div class="selected-item-input">
            <InputNumber
              :modelValue="getAmountValue(sg.deployment.ipfsHash)"
              @update:modelValue="(val: number | null) => handleAmountChange(sg.deployment.ipfsHash, val)"
              placeholder="GRT amount"
              class="amount-input"
              :min="0"
              suffix=" GRT"
              :minFractionDigits="0"
              :maxFractionDigits="2"
            />
          </div>

          <Button
            icon="pi pi-times"
            severity="danger"
            text
            rounded
            @click="removeDeployment(sg.deployment.ipfsHash)"
          />
        </div>
      </div>

      <!-- Summary bar -->
      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-label">Total Allocated</span>
          <span class="summary-value">
            {{ formatNumber(wizardStore.totalAllocated, 0) }} GRT
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Available Stake</span>
          <span class="summary-value">
            {{ formatNumber(availableStakeGrt, 0) }} GRT
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Remaining</span>
          <span
            class="summary-value"
            :class="{ 'over-allocated': remainingStake < 0 }"
          >
            {{ formatNumber(remainingStake, 0) }} GRT
          </span>
        </div>
        <div class="summary-actions">
          <Button
            label="Queue Actions"
            icon="pi pi-check"
            :loading="isQueueing"
            :disabled="wizardStore.totalAllocated <= 0 || !activeAccount"
            @click="handleQueueActions"
          />
        </div>
      </div>

      <!-- Status messages -->
      <Message v-if="queueError" severity="error" :closable="true" @close="queueError = null">
        {{ queueError }}
      </Message>
      <Message v-if="queueSuccess" severity="success" :closable="false">
        Actions queued successfully. Redirecting to Actions page...
      </Message>
      <Message v-if="remainingStake < 0" severity="warn" :closable="false">
        Total allocation exceeds available stake by {{ formatNumber(Math.abs(remainingStake), 0) }} GRT.
      </Message>
    </div>
  </div>
</template>

<style scoped>
.allocation-wizard {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 24px;
  overflow: hidden;
}

/* --- Header --- */
.wizard-header {
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

.filter-network {
  min-width: 160px;
}

.network-select {
  width: 100%;
}

/* --- Table wrapper --- */
.table-wrapper {
  flex: 1;
  min-height: 200px;
  overflow: hidden;
}

/* --- Selected panel --- */
.selected-panel {
  flex-shrink: 0;
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background-color: var(--app-surface-0);
  border: 1px solid var(--app-surface-200);
  border-radius: 12px;
  overflow: hidden;
}

.panel-title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin: 0;
  flex-shrink: 0;
}

.selected-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.selected-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background-color: var(--app-surface-50);
  border: 1px solid var(--app-surface-100);
  border-radius: 8px;
  transition: border-color 150ms ease-out;
}

.selected-item:hover {
  border-color: var(--app-surface-200);
}

.selected-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.selected-item-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.selected-item-metrics {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.metric {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 0.75rem;
}

.metric-label {
  color: var(--p-text-muted-color);
}

.metric-value {
  color: var(--p-text-color);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.apr-preview {
  color: var(--p-primary-color);
}

.selected-item-input {
  flex-shrink: 0;
  width: 180px;
}

.amount-input {
  width: 100%;
}

/* --- Summary bar --- */
.summary-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 16px;
  background-color: var(--app-surface-100);
  border-radius: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
}

.summary-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
  font-variant-numeric: tabular-nums;
}

.summary-value.over-allocated {
  color: var(--p-red-400);
}

.summary-actions {
  margin-left: auto;
}

/* --- Cell styles (from DataTable render functions) --- */
:deep(.name-cell) {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
}

:deep(.name-primary),
.name-primary {
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.name-hash),
.name-hash {
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
