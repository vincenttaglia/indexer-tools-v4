<script setup lang="ts">
defineProps<{
  displayName: string
  ipfsHash: string
  imageUrl: string | null
}>()
</script>

<template>
  <div class="deployment-name-cell">
    <img
      v-if="imageUrl"
      :src="imageUrl"
      class="deployment-avatar"
      loading="lazy"
      @error="($event.target as HTMLImageElement).style.display = 'none'"
    />
    <div v-else class="deployment-avatar-placeholder">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <text x="12" y="16" text-anchor="middle" font-size="12" fill="currentColor" stroke="none">?</text>
      </svg>
    </div>
    <div class="deployment-text">
      <span class="deployment-display-name">{{ displayName }}</span>
      <span class="deployment-hash">{{ ipfsHash }}</span>
    </div>
  </div>
</template>

<style scoped>
.deployment-name-cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
}

.deployment-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.deployment-avatar-placeholder {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color);
  opacity: 0.5;
}

.deployment-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  overflow: hidden;
}

.deployment-display-name {
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deployment-hash {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  overflow-x: auto;
  white-space: nowrap;
  user-select: all;
}
</style>
