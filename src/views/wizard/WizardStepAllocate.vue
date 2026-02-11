<script setup lang="ts">
import { computed, ref } from 'vue'

// PrimeVue components
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Message from 'primevue/message'

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
import { useWizardStore, useChainStore, useFilterStore } from '@/stores'

// Calculations & formatting
import { calculateNewApr, weiToGrt } from '@/services/calculations'
import { formatNumber, formatPercent } from '@/services/formatting/numbers'

// Types
import type { SubgraphComputed } from '@/types'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const wizardStore = useWizardStore()
const chainStore = useChainStore()
const filterStore = useFilterStore()

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

// ---------------------------------------------------------------------------
// Filtering + Computation
// ---------------------------------------------------------------------------

/**
 * Use the standard subgraph filters to produce the base list,
 * then pass closingAllocations into useSubgraphComputations so that
 * APR / maxAllo reflect the "future" state after closing allocations.
 */
const { filtered: filteredSubgraphs } = useSubgraphFilters(
  computed(() => subgraphsQuery.data.value),
  allocatedDeployments,
)

const targetApr = computed(() => filterStore.subgraphFilters.targetApr)
const newAllocation = computed(() => String(filterStore.subgraphFilters.newAllocation))

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
// Selected subgraphs list (only those in wizardStore.selectedDeployments)
// ---------------------------------------------------------------------------

const selectedSubgraphsList = computed<SubgraphComputed[]>(() => {
  const selected = wizardStore.selectedDeployments
  if (selected.size === 0) return []
  return computedSubgraphs.value.filter((sg) =>
    selected.has(sg.deployment.ipfsHash),
  )
})

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function getDisplayName(sg: SubgraphComputed): string {
  const versions = sg.deployment.versions
  const meta = versions?.[0]?.metadata?.subgraphVersion?.subgraph?.metadata
  return meta?.displayName ?? sg.deployment.ipfsHash.slice(0, 12)
}

// ---------------------------------------------------------------------------
// Amount handling
// ---------------------------------------------------------------------------

function handleAmountChange(ipfsHash: string, value: number | null) {
  wizardStore.setAmount(ipfsHash, value !== null ? String(value) : '0')
}

function getAmountValue(ipfsHash: string): number | null {
  const amount = wizardStore.allocationAmounts.get(ipfsHash)
  if (!amount) return null
  const parsed = parseFloat(amount)
  return Number.isNaN(parsed) ? null : parsed
}

// ---------------------------------------------------------------------------
// New APR preview per deployment
// ---------------------------------------------------------------------------

/**
 * Build the effective staked tokens for a subgraph, accounting for
 * allocations the user is closing in Step 1 of the wizard.
 */
function getEffectiveStakedTokens(sg: SubgraphComputed): string {
  const hash = sg.deployment.ipfsHash
  let closingAmount = 0
  for (const alloc of wizardStore.closingAllocations.values()) {
    if (alloc.subgraphDeployment.ipfsHash === hash) {
      closingAmount += Number(alloc.allocatedTokens)
    }
  }
  if (closingAmount > 0) {
    const future = Number(sg.deployment.stakedTokens) - closingAmount
    return String(Math.max(0, future))
  }
  return sg.deployment.stakedTokens
}

function getNewAprForDeployment(sg: SubgraphComputed, amountGrt: string): number {
  const metrics = networkQuery.data.value
  if (!metrics) return 0
  return calculateNewApr({
    signalledTokens: sg.deployment.signalledTokens,
    stakedTokens: getEffectiveStakedTokens(sg),
    totalTokensSignalled: metrics.totalTokensSignalled,
    networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
    blocksPerDay: chainStore.chainConfig.blocksPerDay,
    newAllocation: amountGrt,
  })
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

/** GRT being freed by closing allocations */
const closingStakeGrt = computed<number>(() => {
  return weiToGrt(String(wizardStore.closingStakeWei))
})

/** Total usable stake: on-chain available + freed from closings */
const totalAvailableGrt = computed<number>(() => {
  return availableStakeGrt.value + closingStakeGrt.value
})

/** Remaining stake after all entered allocations */
const remainingStake = computed<number>(() => {
  return totalAvailableGrt.value - wizardStore.totalAllocated
})
</script>

<template>
  <div class="wizard-step-allocate">
    <!-- Empty state -->
    <div v-if="wizardStore.selectedDeployments.size === 0" class="empty-state">
      <Message severity="info" :closable="false">
        No subgraphs selected. Go back to Step 3 to pick subgraphs.
      </Message>
    </div>

    <!-- Main content when subgraphs are selected -->
    <template v-else>
      <!-- Header controls row -->
      <div class="controls-bar">
        <div class="control-group">
          <label class="control-label">Min Allocation (GRT)</label>
          <InputNumber
            v-model="wizardStore.minAllocation"
            :min="0"
            suffix=" GRT"
            :minFractionDigits="0"
            :maxFractionDigits="0"
            class="control-input"
          />
        </div>

        <div class="control-group">
          <label class="control-label">Min Allocation 0-Signal (GRT)</label>
          <InputNumber
            v-model="wizardStore.minAllocation0Signal"
            :min="0"
            suffix=" GRT"
            :minFractionDigits="0"
            :maxFractionDigits="0"
            class="control-input"
          />
        </div>

        <div class="control-actions">
          <Button
            label="Set Max Allos"
            icon="pi pi-arrow-up"
            severity="secondary"
            outlined
            @click="wizardStore.setAllMaxAllos(selectedSubgraphsList)"
          />
          <Button
            label="Apply Minimums"
            icon="pi pi-filter"
            severity="secondary"
            outlined
            @click="wizardStore.applyMinimums(selectedSubgraphsList)"
          />
          <Button
            label="Reset"
            icon="pi pi-refresh"
            severity="danger"
            outlined
            @click="wizardStore.resetAllos()"
          />
        </div>
      </div>

      <!-- Per-subgraph allocation cards -->
      <div class="subgraph-list">
        <div
          v-for="sg in selectedSubgraphsList"
          :key="sg.deployment.ipfsHash"
          class="subgraph-card"
        >
          <!-- Left: name, hash, current APR, maxAllo -->
          <div class="card-info">
            <div class="card-name">
              <span class="name-primary">{{ getDisplayName(sg) }}</span>
              <span class="name-hash">{{ sg.deployment.ipfsHash.slice(0, 12) }}</span>
            </div>
            <div class="card-metrics">
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
            </div>
          </div>

          <!-- Center: allocation amount input -->
          <div class="card-input">
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

          <!-- Right: New APR preview -->
          <div class="card-preview">
            <span class="metric-label">New APR:</span>
            <span class="metric-value apr-preview">
              {{ formatPercent(
                getNewAprForDeployment(
                  sg,
                  wizardStore.allocationAmounts.get(sg.deployment.ipfsHash) ?? '0',
                )
              ) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Summary bar -->
      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-label">Available Stake</span>
          <span class="summary-value">
            {{ formatNumber(availableStakeGrt, 0) }}
            <template v-if="closingStakeGrt > 0">
              + {{ formatNumber(closingStakeGrt, 0) }}
            </template>
            GRT
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Allocated</span>
          <span class="summary-value">
            {{ formatNumber(wizardStore.totalAllocated, 0) }} GRT
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
      </div>

      <!-- Warning if over-allocated -->
      <Message v-if="remainingStake < 0" severity="warn" :closable="false">
        Total allocation exceeds available stake by {{ formatNumber(Math.abs(remainingStake), 0) }} GRT.
      </Message>
    </template>
  </div>
</template>

<style scoped>
.wizard-step-allocate {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

/* --- Empty state --- */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 32px;
}

/* --- Controls bar --- */
.controls-bar {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 12px 16px;
  background-color: var(--app-surface-50);
  border: 1px solid var(--app-surface-200);
  border-radius: 10px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.control-input {
  width: 160px;
}

.control-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}

/* --- Subgraph list --- */
.subgraph-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.subgraph-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background-color: var(--app-surface-50);
  border: 1px solid var(--app-surface-100);
  border-radius: 8px;
  transition: border-color 150ms ease-out;
}

.subgraph-card:hover {
  border-color: var(--app-surface-200);
}

/* --- Card sections --- */
.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.name-primary {
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-hash {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.card-metrics {
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
  font-size: 0.75rem;
}

.metric-value {
  color: var(--p-text-color);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  font-size: 0.75rem;
}

.apr-preview {
  color: var(--p-primary-color);
}

.card-input {
  flex-shrink: 0;
  width: 180px;
}

.amount-input {
  width: 100%;
}

.card-preview {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 100px;
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
</style>
