<script setup lang="ts">
import { ref } from 'vue'
import type { HealthStatus } from '@/types/status'

const props = withDefaults(defineProps<{
  imageUrl: string | null
  health: HealthStatus | null
  synced: boolean | null
  denied: boolean
  size?: number
}>(), {
  size: 28,
})

defineEmits<{
  click: [event: Event]
}>()

const imgError = ref(false)

function onImgError() {
  imgError.value = true
}

function ringColor(): string {
  if (props.health === 'failed') return 'var(--p-red-400)'
  if (props.health === 'unhealthy') return 'var(--p-yellow-400)'
  if (props.health === 'healthy' && props.synced === true) return 'var(--p-green-400)'
  if (props.health === 'healthy') return 'var(--p-blue-400)'
  return 'var(--p-surface-300)'
}
</script>

<template>
  <div
    class="avatar-container"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      boxShadow: `0 0 0 2px ${ringColor()}`,
    }"
    @click="$emit('click', $event)"
  >
    <img
      v-if="imageUrl && !imgError"
      :src="imageUrl"
      loading="lazy"
      class="avatar-img"
      :style="{ width: `${size - 4}px`, height: `${size - 4}px` }"
      @error="onImgError"
    />
    <svg
      v-else
      class="avatar-fallback"
      :width="size - 4"
      :height="size - 4"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="11" fill="var(--p-surface-200)" />
      <text
        x="12"
        y="16"
        text-anchor="middle"
        fill="var(--p-text-muted-color)"
        font-size="12"
        font-weight="600"
      >?</text>
    </svg>

    <!-- Denied badge -->
    <span v-if="denied" class="denied-badge">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="5" fill="var(--p-red-400)" />
        <line x1="3" y1="3" x2="7" y2="7" stroke="white" stroke-width="1.5" stroke-linecap="round" />
        <line x1="7" y1="3" x2="3" y2="7" stroke="white" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.avatar-container {
  position: relative;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 150ms ease-out;
  overflow: visible;
}

.avatar-container:hover {
  transform: scale(1.05);
}

.avatar-img {
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.avatar-fallback {
  display: block;
}

.denied-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}
</style>
