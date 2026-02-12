<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Popover from 'primevue/popover'
import { formatNumber } from '@/services/formatting/numbers'

const props = defineProps<{
  /** Allocation creation time as a Unix timestamp (seconds) */
  createdAt: number
  /** Epoch number when the allocation was created */
  createdAtEpoch?: number
  /** Block number when the allocation was created */
  createdAtBlockNumber?: number
  /** Block hash when the allocation was created */
  createdAtBlockHash?: string
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

/** Human-readable creation date */
const createdAtFormatted = computed(() => {
  const d = new Date(props.createdAt * 1000)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
  })
})

/** Popover ref */
const popoverRef = ref<InstanceType<typeof Popover> | null>(null)

function togglePopover(event: Event) {
  popoverRef.value?.toggle(event)
}

/** Copy-to-clipboard with checkmark feedback */
const copiedField = ref<string | null>(null)

async function copyToClipboard(text: string, field: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    setTimeout(() => {
      copiedField.value = null
    }, 1500)
  } catch {
    // Clipboard API not available
  }
}
</script>

<template>
  <span class="duration-cell" :class="colorClass" @click.stop="togglePopover">
    {{ formatted }}
  </span>
  <Popover ref="popoverRef" appendTo="body">
    <div class="duration-popover">
      <!-- Created at -->
      <div class="popover-row">
        <span class="label">Created at:</span>
        <span class="value">{{ createdAtFormatted }}</span>
      </div>

      <!-- Epoch created -->
      <div v-if="createdAtEpoch != null" class="popover-row">
        <span class="label">Epoch created:</span>
        <span class="value">{{ formatNumber(createdAtEpoch, 0) }}</span>
      </div>

      <!-- Running for -->
      <div class="popover-row">
        <span class="label">Running for:</span>
        <span class="value" :class="colorClass">{{ formatted }}</span>
      </div>

      <!-- Block created -->
      <div v-if="createdAtBlockNumber != null" class="popover-row">
        <span class="label">Block created:</span>
        <span class="value">{{ formatNumber(createdAtBlockNumber, 0) }}</span>
      </div>

      <!-- Block hash -->
      <div v-if="createdAtBlockHash" class="popover-row">
        <span class="label">Block hash:</span>
        <span class="value hash-value">{{ createdAtBlockHash }}</span>
        <span
          class="copy-btn"
          :class="{ copied: copiedField === 'blockHash' }"
          :title="copiedField === 'blockHash' ? 'Copied!' : 'Copy block hash'"
          @click.stop="copyToClipboard(createdAtBlockHash!, 'blockHash')"
        >
          <i :class="['pi', copiedField === 'blockHash' ? 'pi-check' : 'pi-copy']" />
        </span>
      </div>
    </div>
  </Popover>
</template>

<style scoped>
.duration-cell {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.duration-cell:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
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

/* --- Popover content --- */
.duration-popover {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.8125rem;
  min-width: 280px;
  max-width: 480px;
}

.popover-row {
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
  overflow: hidden;
  text-overflow: ellipsis;
}

.hash-value {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  font-size: 0.75rem;
  word-break: break-all;
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
</style>
