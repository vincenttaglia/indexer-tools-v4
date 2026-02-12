<script setup lang="ts">
import { computed, ref } from 'vue'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import { useSettingsStore } from '@/stores/settingsStore'

const props = defineProps<{
  dashboardId: string
  columns: Array<{ id: string; label: string }>
}>()

const settingsStore = useSettingsStore()

/** Default column IDs derived from props */
const defaultColumnIds = computed(() => props.columns.map(c => c.id))

/** Current column config merged with labels from props */
const orderedColumns = computed(() => {
  const config = settingsStore.getColumnConfig(props.dashboardId, defaultColumnIds.value)
  const labelMap = new Map(props.columns.map(c => [c.id, c.label]))
  return config.map(c => ({
    id: c.id,
    label: labelMap.get(c.id) ?? c.id,
    visible: c.visible,
  }))
})

/** Index of the item currently being dragged */
const dragIndex = ref<number | null>(null)

/** Index of the item currently being dragged over */
const dragOverIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(index: number, event: DragEvent) {
  dragOverIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(toIndex: number) {
  if (dragIndex.value !== null && dragIndex.value !== toIndex) {
    settingsStore.reorderColumns(props.dashboardId, dragIndex.value, toIndex)
  }
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

function toggleColumn(columnId: string, visible: boolean) {
  settingsStore.setColumnVisibility(props.dashboardId, columnId, visible)
}

function resetToDefaults() {
  settingsStore.resetColumnConfig(props.dashboardId)
}
</script>

<template>
  <div class="column-customizer">
    <div class="column-list">
      <div
        v-for="(col, index) in orderedColumns"
        :key="col.id"
        class="column-item"
        :class="{
          'dragging': dragIndex === index,
          'dragging-over': dragOverIndex === index && dragIndex !== index,
        }"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragover.prevent="onDragOver(index, $event)"
        @drop="onDrop(index)"
        @dragend="onDragEnd"
      >
        <span class="drag-handle" title="Drag to reorder">
          <i class="pi pi-bars" />
        </span>
        <span class="column-label">{{ col.label }}</span>
        <ToggleSwitch
          :model-value="col.visible"
          @update:model-value="toggleColumn(col.id, $event as boolean)"
        />
      </div>
    </div>
    <div class="column-actions">
      <Button
        label="Reset to Defaults"
        severity="secondary"
        size="small"
        outlined
        @click="resetToDefaults"
      />
    </div>
  </div>
</template>

<style scoped>
.column-customizer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.column-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.column-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 12px;
  background: var(--app-surface-50);
  border: 1px solid var(--app-surface-200);
  border-radius: 6px;
  cursor: grab;
  transition: background-color 150ms ease-out, border-color 150ms ease-out;
  user-select: none;
}

.column-item:hover {
  border-color: var(--app-surface-300);
}

.column-item.dragging {
  opacity: 0.5;
}

.column-item.dragging-over {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 6%, var(--app-surface-50));
}

.drag-handle {
  display: flex;
  align-items: center;
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  cursor: grab;
  flex-shrink: 0;
}

.column-label {
  flex: 1;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--p-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.column-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}
</style>
