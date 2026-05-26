<script setup lang="ts" generic="T">
import { ref, computed, watch } from 'vue'
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  FlexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'

const props = withDefaults(
  defineProps<{
    data: T[]
    columns: ColumnDef<T, any>[]
    loading?: boolean
    rowHeight?: number
    tableHeight?: string
    enableSelection?: boolean
    selectedKeys?: Set<string>
    getRowId?: (row: T) => string
    emptyMessage?: string
  }>(),
  {
    loading: false,
    rowHeight: 48,
    tableHeight: '100%',
    enableSelection: false,
    selectedKeys: () => new Set<string>(),
    getRowId: undefined,
    emptyMessage: 'No data available',
  },
)

const emit = defineEmits<{
  'row-click': [row: T]
  'selection-change': [selectedIds: Set<string>]
}>()

// --- Sorting state ---
const sorting = ref<SortingState>([])

// --- Row selection state ---
const rowSelection = ref<RowSelectionState>({})

// Sync external selectedKeys prop into internal state
watch(
  () => props.selectedKeys,
  (keys) => {
    const newState: RowSelectionState = {}
    for (const key of keys) {
      newState[key] = true
    }
    rowSelection.value = newState
  },
  { immediate: true },
)

// --- Build selection column ---
const selectionColumn = computed<ColumnDef<T, any>[]>(() => {
  if (!props.enableSelection) return []
  return [
    {
      id: '_selection',
      size: 48,
      enableSorting: false,
      header: ({ table }) => {
        const checked = table.getIsAllRowsSelected()
        const indeterminate = table.getIsSomeRowsSelected()
        return {
          component: 'checkbox-header',
          checked,
          indeterminate,
          onChange: table.getToggleAllRowsSelectedHandler(),
        }
      },
      cell: ({ row }) => {
        return {
          component: 'checkbox-cell',
          checked: row.getIsSelected(),
          onChange: row.getToggleSelectedHandler(),
        }
      },
    },
  ]
})

// --- Merged columns ---
const mergedColumns = computed<ColumnDef<T, any>[]>(() => [
  ...selectionColumn.value,
  ...props.columns,
])

// --- TanStack Table ---
const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return mergedColumns.value
  },
  state: {
    get sorting() {
      return sorting.value
    },
    get rowSelection() {
      return rowSelection.value
    },
  },
  getRowId: props.getRowId
    ? (row) => props.getRowId!(row)
    : undefined,
  enableRowSelection: props.enableSelection,
  onSortingChange: (updaterOrValue) => {
    sorting.value =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting.value)
        : updaterOrValue
  },
  onRowSelectionChange: (updaterOrValue) => {
    rowSelection.value =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(rowSelection.value)
        : updaterOrValue

    // Emit selection change
    const selectedIds = new Set<string>()
    for (const [id, selected] of Object.entries(rowSelection.value)) {
      if (selected) selectedIds.add(id)
    }
    emit('selection-change', selectedIds)
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})

// --- Rows for virtual rendering ---
const rows = computed(() => table.getRowModel().rows)

// --- Virtual scroller ---
const tableContainerRef = ref<HTMLDivElement | null>(null)

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => tableContainerRef.value,
    estimateSize: () => props.rowHeight,
    overscan: 10,
  })),
)

const virtualRows = computed(() => virtualizer.value.getVirtualItems())

/** Get a row by virtual index — guaranteed valid for rendered virtual items */
function getRow(index: number) {
  return rows.value[index]!
}
const totalSize = computed(() => virtualizer.value.getTotalSize())

// --- Skeleton rows for loading state ---
const skeletonRows = computed(() =>
  Array.from({ length: 8 }, (_, i) => i),
)

// --- Helpers ---
const suppressNextClick = ref(false)
function handleRowClick(row: T) {
  if (suppressNextClick.value) return
  emit('row-click', row)
}

// ---------------------------------------------------------------------------
// Drag-to-rubber-band multi-select
//
// Active when `enableSelection` is true. On pointer-down anywhere in the
// container that isn't an interactive element (button/link/input/header),
// start tracking; once the pointer moves past DRAG_THRESHOLD pixels, render
// a rubber-band overlay and accumulate every row whose bounding rect has
// intersected the band during this drag.
//
// Modifier semantics (file-manager style):
//   - Plain drag         → ADD to existing selection (always additive)
//   - Alt/Option + drag  → REMOVE from existing selection
//
// Multiple consecutive drags accumulate naturally. To deselect everything,
// click the header checkbox or use a consumer-provided "Clear" affordance.
// Auto-scrolls when the pointer nears the container's top/bottom edge.
// ---------------------------------------------------------------------------
const DRAG_THRESHOLD = 4
const AUTO_SCROLL_ZONE = 32
const AUTO_SCROLL_SPEED = 14

const dragStart = ref<{ x: number; y: number } | null>(null)
const dragCurrent = ref<{ x: number; y: number } | null>(null)
const isDragging = ref(false)
const dragSubtractive = ref(false)
const draggedRowIds = ref<Set<string>>(new Set())
const selectionAtDragStart = ref<Set<string>>(new Set())

const rubberBandStyle = computed(() => {
  if (!isDragging.value || !dragStart.value || !dragCurrent.value) return null
  const left = Math.min(dragStart.value.x, dragCurrent.value.x)
  const top = Math.min(dragStart.value.y, dragCurrent.value.y)
  const width = Math.abs(dragCurrent.value.x - dragStart.value.x)
  const height = Math.abs(dragCurrent.value.y - dragStart.value.y)
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
})

function isInteractiveTarget(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null
  while (node && node !== document.body) {
    const tag = node.tagName
    if (
      tag === 'INPUT' ||
      tag === 'BUTTON' ||
      tag === 'A' ||
      tag === 'LABEL' ||
      tag === 'SELECT' ||
      tag === 'TEXTAREA'
    ) {
      return true
    }
    if (node.dataset?.noDrag === 'true') return true
    node = node.parentElement
  }
  return false
}

function isInTableHeader(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null
  while (node && node !== document.body) {
    if (node.classList?.contains('data-table-head')) return true
    node = node.parentElement
  }
  return false
}

function onContainerPointerDown(ev: PointerEvent) {
  if (!props.enableSelection) return
  if (ev.button !== 0) return // left-click only
  if (isInteractiveTarget(ev.target)) return
  if (isInTableHeader(ev.target)) return

  dragStart.value = { x: ev.clientX, y: ev.clientY }
  dragCurrent.value = { x: ev.clientX, y: ev.clientY }
  dragSubtractive.value = ev.altKey
  draggedRowIds.value = new Set()

  const baseline = new Set<string>()
  for (const [id, sel] of Object.entries(rowSelection.value)) {
    if (sel) baseline.add(id)
  }
  selectionAtDragStart.value = baseline
}

function commitDragSelection() {
  // Start from the pre-drag baseline. In additive mode we ADD the dragged
  // rows; in subtractive mode (Alt held) we REMOVE them.
  const next: RowSelectionState = {}
  for (const id of selectionAtDragStart.value) next[id] = true
  if (dragSubtractive.value) {
    for (const id of draggedRowIds.value) delete next[id]
  } else {
    for (const id of draggedRowIds.value) next[id] = true
  }

  // Avoid an extra emit when nothing changed.
  const currentKeys = Object.keys(rowSelection.value).filter((k) => rowSelection.value[k])
  const nextKeys = Object.keys(next)
  if (
    currentKeys.length === nextKeys.length &&
    currentKeys.every((k) => next[k])
  ) {
    return
  }

  rowSelection.value = next
  const selectedIds = new Set<string>()
  for (const [id, sel] of Object.entries(next)) {
    if (sel) selectedIds.add(id)
  }
  emit('selection-change', selectedIds)
}

function onContainerPointerMove(ev: PointerEvent) {
  if (!dragStart.value) return
  dragCurrent.value = { x: ev.clientX, y: ev.clientY }

  if (!isDragging.value) {
    const dx = ev.clientX - dragStart.value.x
    const dy = ev.clientY - dragStart.value.y
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    isDragging.value = true
    try {
      ;(ev.currentTarget as HTMLElement | null)?.setPointerCapture?.(ev.pointerId)
    } catch {
      /* setPointerCapture is best-effort; ignore failures */
    }
  }

  const container = tableContainerRef.value
  if (!container) return

  // Band rect in viewport coords.
  const bandLeft = Math.min(dragStart.value.x, ev.clientX)
  const bandTop = Math.min(dragStart.value.y, ev.clientY)
  const bandRight = Math.max(dragStart.value.x, ev.clientX)
  const bandBottom = Math.max(dragStart.value.y, ev.clientY)

  // Accumulate intersected rows. Only currently-rendered virtual rows are
  // checked, but the accumulated set survives scrolling, so rows that scroll
  // out of view stay selected.
  const rowEls = container.querySelectorAll<HTMLElement>('[data-row-id]')
  rowEls.forEach((rowEl) => {
    const r = rowEl.getBoundingClientRect()
    if (
      r.right >= bandLeft &&
      r.left <= bandRight &&
      r.bottom >= bandTop &&
      r.top <= bandBottom
    ) {
      const id = rowEl.dataset.rowId
      if (id) draggedRowIds.value.add(id)
    }
  })

  commitDragSelection()

  // Auto-scroll when near container edges.
  const cRect = container.getBoundingClientRect()
  if (ev.clientY < cRect.top + AUTO_SCROLL_ZONE) {
    container.scrollTop -= AUTO_SCROLL_SPEED
  } else if (ev.clientY > cRect.bottom - AUTO_SCROLL_ZONE) {
    container.scrollTop += AUTO_SCROLL_SPEED
  }
}

function onContainerPointerUp(ev: PointerEvent) {
  if (isDragging.value) {
    try {
      ;(ev.currentTarget as HTMLElement | null)?.releasePointerCapture?.(ev.pointerId)
    } catch {
      /* ignore */
    }
    // The browser fires a synthetic click on pointerup; swallow it so the
    // row's @click handler doesn't fire on the row we ended the drag on.
    suppressNextClick.value = true
    setTimeout(() => {
      suppressNextClick.value = false
    }, 0)
  }
  isDragging.value = false
  dragStart.value = null
  dragCurrent.value = null
}

</script>

<template>
  <div
    ref="tableContainerRef"
    class="data-table-container"
    :class="{ 'is-dragging': isDragging }"
    :style="{ height: tableHeight }"
    @pointerdown="onContainerPointerDown"
    @pointermove="onContainerPointerMove"
    @pointerup="onContainerPointerUp"
    @pointercancel="onContainerPointerUp"
  >
    <table class="data-table">
      <thead class="data-table-head">
        <tr
          v-for="headerGroup in table.getHeaderGroups()"
          :key="headerGroup.id"
          class="data-table-header-row"
        >
          <th
            v-for="header in headerGroup.headers"
            :key="header.id"
            class="data-table-th"
            :class="{
              sortable: header.column.getCanSort(),
              'selection-col': header.column.id === '_selection',
            }"
            :style="{
              width: header.column.id === '_selection'
                ? '48px'
                : `${header.getSize()}px`,
              minWidth: header.column.id === '_selection'
                ? '48px'
                : `${header.getSize()}px`,
              maxWidth: header.column.id === '_selection'
                ? '48px'
                : `${header.getSize()}px`,
            }"
            @click="header.column.getCanSort() ? header.column.getToggleSortingHandler()?.($event) : undefined"
          >
            <template v-if="!header.isPlaceholder">
              <!-- Selection checkbox in header -->
              <template v-if="header.column.id === '_selection'">
                <input
                  type="checkbox"
                  class="row-checkbox"
                  :checked="table.getIsAllRowsSelected()"
                  :indeterminate="table.getIsSomeRowsSelected()"
                  @change="table.getToggleAllRowsSelectedHandler()($event)"
                  @click.stop
                />
              </template>
              <template v-else>
                <div class="th-content">
                  <FlexRender
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <span v-if="header.column.getCanSort()" class="sort-indicator">
                    <svg
                      v-if="header.column.getIsSorted() === 'asc'"
                      class="sort-icon active"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                    <svg
                      v-else-if="header.column.getIsSorted() === 'desc'"
                      class="sort-icon active"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <svg
                      v-else
                      class="sort-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="8 7 12 3 16 7" />
                      <polyline points="16 17 12 21 8 17" />
                    </svg>
                  </span>
                </div>
              </template>
            </template>
          </th>
        </tr>
      </thead>

      <tbody
        class="data-table-body"
        :style="{ height: `${totalSize}px` }"
      >
        <!-- Loading skeleton -->
        <template v-if="loading">
          <tr
            v-for="i in skeletonRows"
            :key="`skeleton-${i}`"
            class="data-table-row skeleton-row"
            :style="{ height: `${rowHeight}px` }"
          >
            <td
              v-for="header in table.getHeaderGroups()[0]?.headers ?? []"
              :key="`skeleton-cell-${header.id}-${i}`"
              class="data-table-td"
              :style="{
                width: header.column.id === '_selection'
                  ? '48px'
                  : `${header.getSize()}px`,
                minWidth: header.column.id === '_selection'
                  ? '48px'
                  : `${header.getSize()}px`,
                maxWidth: header.column.id === '_selection'
                  ? '48px'
                  : `${header.getSize()}px`,
              }"
            >
              <div class="skeleton-bar" />
            </td>
          </tr>
        </template>

        <!-- Empty state -->
        <tr v-else-if="rows.length === 0" class="empty-row">
          <td
            class="empty-cell"
          >
            <div class="empty-state">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
              <span>{{ emptyMessage }}</span>
            </div>
          </td>
        </tr>

        <!-- Virtual rows -->
        <template v-else>
          <tr
            v-for="virtualRow in virtualRows"
            :key="getRow(virtualRow.index).id"
            class="data-table-row"
            :class="{
              selected: getRow(virtualRow.index).getIsSelected(),
            }"
            :data-row-id="getRow(virtualRow.index).id"
            :style="{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }"
            @click="handleRowClick(getRow(virtualRow.index).original)"
          >
            <td
              v-for="cell in getRow(virtualRow.index).getVisibleCells()"
              :key="cell.id"
              class="data-table-td"
              :class="{
                'selection-col': cell.column.id === '_selection',
              }"
              :style="{
                width: cell.column.id === '_selection'
                  ? '48px'
                  : `${cell.column.getSize()}px`,
                minWidth: cell.column.id === '_selection'
                  ? '48px'
                  : `${cell.column.getSize()}px`,
                maxWidth: cell.column.id === '_selection'
                  ? '48px'
                  : `${cell.column.getSize()}px`,
              }"
            >
              <!-- Selection checkbox in cell -->
              <template v-if="cell.column.id === '_selection'">
                <input
                  type="checkbox"
                  class="row-checkbox"
                  :checked="getRow(virtualRow.index).getIsSelected()"
                  @change="getRow(virtualRow.index).getToggleSelectedHandler()($event)"
                  @click.stop
                />
              </template>
              <template v-else>
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </template>
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <!-- Drag-select rubber band overlay (viewport-fixed) -->
    <div
      v-if="rubberBandStyle"
      class="drag-rubber-band"
      :class="{ subtract: dragSubtractive }"
      :style="rubberBandStyle"
    />
  </div>
</template>

<style scoped>
.data-table-container {
  overflow: auto;
  position: relative;
  border: 1px solid var(--app-surface-200);
  border-radius: 12px;
  background-color: var(--app-surface-0);
}

.data-table {
  width: 100%;
  display: block;
  border-spacing: 0;
}

/* --- Header --- */
.data-table-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: block;
}

.data-table-header-row {
  display: flex;
  min-width: 100%;
  background-color: var(--app-surface-50);
  border-bottom: 1px solid var(--app-surface-200);
}

.data-table-th {
  padding: 0 16px;
  height: 40px;
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  background-color: var(--app-surface-50);
  user-select: none;
  white-space: nowrap;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  flex-shrink: 0;
  flex-grow: 0;
  transition: background-color 150ms ease-out, color 150ms ease-out;
}

.data-table-th.sortable {
  cursor: pointer;
}

.data-table-th.sortable:hover {
  color: var(--p-text-color);
  background-color: var(--app-surface-100);
}

.data-table-th.selection-col {
  text-align: center;
  padding: 0;
  justify-content: center;
}

.th-content {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* --- Sort indicators --- */
.sort-indicator {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.sort-icon {
  color: var(--app-surface-400);
  transition: color 150ms ease-out;
}

.sort-icon.active {
  color: var(--p-primary-color);
}

/* --- Body --- */
.data-table-body {
  position: relative;
  width: 100%;
  display: block;
}

/* --- Rows --- */
.data-table-row {
  position: absolute;
  top: 0;
  left: 0;
  min-width: 100%;
  display: flex;
  align-items: center;
  transition: background-color 150ms ease-out;
  cursor: default;
}

.data-table-row:hover {
  background-color: var(--app-surface-50);
}

.data-table-row.selected {
  background-color: color-mix(in srgb, var(--p-primary-color) 6%, var(--app-surface-0));
}

.data-table-row.selected:hover {
  background-color: color-mix(in srgb, var(--p-primary-color) 10%, var(--app-surface-0));
}

/* --- Cells --- */
.data-table-td {
  padding: 0 16px;
  font-size: 0.8125rem;
  color: var(--p-text-color);
  border-bottom: 1px solid var(--app-surface-100);
  white-space: nowrap;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  flex-shrink: 0;
  flex-grow: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-table-td.selection-col {
  text-align: center;
  padding: 0;
  justify-content: center;
}

/* --- Checkbox --- */
.row-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--p-primary-color);
}

/* --- Loading skeleton --- */
.skeleton-row {
  cursor: default;
  display: flex;
  align-items: center;
  min-width: 100%;
}

.skeleton-row:hover {
  background-color: transparent !important;
}

.skeleton-bar {
  height: 12px;
  width: 70%;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--app-surface-100) 25%,
    var(--app-surface-200) 50%,
    var(--app-surface-100) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* --- Empty state --- */
.empty-row {
  cursor: default;
  display: flex;
  min-width: 100%;
}

.empty-cell {
  padding: 64px 16px;
  text-align: center;
  flex: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--p-text-muted-color);
}

.empty-state svg {
  opacity: 0.3;
  color: var(--app-surface-400);
}

.empty-state span {
  font-size: 0.8125rem;
  max-width: 320px;
  line-height: 1.5;
}

/* --- Drag rubber band --- */
.drag-rubber-band {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
  background-color: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 55%, transparent);
  border-radius: 2px;
}

/* Subtractive drag (Alt held) uses a red tint so the user can tell the
   selection will shrink instead of grow. */
.drag-rubber-band.subtract {
  background-color: color-mix(in srgb, var(--p-red-400) 15%, transparent);
  border-color: color-mix(in srgb, var(--p-red-400) 55%, transparent);
}

/* While dragging, suppress text-selection and the row hover that would
   otherwise flicker as the band sweeps across. */
.data-table-container.is-dragging {
  user-select: none;
}

.data-table-container.is-dragging .data-table-row:hover {
  background-color: inherit;
}
</style>
