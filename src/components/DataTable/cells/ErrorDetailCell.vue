<script setup lang="ts">
import { ref } from 'vue'
import Popover from 'primevue/popover'
import type { FatalError } from '@/types/status'
import ErrorDetail from '@/components/ErrorDetail.vue'

const props = defineProps<{
  fatalError: FatalError
}>()

const popoverRef = ref<InstanceType<typeof Popover> | null>(null)

function togglePopover(event: Event) {
  popoverRef.value?.toggle(event)
}

/** Compute a short preview label */
function getPreview(): string {
  if (props.fatalError.deterministic) {
    return 'Deterministic failure'
  }
  const msg = props.fatalError.message
  if (msg.length > 40) return msg.slice(0, 40) + '...'
  return msg
}
</script>

<template>
  <span
    class="error-cell"
    :title="fatalError.message"
    @click.stop="togglePopover"
  >
    {{ getPreview() }}
  </span>
  <Popover ref="popoverRef">
    <ErrorDetail :fatal-error="fatalError" />
  </Popover>
</template>

<style scoped>
.error-cell {
  font-size: 0.75rem;
  color: var(--p-red-400);
  cursor: pointer;
  white-space: nowrap;
  min-width: 0;
  border-radius: 4px;
  padding: 1px 3px;
  margin: -1px -3px;
  transition: background-color 150ms ease-out;
}

.error-cell:hover {
  background-color: var(--app-surface-100);
}
</style>
