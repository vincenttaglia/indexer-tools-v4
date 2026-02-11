<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    decimals?: number
  }>(),
  { decimals: 2 },
)

const formatted = computed(() => {
  if (isNaN(props.value) || !isFinite(props.value)) return '0.00%'
  return `${props.value.toFixed(props.decimals)}%`
})

const colorClass = computed(() => {
  if (props.value > 0) return 'positive'
  if (props.value < 0) return 'negative'
  return 'neutral'
})
</script>

<template>
  <span class="percent-cell" :class="colorClass" :title="`${value}%`">
    {{ formatted }}
  </span>
</template>

<style scoped>
.percent-cell {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.positive {
  color: var(--p-green-400);
}

.negative {
  color: var(--p-red-400);
}

.neutral {
  color: var(--p-text-muted-color);
}
</style>
