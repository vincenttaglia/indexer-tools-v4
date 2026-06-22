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
  useQueryFeesQuery,
  useSubgraphComputations,
} from '@/composables'

// Stores
import { useWizardStore, useChainStore, useFilterStore } from '@/stores'
import { useSettingsStore } from '@/stores/settingsStore'

// Calculations & formatting
import {
  calculateNewApr,
  calculateSubgraphDailyRewards,
  calculateDailyRewardsCut,
  calculateProportion,
  weiToGrt,
  optimizeAllocations,
} from '@/services/calculations'
import type { OptimizationResult } from '@/services/calculations'
import { formatNumber, formatPercent } from '@/services/formatting/numbers'

// Types
import type { SubgraphComputed, QueryFeeData } from '@/types'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const wizardStore = useWizardStore()
const chainStore = useChainStore()
const filterStore = useFilterStore()
const settingsStore = useSettingsStore()

/** Parse a comma/newline-separated IPFS hash string into a Set. */
function parseHashList(raw: string): Set<string> {
  const out = new Set<string>()
  for (const part of raw.split(/[,\n\r\s]+/)) {
    const trimmed = part.trim()
    if (trimmed.length > 0) out.add(trimmed)
  }
  return out
}

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
// Computation (bypass filters — selected subgraphs always shown)
// ---------------------------------------------------------------------------

/**
 * Only include the subgraphs that were selected in Step 3, regardless of
 * any active filters. Filters are for discovery in Step 3; once selected,
 * subgraphs must always appear here.
 */
const selectedRawSubgraphs = computed(() => {
  const raw = subgraphsQuery.data.value ?? []
  const selected = wizardStore.selectedDeployments
  if (selected.size === 0) return []
  return raw.filter((sg) => selected.has(sg.deployment.ipfsHash))
})

const targetApr = computed(() => filterStore.subgraphFilters.targetApr)

const { computed: selectedSubgraphsList } = useSubgraphComputations({
  subgraphs: selectedRawSubgraphs,
  networkMetrics: computed(() => networkQuery.data.value),
  statuses: computed(() => statusQuery.data.value),
  queryFees: queryFeesMap,
  allocatedDeployments,
  indexingRewardCut: computed(() => indexerQuery.data.value?.indexingRewardCut ?? 0),
  blocksPerDay: computed(() => chainStore.chainConfig.blocksPerDay),
  targetApr,
  closingAllocations: computed(() => wizardStore.closingAllocations),
})

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function getDisplayName(sg: SubgraphComputed): string {
  const versions = sg.deployment.versions
  const meta = versions?.[0]?.metadata?.subgraphVersion?.subgraph?.metadata
  return meta?.displayName ?? sg.deployment.ipfsHash
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
// Richer per-row computed helpers
// ---------------------------------------------------------------------------

/** Daily rewards (after cut) for the entered allocation amount */
function getDailyRewardsCut(sg: SubgraphComputed, amountGrt: string): number {
  const metrics = networkQuery.data.value
  if (!metrics) return 0
  const rewardCut = indexerQuery.data.value?.indexingRewardCut ?? 0
  const dailyRewards = calculateSubgraphDailyRewards({
    signalledTokens: sg.deployment.signalledTokens,
    stakedTokens: getEffectiveStakedTokens(sg),
    totalTokensSignalled: metrics.totalTokensSignalled,
    networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
    blocksPerDay: chainStore.chainConfig.blocksPerDay,
    newAllocation: amountGrt,
  })
  return calculateDailyRewardsCut(dailyRewards, rewardCut)
}

/** Current proportion (signal-to-stake ratio) */
function getCurrentProportion(sg: SubgraphComputed): number {
  const metrics = networkQuery.data.value
  if (!metrics) return 0
  return calculateProportion({
    signalledTokens: sg.deployment.signalledTokens,
    totalTokensSignalled: metrics.totalTokensSignalled,
    stakedTokens: getEffectiveStakedTokens(sg),
    totalTokensAllocated: metrics.totalTokensAllocated,
  })
}

/** New proportion after adding the entered allocation */
function getNewProportion(sg: SubgraphComputed, amountGrt: string): number {
  const metrics = networkQuery.data.value
  if (!metrics) return 0
  const effectiveStaked = getEffectiveStakedTokens(sg)
  const newStaked = Number(effectiveStaked) + Number(amountGrt) * 1e18
  return calculateProportion({
    signalledTokens: sg.deployment.signalledTokens,
    totalTokensSignalled: metrics.totalTokensSignalled,
    stakedTokens: String(newStaked),
    totalTokensAllocated: metrics.totalTokensAllocated,
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

// ---------------------------------------------------------------------------
// APR Optimizer
// ---------------------------------------------------------------------------

const optimizationResult = ref<OptimizationResult | null>(null)

function applyOptimizedAllocations() {
  const metrics = networkQuery.data.value
  if (!metrics) return

  const optimizable = selectedSubgraphsList.value.map((sg) => ({
    ipfsHash: sg.deployment.ipfsHash,
    signalledTokens: sg.deployment.signalledTokens,
    stakedTokens: getEffectiveStakedTokens(sg),
    displayName: getDisplayName(sg),
  }))

  const result = optimizeAllocations({
    subgraphs: optimizable,
    totalBudgetGrt: totalAvailableGrt.value,
    totalTokensSignalled: metrics.totalTokensSignalled,
    networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
    blocksPerDay: chainStore.chainConfig.blocksPerDay,
    indexingRewardCut: indexerQuery.data.value?.indexingRewardCut ?? 0,
    useWaterfall: settingsStore.useWaterfallOptimizer,
    maxAllocationPct: settingsStore.maxAllocationPct,
    maxAllocationGrt: settingsStore.maxAllocationGrt,
    riskyAllocationPct: settingsStore.riskyAllocationPct,
    riskyAllocationGrt: settingsStore.riskyAllocationGrt,
    riskyDeployments: parseHashList(settingsStore.optimizerRiskyDeployments),
  })

  // Apply optimized amounts to wizard
  for (const entry of result.perSubgraph) {
    wizardStore.setAmount(entry.ipfsHash, String(Math.floor(entry.allocationGrt)))
  }

  optimizationResult.value = result
}
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
            inputClass="compact-input"
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
            inputClass="compact-input"
          />
        </div>

        <div class="control-actions">
          <Button
            label="Set Max Allos"
            icon="pi pi-arrow-up"
            severity="secondary"
            outlined
            size="small"
            @click="wizardStore.setAllMaxAllos(selectedSubgraphsList)"
          />
          <Button
            label="Apply Minimums"
            icon="pi pi-filter"
            severity="secondary"
            outlined
            size="small"
            @click="wizardStore.applyMinimums(selectedSubgraphsList)"
          />
          <span class="experimental-wrapper" title="This feature is experimental. Review allocations before submitting.">
            <Button
              label="Optimize Allocations"
              icon="pi pi-sliders-h"
              severity="warn"
              outlined
              size="small"
              :disabled="selectedSubgraphsList.length === 0 || totalAvailableGrt <= 0"
              @click="applyOptimizedAllocations"
            />
            <span class="experimental-badge">BETA</span>
          </span>
          <Button
            label="Reset"
            icon="pi pi-refresh"
            severity="danger"
            outlined
            size="small"
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
              <span class="name-hash">{{ sg.deployment.ipfsHash }}</span>
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
              <span class="metric">
                <span class="metric-label">Signal:</span>
                <span class="metric-value">{{ formatNumber(weiToGrt(sg.deployment.signalledTokens), 0) }} GRT</span>
              </span>
              <span class="metric">
                <span class="metric-label">Cur. Allocations:</span>
                <span class="metric-value">{{ formatNumber(weiToGrt(sg.deployment.stakedTokens), 0) }} GRT</span>
              </span>
              <span class="metric">
                <span class="metric-label">Proportion:</span>
                <span class="metric-value">{{ formatNumber(getCurrentProportion(sg), 2) }}</span>
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
              inputClass="compact-input"
              :min="0"
              suffix=" GRT"
              :minFractionDigits="0"
              :maxFractionDigits="2"
            />
          </div>

          <!-- Right: New APR preview + extras -->
          <div class="card-preview">
            <div class="preview-row">
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
            <div class="preview-row">
              <span class="metric-label">Daily (Cut):</span>
              <span class="metric-value">
                {{ formatNumber(
                  weiToGrt(String(getDailyRewardsCut(
                    sg,
                    wizardStore.allocationAmounts.get(sg.deployment.ipfsHash) ?? '0',
                  ))), 2
                ) }} GRT
              </span>
            </div>
            <div class="preview-row">
              <span class="metric-label">New Prop:</span>
              <span class="metric-value">
                {{ formatNumber(getNewProportion(
                  sg,
                  wizardStore.allocationAmounts.get(sg.deployment.ipfsHash) ?? '0',
                ), 2) }}
              </span>
            </div>
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
        <div v-if="optimizationResult" class="summary-item optimize-result">
          <span class="summary-label">Optimized Daily Rewards</span>
          <span class="summary-value optimized-value">
            {{ formatNumber(weiToGrt(String(optimizationResult.totalDailyRewardsCut)), 2) }} GRT/day
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
  width: 140px;
  max-width: 140px;
}

:deep(.compact-input) {
  font-size: 0.8125rem !important;
  padding: 0.4rem 0.6rem !important;
  height: auto !important;
  width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

:deep(.p-inputnumber) {
  width: 100% !important;
  max-width: 100% !important;
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
  overflow-x: auto;
  white-space: nowrap;
  user-select: all;
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
  width: 150px;
  max-width: 150px;
}

.amount-input {
  max-width: 100%;
}

.amount-input :deep(.p-inputnumber) {
  width: 100%;
  max-width: 100%;
}

.amount-input :deep(input) {
  width: 100%;
}

.card-preview {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 120px;
}

.preview-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
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

.experimental-wrapper {
  position: relative;
  display: inline-flex;
}

.experimental-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--p-yellow-500);
  color: var(--p-surface-900);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 1px 5px;
  border-radius: 4px;
  line-height: 1.3;
  pointer-events: none;
}

.optimize-result {
  margin-left: auto;
}

.optimized-value {
  color: var(--p-primary-color);
}
</style>
