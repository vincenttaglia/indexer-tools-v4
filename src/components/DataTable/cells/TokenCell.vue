<script setup lang="ts">
import { computed } from 'vue'
import { formatUnits } from 'viem'
import { abbreviateNumber } from '@/services/formatting/numbers'

const props = withDefaults(
  defineProps<{
    value: string | number
    decimals?: number
  }>(),
  { decimals: 2 },
)

const rawNumber = computed(() => {
  try {
    const num = typeof props.value === 'number'
      ? props.value
      : Number(formatUnits(BigInt(props.value), 18))
    return isNaN(num) ? 0 : num
  } catch {
    return 0
  }
})

const formatted = computed(() => abbreviateNumber(rawNumber.value))

const fullValue = computed(() =>
  rawNumber.value.toLocaleString('en-US', {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals,
  })
)
</script>

<template>
  <span class="token-cell" :title="`${fullValue} GRT`">
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
}

.token-symbol {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  margin-left: 3px;
  letter-spacing: 0.02em;
}
</style>
