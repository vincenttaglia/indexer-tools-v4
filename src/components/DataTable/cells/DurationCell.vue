<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  /** Allocation creation time as a Unix timestamp (seconds) */
  createdAt: number
}>()

const now = ref(Math.floor(Date.now() / 1000))
let intervalId: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  intervalId = setInterval(() => {
    now.value = Math.floor(Date.now() / 1000)
  }, 1000)
})

onUnmounted(() => {
  if (intervalId !== null) clearInterval(intervalId)
})

const elapsed = computed(() => now.value - props.createdAt)

const formatted = computed(() => {
  let remaining = Math.max(0, elapsed.value)
  const days = Math.floor(remaining / 86400)
  remaining %= 86400
  const hours = Math.floor(remaining / 3600)
  remaining %= 3600
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
})

const totalDays = computed(() => elapsed.value / 86400)

const colorClass = computed(() => {
  if (totalDays.value >= 28) return 'duration-red'
  if (totalDays.value >= 14) return 'duration-yellow'
  return 'duration-green'
})
</script>

<template>
  <span class="duration-cell" :class="colorClass" :title="`Created at ${new Date(createdAt * 1000).toISOString()}`">
    {{ formatted }}
  </span>
</template>

<style scoped>
.duration-cell {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
}

.duration-green {
  color: var(--p-green-400);
}

.duration-yellow {
  color: var(--p-yellow-400);
}

.duration-red {
  color: var(--p-red-400);
}
</style>
