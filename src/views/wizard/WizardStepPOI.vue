<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useWizardStore } from '@/stores'
import { weiToGrt } from '@/services/calculations/tokenMath'
import { formatNumber } from '@/services/formatting/numbers'
import type { AllocationRaw } from '@/types'

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
const wizardStore = useWizardStore()

// ---------------------------------------------------------------------------
// Closing allocations as a flat array for iteration
// ---------------------------------------------------------------------------
const closingAllocations = computed<AllocationRaw[]>(() => {
  return [...wizardStore.closingAllocations.values()]
})

const hasClosingAllocations = computed(() => closingAllocations.value.length > 0)

/**
 * Group closing allocations by deployment IPFS hash so we show one card
 * per unique deployment, even if multiple allocations exist on it.
 * The POI is set per-deployment, not per-allocation.
 */
const deploymentGroups = computed<
  Array<{
    ipfsHash: string
    displayName: string
    network: string
    totalAllocatedGrt: number
    allocationCount: number
  }>
>(() => {
  const groupMap = new Map<
    string,
    {
      ipfsHash: string
      displayName: string
      network: string
      totalAllocatedGrt: number
      allocationCount: number
    }
  >()

  for (const alloc of closingAllocations.value) {
    const ipfsHash = alloc.subgraphDeployment.ipfsHash
    const existing = groupMap.get(ipfsHash)

    if (existing) {
      existing.totalAllocatedGrt += weiToGrt(alloc.allocatedTokens)
      existing.allocationCount += 1
    } else {
      const versions = alloc.subgraphDeployment.versions
      const meta = versions?.[0]?.subgraph?.metadata
      const displayName = meta?.displayName ?? ipfsHash.slice(0, 16) + '...'
      const network = alloc.subgraphDeployment.manifest?.network ?? 'unknown'

      groupMap.set(ipfsHash, {
        ipfsHash,
        displayName,
        network,
        totalAllocatedGrt: weiToGrt(alloc.allocatedTokens),
        allocationCount: 1,
      })
    }
  }

  return [...groupMap.values()]
})

// ---------------------------------------------------------------------------
// Local form state: reactive map of form values per deployment
// We use a reactive object keyed by ipfsHash so inputs stay responsive.
// ---------------------------------------------------------------------------
interface POIFormFields {
  poi: string
  blockHeight: number | null
  publicPOI: string
}

const formState = reactive<Record<string, POIFormFields>>({})

/** Ensure form state exists for a given deployment */
function ensureFormState(ipfsHash: string): POIFormFields {
  if (!formState[ipfsHash]) {
    // Initialize from store if values already exist (e.g., navigating back)
    formState[ipfsHash] = {
      poi: wizardStore.customPOIs.get(ipfsHash) ?? '',
      blockHeight: wizardStore.customBlockHeights.get(ipfsHash) ?? null,
      publicPOI: wizardStore.customPublicPOIs.get(ipfsHash) ?? '',
    }
  }
  return formState[ipfsHash]
}

// Initialize form state for all deployment groups on load
watch(
  deploymentGroups,
  (groups) => {
    for (const group of groups) {
      ensureFormState(group.ipfsHash)
    }
  },
  { immediate: true },
)

// ---------------------------------------------------------------------------
// Sync local form state back to wizard store on change
// ---------------------------------------------------------------------------
function handleFieldChange(ipfsHash: string): void {
  const fields = formState[ipfsHash]
  if (!fields) return

  const poi = fields.poi.trim()
  const blockHeight = fields.blockHeight ?? 0
  const publicPOI = fields.publicPOI.trim()

  // If all fields are empty/default, clear the custom POI
  if (!poi && blockHeight === 0 && !publicPOI) {
    wizardStore.clearCustomPOI(ipfsHash)
    return
  }

  wizardStore.setCustomPOI(ipfsHash, poi, blockHeight, publicPOI)
}

/** Clear all POI fields for a deployment */
function handleClear(ipfsHash: string): void {
  formState[ipfsHash] = {
    poi: '',
    blockHeight: null,
    publicPOI: '',
  }
  wizardStore.clearCustomPOI(ipfsHash)
}

/** Check if a deployment has any custom POI data set */
function hasCustomData(ipfsHash: string): boolean {
  return wizardStore.customPOIs.has(ipfsHash)
}
</script>

<template>
  <div class="step-poi">
    <!-- Empty state when no closing allocations -->
    <Message v-if="!hasClosingAllocations" severity="info" :closable="false">
      No allocations selected for closing. Go back to Step 1 to select allocations.
    </Message>

    <!-- Header -->
    <template v-if="hasClosingAllocations">
      <div class="step-header">
        <div class="step-header-text">
          <h2 class="step-title">Custom POIs</h2>
          <p class="step-description">
            Optionally set custom Proof of Indexing data for each deployment being closed.
            Leave fields empty to use the default POI from the indexer agent.
            Enter <code class="code-inline">0x0</code> to force a zero POI.
          </p>
        </div>
        <span class="deployment-count">
          {{ deploymentGroups.length }} deployment{{ deploymentGroups.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Deployment cards -->
      <div class="card-list">
        <div
          v-for="group in deploymentGroups"
          :key="group.ipfsHash"
          class="poi-card"
          :class="{ 'poi-card--active': hasCustomData(group.ipfsHash) }"
        >
          <!-- Card header: deployment info -->
          <div class="card-header">
            <div class="card-info">
              <div class="card-name">
                <span class="name-primary">{{ group.displayName }}</span>
                <span class="name-hash">{{ group.ipfsHash.slice(0, 16) }}</span>
              </div>
              <div class="card-meta">
                <span class="meta-item">
                  <span class="meta-label">Network:</span>
                  <span class="meta-value">{{ group.network }}</span>
                </span>
                <span class="meta-item">
                  <span class="meta-label">Allocated:</span>
                  <span class="meta-value">{{ formatNumber(group.totalAllocatedGrt, 0) }} GRT</span>
                </span>
                <span v-if="group.allocationCount > 1" class="meta-item">
                  <span class="meta-label">Allocations:</span>
                  <span class="meta-value">{{ group.allocationCount }}</span>
                </span>
              </div>
            </div>
            <Button
              v-if="hasCustomData(group.ipfsHash)"
              icon="pi pi-times"
              severity="secondary"
              text
              rounded
              size="small"
              aria-label="Clear custom POI"
              @click="handleClear(group.ipfsHash)"
            />
          </div>

          <!-- Card body: POI form fields -->
          <div class="card-fields">
            <div class="form-field">
              <label :for="'poi-' + group.ipfsHash" class="field-label">Manual POI</label>
              <InputText
                :id="'poi-' + group.ipfsHash"
                v-model="formState[group.ipfsHash].poi"
                placeholder="0x..."
                class="field-input mono-input"
                @update:modelValue="handleFieldChange(group.ipfsHash)"
              />
            </div>

            <div class="form-field">
              <label :for="'block-' + group.ipfsHash" class="field-label">Block Height</label>
              <InputNumber
                :id="'block-' + group.ipfsHash"
                v-model="formState[group.ipfsHash].blockHeight"
                placeholder="Block number"
                class="field-input"
                :min="0"
                :useGrouping="false"
                @update:modelValue="handleFieldChange(group.ipfsHash)"
              />
            </div>

            <div class="form-field">
              <label :for="'ppoi-' + group.ipfsHash" class="field-label">Public POI</label>
              <InputText
                :id="'ppoi-' + group.ipfsHash"
                v-model="formState[group.ipfsHash].publicPOI"
                placeholder="0x..."
                class="field-input mono-input"
                @update:modelValue="handleFieldChange(group.ipfsHash)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.step-poi {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

/* --- Step header --- */
.step-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.step-header-text {
  flex: 1;
  min-width: 0;
}

.step-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0 0 4px 0;
}

.step-description {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  margin: 0;
  line-height: 1.5;
}

.code-inline {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  font-size: 0.75rem;
  background: var(--app-surface-100);
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--p-text-color);
}

.deployment-count {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* --- Card list --- */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* --- Individual POI card --- */
.poi-card {
  background: var(--app-surface-50);
  border: 1px solid var(--app-surface-200);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 150ms ease-out;
}

.poi-card:hover {
  border-color: var(--app-surface-300);
}

.poi-card--active {
  border-color: color-mix(in srgb, var(--p-primary-color) 40%, var(--app-surface-200));
  background: color-mix(in srgb, var(--p-primary-color) 4%, var(--app-surface-50));
}

/* --- Card header --- */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

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
  flex-wrap: wrap;
}

.name-primary {
  font-weight: 500;
  font-size: 0.875rem;
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
}

.card-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 0.75rem;
}

.meta-label {
  color: var(--p-text-muted-color);
}

.meta-value {
  color: var(--p-text-color);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* --- Card fields --- */
.card-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 720px) {
  .card-fields {
    grid-template-columns: 1fr auto 1fr;
    gap: 16px;
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
}

.field-input {
  width: 100%;
}

.mono-input :deep(input) {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  font-size: 0.8125rem;
}
</style>
