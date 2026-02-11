<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    address: string
    explorerUrl?: string
  }>(),
  { explorerUrl: undefined },
)

const copied = ref(false)

const shortened = computed(() => {
  if (!props.address || props.address.length < 10) return props.address
  return `${props.address.slice(0, 6)}...${props.address.slice(-4)}`
})

const fullExplorerUrl = computed(() => {
  if (!props.explorerUrl) return null
  const base = props.explorerUrl.endsWith('/')
    ? props.explorerUrl
    : `${props.explorerUrl}/`
  return `${base}address/${props.address}`
})

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(props.address)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    // Clipboard API not available
  }
}
</script>

<template>
  <span class="address-cell">
    <a
      v-if="fullExplorerUrl"
      :href="fullExplorerUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="address-link"
      :title="address"
    >
      {{ shortened }}
    </a>
    <span v-else class="address-text" :title="address">
      {{ shortened }}
    </span>
    <button
      class="copy-btn"
      :class="{ copied }"
      :title="copied ? 'Copied!' : 'Copy address'"
      @click.stop="copyToClipboard"
    >
      <svg
        v-if="!copied"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <svg
        v-else
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  </span>
</template>

<style scoped>
.address-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.address-link {
  color: var(--p-primary-color);
  text-decoration: none;
  transition: opacity 150ms ease-out;
}

.address-link:hover {
  text-decoration: underline;
  opacity: 0.85;
}

.address-text {
  color: var(--p-text-color);
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--p-text-muted-color);
  opacity: 0.5;
  transition: all 150ms ease-out;
  flex-shrink: 0;
}

.address-cell:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  color: var(--p-text-color);
  background-color: var(--p-surface-200);
}

.copy-btn.copied {
  color: var(--p-green-400);
  opacity: 1;
}
</style>
