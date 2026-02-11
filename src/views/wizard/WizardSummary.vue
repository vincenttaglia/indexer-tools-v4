<script setup lang="ts">
import { computed } from 'vue'
import { useWizardStore, useChainStore } from '@/stores'
import {
  useAllocationsQuery,
  useNetworkQuery,
  useIndexerQuery,
} from '@/composables'
import { weiToGrt } from '@/services/calculations/tokenMath'
import { formatNumber, formatPercent } from '@/services/formatting/numbers'

const wizardStore = useWizardStore()
const indexerQuery = useIndexerQuery()

// ---------------------------------------------------------------------------
// Metric 1: Closing Stake (GRT freed by closing allocations)
// ---------------------------------------------------------------------------
const closingStakeGrt = computed<number>(() => weiToGrt(String(wizardStore.closingStakeWei)))

// ---------------------------------------------------------------------------
// Metric 2: Opening Stake (GRT allocated to new subgraphs)
// ---------------------------------------------------------------------------
const openingStakeGrt = computed<number>(() => wizardStore.openingStakeGrt)

// ---------------------------------------------------------------------------
// Metric 3: Available Stake (current available from indexer on-chain data)
// ---------------------------------------------------------------------------
const availableStakeGrt = computed<number>(() => {
  const data = indexerQuery.data.value
  if (!data) return 0
  return weiToGrt(data.availableStake)
})

// ---------------------------------------------------------------------------
// Metric 4: Remaining Stake (available + closing - opening)
// ---------------------------------------------------------------------------
const remainingStakeGrt = computed<number>(
  () => availableStakeGrt.value + closingStakeGrt.value - openingStakeGrt.value,
)

const isOverAllocated = computed<boolean>(() => remainingStakeGrt.value < 0)

// ---------------------------------------------------------------------------
// Metric 5: Selected Deployments count
// ---------------------------------------------------------------------------
const selectedCount = computed<number>(() => wizardStore.selectedDeployments.size)
</script>

<template>
  <div class="wizard-summary">
    <div class="summary-item">
      <span class="summary-label">Closing Stake</span>
      <span class="summary-value">{{ formatNumber(closingStakeGrt, 0) }} GRT</span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Opening Stake</span>
      <span class="summary-value">{{ formatNumber(openingStakeGrt, 0) }} GRT</span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Available Stake</span>
      <span class="summary-value">{{ formatNumber(availableStakeGrt, 0) }} GRT</span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Remaining</span>
      <span
        class="summary-value"
        :class="{ 'over-allocated': isOverAllocated }"
      >
        {{ formatNumber(remainingStakeGrt, 0) }} GRT
      </span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Selected Deployments</span>
      <span class="summary-value">{{ selectedCount }}</span>
    </div>
  </div>
</template>

<style scoped>
.wizard-summary {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 20px;
  background-color: var(--app-surface-100);
  border: 1px solid var(--app-surface-200);
  border-radius: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
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
