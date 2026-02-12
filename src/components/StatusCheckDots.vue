<script setup lang="ts">
import { ref } from 'vue'
import Popover from 'primevue/popover'
import type { DeploymentStatusChecks } from '@/types/allocation'
import type { FatalError } from '@/types/status'
import ErrorDetail from './ErrorDetail.vue'
import OtherIndexersTooltip from './OtherIndexersTooltip.vue'

defineProps<{
  statusChecks: DeploymentStatusChecks
  fatalError: FatalError | null
}>()

const otherIndexersPopover = ref<InstanceType<typeof Popover> | null>(null)
const errorPopover = ref<InstanceType<typeof Popover> | null>(null)

function toggleOtherIndexers(event: Event) {
  otherIndexersPopover.value?.toggle(event)
}

function toggleError(event: Event) {
  errorPopover.value?.toggle(event)
}
</script>

<template>
  <div
    v-if="
      statusChecks.synced !== null ||
      statusChecks.healthyCount > 0 ||
      statusChecks.failedCount > 0 ||
      (statusChecks.deterministicFailure !== null && statusChecks.deterministicFailure)
    "
    class="status-indicators"
  >
    <!-- Synced indicator (EBO epoch check) -->
    <span
      v-if="statusChecks.synced !== null"
      class="status-check"
      :title="statusChecks.synced ? 'Synced to epoch' : 'Behind epoch'"
    >
      <span :class="['dot', statusChecks.synced ? 'dot-green' : 'dot-red']" />
      <span class="check-label">Synced</span>
    </span>

    <!-- Other indexers health comparison (clickable) -->
    <span
      v-if="statusChecks.healthyCount > 0 || statusChecks.failedCount > 0"
      class="status-check status-check-interactive"
      :title="`Other indexers: ${statusChecks.healthyCount} healthy, ${statusChecks.failedCount} failed`"
      @click.stop="toggleOtherIndexers"
    >
      <span :class="['dot', statusChecks.healthComparison ? 'dot-green' : 'dot-red']" />
      <span class="check-label">{{ statusChecks.healthyCount }}/{{ statusChecks.failedCount }}</span>
    </span>
    <Popover ref="otherIndexersPopover">
      <OtherIndexersTooltip :details="statusChecks.otherIndexerDetails" />
    </Popover>

    <!-- Deterministic failure (clickable) -->
    <span
      v-if="statusChecks.deterministicFailure !== null && statusChecks.deterministicFailure"
      class="status-check status-check-interactive"
      :title="
        statusChecks.closable
          ? 'Deterministic failure - safe to close'
          : 'Deterministic failure - not safe to close'
      "
      @click.stop="toggleError"
    >
      <span :class="['dot', statusChecks.closable ? 'dot-yellow' : 'dot-red']" />
      <span class="check-label">Det.</span>
    </span>
    <Popover v-if="fatalError" ref="errorPopover">
      <ErrorDetail :fatal-error="fatalError" />
    </Popover>

    <!-- Closable composite indicator -->
    <span
      v-if="statusChecks.synced !== null || statusChecks.deterministicFailure !== null"
      class="status-check"
      :title="statusChecks.closable ? 'Safe to close' : 'Not safe to close'"
    >
      <span :class="['dot', statusChecks.closable ? 'dot-green' : 'dot-red']" />
      <span class="check-label">Close</span>
    </span>
  </div>
  <span v-else class="text-muted">-</span>
</template>

<style scoped>
.status-indicators {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  overflow: hidden;
}

.status-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.status-check-interactive {
  cursor: pointer;
  border-radius: 4px;
  padding: 1px 3px;
  margin: -1px -3px;
  transition: background-color 150ms ease-out;
}

.status-check-interactive:hover {
  background-color: var(--p-surface-100);
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

.check-label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
}

.text-muted {
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
  white-space: nowrap;
}
</style>
