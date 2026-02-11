<script setup lang="ts">
import { computed } from 'vue'
import type { HealthStatus } from '@/types'

const props = defineProps<{
  status: HealthStatus | null
}>()

const config = computed(() => {
  switch (props.status) {
    case 'healthy':
      return { label: 'Healthy', cssClass: 'healthy' }
    case 'unhealthy':
      return { label: 'Unhealthy', cssClass: 'unhealthy' }
    case 'failed':
      return { label: 'Failed', cssClass: 'failed' }
    default:
      return { label: 'Unknown', cssClass: 'unknown' }
  }
})
</script>

<template>
  <span class="health-badge" :class="config.cssClass">
    <span class="health-dot" />
    {{ config.label }}
  </span>
</template>

<style scoped>
.health-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  max-width: 100%;
  letter-spacing: 0.01em;
}

.health-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.healthy {
  background-color: color-mix(in srgb, var(--p-green-400) 12%, transparent);
  color: var(--p-green-400);
}

.healthy .health-dot {
  background-color: var(--p-green-400);
}

.unhealthy {
  background-color: color-mix(in srgb, var(--p-yellow-400) 12%, transparent);
  color: var(--p-yellow-400);
}

.unhealthy .health-dot {
  background-color: var(--p-yellow-400);
}

.failed {
  background-color: color-mix(in srgb, var(--p-red-400) 12%, transparent);
  color: var(--p-red-400);
}

.failed .health-dot {
  background-color: var(--p-red-400);
}

.unknown {
  background-color: color-mix(in srgb, var(--app-surface-400) 10%, transparent);
  color: var(--p-text-muted-color);
}

.unknown .health-dot {
  background-color: var(--app-surface-400);
}
</style>
