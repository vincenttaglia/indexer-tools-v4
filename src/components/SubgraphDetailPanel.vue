<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import type { DeploymentStatus, HealthStatus } from '@/types/status'
import SubgraphAvatar from './SubgraphAvatar.vue'
import ErrorDetail from './ErrorDetail.vue'
import { formatNumber } from '@/services/formatting/numbers'

const props = defineProps<{
  imageUrl: string | null
  displayName: string
  ipfsHash: string
  network: string | null
  health: HealthStatus | null
  denied: boolean
  deploymentStatus: DeploymentStatus | null
  epochBlockNumber: number | null
  isOffchainSynced: boolean
  agentConnected: boolean
}>()

defineEmits<{
  addOffchainSync: []
  removeOffchainSync: []
}>()

// ---------------------------------------------------------------------------
// Copy to clipboard
// ---------------------------------------------------------------------------
const copiedHash = ref(false)

async function copyIpfsHash() {
  try {
    await navigator.clipboard.writeText(props.ipfsHash)
    copiedHash.value = true
    setTimeout(() => {
      copiedHash.value = false
    }, 1500)
  } catch {
    // Clipboard API not available
  }
}

// ---------------------------------------------------------------------------
// Chain data from deployment status
// ---------------------------------------------------------------------------
const chain = computed(() => props.deploymentStatus?.chains?.[0] ?? null)

const earliestBlock = computed(() => chain.value?.earliestBlock?.number ?? null)
const latestBlock = computed(() => chain.value?.latestBlock?.number ?? null)
const chainHeadBlock = computed(() => chain.value?.chainHeadBlock?.number ?? null)

// ---------------------------------------------------------------------------
// Sync progress (chainhead-relative)
// ---------------------------------------------------------------------------
const chainheadProgress = computed(() => {
  if (earliestBlock.value === null || latestBlock.value === null || chainHeadBlock.value === null) {
    return null
  }
  const earliest = earliestBlock.value
  const latest = latestBlock.value
  const head = chainHeadBlock.value

  if (latest >= head) return 100
  const range = head - earliest
  if (range <= 0) return 100

  const progress = ((latest - earliest) / range) * 100
  return Math.min(Math.max(progress, 0), 100)
})

function chainheadProgressColor(): string {
  const pct = chainheadProgress.value
  if (pct === null) return 'var(--p-surface-300)'
  if (pct >= 99) return 'var(--p-green-400)'
  if (pct < 50) return 'var(--p-red-400)'
  return 'var(--p-blue-400)'
}

// ---------------------------------------------------------------------------
// Epoch progress
// ---------------------------------------------------------------------------
const epochProgress = computed(() => {
  if (
    earliestBlock.value === null ||
    latestBlock.value === null ||
    props.epochBlockNumber === null
  ) {
    return null
  }
  const earliest = earliestBlock.value
  const latest = latestBlock.value
  const epochStart = props.epochBlockNumber

  if (latest >= epochStart) return 100
  const range = epochStart - earliest
  if (range <= 0) return 100

  const progress = ((latest - earliest) / range) * 100
  return Math.min(Math.max(progress, 0), 100)
})

function epochProgressColor(): string {
  const pct = epochProgress.value
  if (pct === null) return 'var(--p-surface-300)'
  if (pct >= 100) return 'var(--p-green-400)'
  if (pct < 50) return 'var(--p-red-400)'
  return 'var(--p-blue-400)'
}

// ---------------------------------------------------------------------------
// Health label
// ---------------------------------------------------------------------------
function healthColor(): string {
  if (props.health === 'healthy') return 'var(--p-green-400)'
  if (props.health === 'unhealthy') return 'var(--p-yellow-400)'
  if (props.health === 'failed') return 'var(--p-red-400)'
  return 'var(--p-text-muted-color)'
}

function healthLabel(): string {
  if (props.health === 'healthy') return 'Healthy'
  if (props.health === 'unhealthy') return 'Unhealthy'
  if (props.health === 'failed') return 'Failed'
  return 'Unknown'
}
</script>

<template>
  <div class="detail-panel">
    <!-- Header -->
    <div class="panel-header">
      <SubgraphAvatar
        :image-url="imageUrl"
        :health="health"
        :synced="deploymentStatus?.synced ?? null"
        :denied="denied"
        :size="48"
      />
      <div class="header-text">
        <span class="panel-name">{{ displayName }}</span>
        <span v-if="network" class="network-badge">{{ network }}</span>
      </div>
    </div>

    <!-- IPFS Hash -->
    <div class="hash-row">
      <span class="hash-value">{{ ipfsHash }}</span>
      <span
        class="copy-btn"
        :class="{ copied: copiedHash }"
        :title="copiedHash ? 'Copied!' : 'Copy IPFS hash'"
        @click.stop="copyIpfsHash"
      >
        <i :class="['pi', copiedHash ? 'pi-check' : 'pi-copy']" />
      </span>
    </div>

    <!-- Health label -->
    <div class="health-row">
      <span class="label">Health:</span>
      <span class="health-value" :style="{ color: healthColor() }">
        {{ healthLabel() }}
      </span>
      <span v-if="denied" class="denied-label">Denied</span>
    </div>

    <!-- Fatal error section -->
    <div v-if="deploymentStatus?.fatalError" class="error-section">
      <ErrorDetail :fatal-error="deploymentStatus.fatalError" />
    </div>

    <!-- Block info section -->
    <div v-if="chain" class="block-section">
      <div class="block-row">
        <span class="label">First Block:</span>
        <span class="value">{{ earliestBlock !== null ? formatNumber(earliestBlock, 0) : '-' }}</span>
      </div>
      <div class="block-row">
        <span class="label">Last Block:</span>
        <span class="value">{{ latestBlock !== null ? formatNumber(latestBlock, 0) : '-' }}</span>
      </div>
      <div class="block-row">
        <span class="label">Chain Head:</span>
        <span class="value">{{ chainHeadBlock !== null ? formatNumber(chainHeadBlock, 0) : '-' }}</span>
      </div>
      <div class="block-row">
        <span class="label">Epoch Start:</span>
        <span class="value">{{ epochBlockNumber !== null ? formatNumber(epochBlockNumber, 0) : '-' }}</span>
      </div>
    </div>

    <!-- Chainhead sync progress bar -->
    <div v-if="chainheadProgress !== null" class="progress-section">
      <div class="progress-label">
        <span>Chainhead sync</span>
        <span class="progress-pct">{{ formatNumber(chainheadProgress, 1) }}%</span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{
            width: `${chainheadProgress}%`,
            backgroundColor: chainheadProgressColor(),
          }"
        />
      </div>
    </div>

    <!-- Epoch sync progress bar -->
    <div v-if="epochProgress !== null" class="progress-section">
      <div class="progress-label">
        <span>Epoch sync</span>
        <span class="progress-pct">{{ formatNumber(epochProgress, 1) }}%</span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{
            width: `${epochProgress}%`,
            backgroundColor: epochProgressColor(),
          }"
        />
      </div>
    </div>

    <!-- Offchain sync actions -->
    <div v-if="agentConnected" class="offchain-section">
      <Button
        v-if="!isOffchainSynced"
        label="Add to Offchain Sync"
        icon="pi pi-plus"
        severity="secondary"
        outlined
        size="small"
        class="offchain-btn"
        @click="$emit('addOffchainSync')"
      />
      <Button
        v-else
        label="Remove from Offchain Sync"
        icon="pi pi-minus"
        severity="danger"
        outlined
        size="small"
        class="offchain-btn"
        @click="$emit('removeOffchainSync')"
      />
    </div>
    <div v-else-if="!agentConnected" class="no-agent-note">
      No agent configured
    </div>
  </div>
</template>

<style scoped>
.detail-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.8125rem;
  width: 360px;
  max-height: 500px;
  overflow-y: auto;
  /* Inset the content so the avatar's box-shadow ring isn't clipped against
     the panel's scroll edges on the top/left sides. */
  padding: 3px;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.panel-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-badge {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  font-weight: 500;
  background-color: var(--app-surface-100);
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
}

/* IPFS hash */
.hash-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hash-value {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: all;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  color: var(--p-text-muted-color);
  opacity: 0.5;
  transition: all 150ms ease-out;
  flex-shrink: 0;
  font-size: 0.75rem;
}

.copy-btn:hover {
  color: var(--p-text-color);
  opacity: 1;
}

.copy-btn.copied {
  color: var(--p-green-400);
  opacity: 1;
}

/* Health */
.health-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.value {
  color: var(--p-text-color);
  font-variant-numeric: tabular-nums;
}

.health-value {
  font-weight: 600;
}

.denied-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--p-red-400);
  background-color: color-mix(in srgb, var(--p-red-400) 10%, transparent);
  padding: 0 4px;
  border-radius: 3px;
}

/* Error section */
.error-section {
  padding: 6px 0;
  border-top: 1px solid var(--p-surface-100);
  border-bottom: 1px solid var(--p-surface-100);
}

/* Block info */
.block-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 4px;
  border-top: 1px solid var(--p-surface-100);
}

.block-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Progress bars */
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.progress-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.progress-pct {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--p-text-color);
}

.progress-track {
  height: 6px;
  border-radius: 3px;
  background-color: var(--app-surface-200);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 300ms ease-out;
}

/* Offchain sync */
.offchain-section {
  padding-top: 6px;
  border-top: 1px solid var(--p-surface-100);
}

.offchain-btn {
  width: 100%;
}

.no-agent-note {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  font-style: italic;
  padding-top: 4px;
  border-top: 1px solid var(--p-surface-100);
}
</style>
