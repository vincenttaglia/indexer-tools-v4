<script setup lang="ts">
import { ref } from 'vue'
import type { FatalError } from '@/types/status'
import { formatNumber } from '@/services/formatting/numbers'

defineProps<{
  fatalError: FatalError
}>()

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
  <div class="error-detail">
    <!-- Deterministic flag -->
    <div class="error-row">
      <i
        :class="[
          'pi',
          fatalError.deterministic ? 'pi-check' : 'pi-times',
          fatalError.deterministic ? 'icon-green' : 'icon-red',
        ]"
      />
      <span class="value">
        {{ fatalError.deterministic ? 'Deterministic' : 'Non-Deterministic' }}
      </span>
    </div>

    <!-- Block number -->
    <div v-if="fatalError.block" class="error-row">
      <span class="label">Block:</span>
      <span class="value">{{ formatNumber(fatalError.block.number, 0) }}</span>
      <span
        class="copy-btn"
        :class="{ copied: copiedField === 'block' }"
        :title="copiedField === 'block' ? 'Copied!' : 'Copy block number'"
        @click.stop="copyToClipboard(String(fatalError.block!.number), 'block')"
      >
        <i :class="['pi', copiedField === 'block' ? 'pi-check' : 'pi-copy']" />
      </span>
    </div>

    <!-- Block hash -->
    <div v-if="fatalError.block" class="error-row">
      <span class="label">Hash:</span>
      <span class="value hash-value">{{ fatalError.block.hash }}</span>
      <span
        class="copy-btn"
        :class="{ copied: copiedField === 'hash' }"
        :title="copiedField === 'hash' ? 'Copied!' : 'Copy block hash'"
        @click.stop="copyToClipboard(fatalError.block!.hash, 'hash')"
      >
        <i :class="['pi', copiedField === 'hash' ? 'pi-check' : 'pi-copy']" />
      </span>
    </div>

    <!-- Error message -->
    <div class="error-row error-message-row">
      <span class="label">Error:</span>
      <span
        class="copy-btn"
        :class="{ copied: copiedField === 'message' }"
        :title="copiedField === 'message' ? 'Copied!' : 'Copy error message'"
        @click.stop="copyToClipboard(fatalError.message, 'message')"
      >
        <i :class="['pi', copiedField === 'message' ? 'pi-check' : 'pi-copy']" />
      </span>
    </div>
    <div class="error-message-box">
      {{ fatalError.message }}
    </div>
  </div>
</template>

<style scoped>
.error-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.8125rem;
  min-width: 280px;
  max-width: 420px;
}

.error-row {
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

.icon-green {
  color: var(--p-green-400);
}

.icon-red {
  color: var(--p-red-400);
}

.error-message-row {
  margin-top: 2px;
}

.error-message-box {
  background-color: var(--app-surface-100);
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--p-text-color);
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
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
