<script setup lang="ts">
import { computed } from 'vue'
import { formatUnits } from 'viem'

const props = withDefaults(
  defineProps<{
    value: string | number
    decimals?: number
  }>(),
  { decimals: 2 },
)

const formatted = computed(() => {
  try {
    const raw = typeof props.value === 'number'
      ? props.value
      : Number(formatUnits(BigInt(props.value), 18))

    if (isNaN(raw)) return '0'

    // Format with commas and fixed decimals
    return raw.toLocaleString('en-US', {
      minimumFractionDigits: props.decimals,
      maximumFractionDigits: props.decimals,
    })
  } catch {
    return '0'
  }
})
</script>

<template>
  <span class="token-cell" :title="String(value)">
    {{ formatted }}
    <span class="token-symbol">GRT</span>
  </span>
</template>

<style scoped>
.token-cell {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.token-symbol {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  margin-left: 3px;
  letter-spacing: 0.02em;
}
</style>
