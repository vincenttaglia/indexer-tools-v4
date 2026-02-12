<script setup lang="ts">
import type { OtherIndexerDetail } from '@/types/status'
import { formatNumber } from '@/services/formatting/numbers'
import { computed } from 'vue'

const props = defineProps<{
  details: OtherIndexerDetail[]
}>()

/** Extract hostname from a URL for compact display */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** Healthy indexers (not shown individually by default) */
const healthyIndexers = computed(() =>
  props.details.filter((d) => d.health === 'healthy'),
)

/** Unhealthy or failed indexers (shown individually) */
const problemIndexers = computed(() =>
  props.details.filter((d) => d.health !== 'healthy'),
)
</script>

<template>
  <div class="other-indexers-tooltip">
    <div class="tooltip-header">
      <span class="tooltip-title">Other Indexers</span>
      <span class="tooltip-count">{{ details.length }} total</span>
    </div>

    <!-- Healthy count summary -->
    <div v-if="healthyIndexers.length > 0" class="healthy-summary">
      <span class="dot dot-green" />
      <span class="summary-text">{{ healthyIndexers.length }} healthy</span>
    </div>

    <!-- Problem indexers shown individually -->
    <div v-if="problemIndexers.length > 0" class="problem-list">
      <div
        v-for="(indexer, idx) in problemIndexers"
        :key="idx"
        class="indexer-row"
      >
        <div class="indexer-main">
          <span
            :class="[
              'dot',
              indexer.health === 'unhealthy' ? 'dot-yellow' : 'dot-red',
            ]"
          />
          <span class="indexer-url" :title="indexer.url">
            {{ getHostname(indexer.url) }}
          </span>
          <span class="indexer-health">{{ indexer.health }}</span>
        </div>
        <div class="indexer-details">
          <span v-if="indexer.latestBlock !== null" class="detail-item">
            Block: {{ formatNumber(indexer.latestBlock, 0) }}
          </span>
          <span
            v-if="indexer.fatalError"
            class="detail-item detail-error"
            :title="indexer.fatalError.message"
          >
            {{ indexer.fatalError.deterministic ? 'Det.' : 'Non-det.' }}
            <template v-if="indexer.fatalError.blockNumber !== null">
              @ {{ formatNumber(indexer.fatalError.blockNumber, 0) }}
            </template>
            - {{ indexer.fatalError.message.slice(0, 60) }}{{ indexer.fatalError.message.length > 60 ? '...' : '' }}
          </span>
        </div>
      </div>
    </div>

    <!-- If all healthy, show a simple message -->
    <div
      v-if="problemIndexers.length === 0 && healthyIndexers.length > 0"
      class="all-healthy"
    >
      All indexers are healthy.
    </div>
  </div>
</template>

<style scoped>
.other-indexers-tooltip {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.8125rem;
  min-width: 320px;
  max-width: 480px;
  max-height: 300px;
  overflow-y: auto;
}

.tooltip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--p-surface-200);
}

.tooltip-title {
  font-weight: 600;
  color: var(--p-text-color);
}

.tooltip-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.healthy-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--p-text-color);
  font-weight: 500;
}

.summary-text {
  font-size: 0.8125rem;
}

.problem-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.indexer-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
  border-bottom: 1px solid var(--p-surface-100);
}

.indexer-row:last-child {
  border-bottom: none;
}

.indexer-main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.indexer-url {
  color: var(--p-text-color);
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.indexer-health {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  margin-left: auto;
  flex-shrink: 0;
}

.indexer-details {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 14px;
}

.detail-item {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.detail-error {
  color: var(--p-red-400);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.all-healthy {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  font-style: italic;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-green {
  background-color: var(--p-green-400);
}

.dot-yellow {
  background-color: var(--p-yellow-400);
}

.dot-red {
  background-color: var(--p-red-400);
}
</style>
