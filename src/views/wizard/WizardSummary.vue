<script setup lang="ts">
import { computed } from 'vue'
import { useWizardStore, useChainStore } from '@/stores'
import {
  useAllocationsQuery,
  useNetworkQuery,
  useIndexerQuery,
  useSubgraphsQuery,
} from '@/composables'
import { calculateApr, calculateNewApr, calculateMaxAllocation } from '@/services/calculations'
import { weiToGrt } from '@/services/calculations/tokenMath'
import { formatNumber, formatPercent } from '@/services/formatting/numbers'
import type { SubgraphRaw } from '@/types'

const wizardStore = useWizardStore()
const chainStore = useChainStore()
const allocationsQuery = useAllocationsQuery()
const networkQuery = useNetworkQuery()
const indexerQuery = useIndexerQuery()
const subgraphsQuery = useSubgraphsQuery()

// ---------------------------------------------------------------------------
// Subgraph deployment lookup (ipfsHash → SubgraphRaw.deployment)
// ---------------------------------------------------------------------------
const deploymentLookup = computed(() => {
  const raw = subgraphsQuery.data.value ?? []
  const map = new Map<string, SubgraphRaw['deployment']>()
  for (const sg of raw) {
    map.set(sg.deployment.ipfsHash, sg.deployment)
  }
  return map
})

// ---------------------------------------------------------------------------
// Closing tokens map (ipfsHash → total closing wei)
// ---------------------------------------------------------------------------
const closingTokensMap = computed(() => {
  const map = new Map<string, number>()
  for (const alloc of wizardStore.closingAllocations.values()) {
    const hash = alloc.subgraphDeployment.ipfsHash
    map.set(hash, (map.get(hash) ?? 0) + Number(alloc.allocatedTokens))
  }
  return map
})

// ---------------------------------------------------------------------------
// Metric 1: Before Overall APR
// Weighted average APR across all current allocations.
// Weight = allocatedTokens per allocation.
// ---------------------------------------------------------------------------
const beforeOverallApr = computed<number>(() => {
  const metrics = networkQuery.data.value
  const allocations = allocationsQuery.data.value
  if (!metrics || !allocations || allocations.length === 0) return 0

  const bpd = chainStore.chainConfig.blocksPerDay
  let totalWeightedApr = 0
  let totalWeight = 0

  for (const alloc of allocations) {
    const d = alloc.subgraphDeployment
    const weight = Number(alloc.allocatedTokens)
    if (weight <= 0) continue

    const apr = calculateApr({
      signalledTokens: d.signalledTokens,
      stakedTokens: d.stakedTokens,
      totalTokensSignalled: metrics.totalTokensSignalled,
      networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
      blocksPerDay: bpd,
    })

    totalWeightedApr += apr * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? totalWeightedApr / totalWeight : 0
})

// ---------------------------------------------------------------------------
// Metric 2: Closing Allocations APR
// Weighted average APR of allocations being closed in Step 1.
// ---------------------------------------------------------------------------
const closingAllocationsApr = computed<number>(() => {
  const metrics = networkQuery.data.value
  if (!metrics || wizardStore.closingAllocations.size === 0) return 0

  const bpd = chainStore.chainConfig.blocksPerDay
  let totalWeightedApr = 0
  let totalWeight = 0

  for (const alloc of wizardStore.closingAllocations.values()) {
    const d = alloc.subgraphDeployment
    const weight = Number(alloc.allocatedTokens)
    if (weight <= 0) continue

    const apr = calculateApr({
      signalledTokens: d.signalledTokens,
      stakedTokens: d.stakedTokens,
      totalTokensSignalled: metrics.totalTokensSignalled,
      networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
      blocksPerDay: bpd,
    })

    totalWeightedApr += apr * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? totalWeightedApr / totalWeight : 0
})

// ---------------------------------------------------------------------------
// Metric 3: Allocation Remaining
// available stake + closing stake - opening stake
// ---------------------------------------------------------------------------
const availableStakeGrt = computed<number>(() => {
  const data = indexerQuery.data.value
  if (!data) return 0
  return weiToGrt(data.availableStake)
})

const closingStakeGrt = computed<number>(() => weiToGrt(String(wizardStore.closingStakeWei)))

const allocationRemaining = computed<number>(
  () => availableStakeGrt.value + closingStakeGrt.value - wizardStore.openingStakeGrt,
)

const isOverAllocated = computed<boolean>(() => allocationRemaining.value < 0)

// ---------------------------------------------------------------------------
// Metric 4: Opening Allocations APR
// Weighted average APR of new allocations being opened in Step 4.
// Uses "future" stakedTokens (subtracting closing allocations) and
// calculateNewApr with each deployment's allocation amount.
// ---------------------------------------------------------------------------
const openingAllocationsApr = computed<number>(() => {
  const metrics = networkQuery.data.value
  const lookup = deploymentLookup.value
  if (!metrics || wizardStore.selectedDeployments.size === 0) return 0

  const bpd = chainStore.chainConfig.blocksPerDay
  const WEI_PER_GRT = 1e18
  let totalWeightedApr = 0
  let totalWeight = 0

  for (const ipfsHash of wizardStore.selectedDeployments) {
    const amountStr = wizardStore.allocationAmounts.get(ipfsHash) ?? '0'
    const amountGrt = parseFloat(amountStr)
    if (amountGrt <= 0) continue

    const dep = lookup.get(ipfsHash)
    if (!dep) continue

    // Effective staked tokens, accounting for closing allocations
    let effectiveStaked = dep.stakedTokens
    const closingWei = closingTokensMap.value.get(ipfsHash)
    if (closingWei) {
      effectiveStaked = String(Math.max(0, Number(dep.stakedTokens) - closingWei))
    }

    const apr = calculateNewApr({
      signalledTokens: dep.signalledTokens,
      stakedTokens: effectiveStaked,
      totalTokensSignalled: metrics.totalTokensSignalled,
      networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
      blocksPerDay: bpd,
      newAllocation: amountStr,
    })

    const weight = amountGrt * WEI_PER_GRT
    totalWeightedApr += apr * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? totalWeightedApr / totalWeight : 0
})

// ---------------------------------------------------------------------------
// Metric 5: After Overall APR
// Projected overall APR if the wizard plan is executed:
//   = weighted avg of (kept current allocations + new opening allocations)
// ---------------------------------------------------------------------------
const afterOverallApr = computed<number>(() => {
  const metrics = networkQuery.data.value
  const allocations = allocationsQuery.data.value
  const lookup = deploymentLookup.value
  if (!metrics) return 0

  const bpd = chainStore.chainConfig.blocksPerDay
  const WEI_PER_GRT = 1e18
  const closingIds = new Set(wizardStore.closingAllocations.keys())
  let totalWeightedApr = 0
  let totalWeight = 0

  // 1. Keep non-closing current allocations
  if (allocations) {
    for (const alloc of allocations) {
      if (closingIds.has(alloc.id)) continue
      const d = alloc.subgraphDeployment
      const weight = Number(alloc.allocatedTokens)
      if (weight <= 0) continue

      const apr = calculateApr({
        signalledTokens: d.signalledTokens,
        stakedTokens: d.stakedTokens,
        totalTokensSignalled: metrics.totalTokensSignalled,
        networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
        blocksPerDay: bpd,
      })

      totalWeightedApr += apr * weight
      totalWeight += weight
    }
  }

  // 2. Add opening allocations
  for (const ipfsHash of wizardStore.selectedDeployments) {
    const amountStr = wizardStore.allocationAmounts.get(ipfsHash) ?? '0'
    const amountGrt = parseFloat(amountStr)
    if (amountGrt <= 0) continue

    const dep = lookup.get(ipfsHash)
    if (!dep) continue

    let effectiveStaked = dep.stakedTokens
    const closingWei = closingTokensMap.value.get(ipfsHash)
    if (closingWei) {
      effectiveStaked = String(Math.max(0, Number(dep.stakedTokens) - closingWei))
    }

    const apr = calculateNewApr({
      signalledTokens: dep.signalledTokens,
      stakedTokens: effectiveStaked,
      totalTokensSignalled: metrics.totalTokensSignalled,
      networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
      blocksPerDay: bpd,
      newAllocation: amountStr,
    })

    const weight = amountGrt * WEI_PER_GRT
    totalWeightedApr += apr * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? totalWeightedApr / totalWeight : 0
})

// ---------------------------------------------------------------------------
// Metric 6: Selected Max Allos
// Sum of maxAllo for each selected deployment (target APR = 10%).
// ---------------------------------------------------------------------------
const selectedMaxAllosTotal = computed<number>(() => {
  const metrics = networkQuery.data.value
  const lookup = deploymentLookup.value
  if (!metrics || wizardStore.selectedDeployments.size === 0) return 0

  const bpd = chainStore.chainConfig.blocksPerDay
  let total = 0

  for (const ipfsHash of wizardStore.selectedDeployments) {
    const dep = lookup.get(ipfsHash)
    if (!dep) continue

    let effectiveStaked = dep.stakedTokens
    const closingWei = closingTokensMap.value.get(ipfsHash)
    if (closingWei) {
      effectiveStaked = String(Math.max(0, Number(dep.stakedTokens) - closingWei))
    }

    const maxAllo = calculateMaxAllocation({
      targetApr: 10,
      signalledTokens: dep.signalledTokens,
      stakedTokens: effectiveStaked,
      totalTokensSignalled: metrics.totalTokensSignalled,
      networkGRTIssuancePerBlock: metrics.networkGRTIssuancePerBlock,
      blocksPerDay: bpd,
    })

    if (maxAllo !== Number.MIN_SAFE_INTEGER && isFinite(maxAllo) && maxAllo > 0) {
      total += Math.floor(maxAllo)
    }
  }

  return total
})
</script>

<template>
  <div class="wizard-summary">
    <div class="summary-item">
      <span class="summary-label">Before Overall APR</span>
      <span class="summary-value">{{ formatPercent(beforeOverallApr) }}</span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Closing Allos APR</span>
      <span class="summary-value">
        {{ wizardStore.closingAllocations.size > 0 ? formatPercent(closingAllocationsApr) : '-' }}
      </span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Allo Remaining</span>
      <span
        class="summary-value"
        :class="{ 'over-allocated': isOverAllocated }"
      >
        {{ formatNumber(allocationRemaining, 0) }} GRT
      </span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Opening Allos APR</span>
      <span class="summary-value">
        {{ wizardStore.selectedDeployments.size > 0 && openingAllocationsApr > 0 ? formatPercent(openingAllocationsApr) : '-' }}
      </span>
    </div>

    <div class="summary-item">
      <span class="summary-label">After Overall APR</span>
      <span class="summary-value">
        {{ afterOverallApr > 0 ? formatPercent(afterOverallApr) : '-' }}
      </span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Selected Max Allos</span>
      <span class="summary-value">{{ formatNumber(selectedMaxAllosTotal, 0) }} GRT</span>
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
