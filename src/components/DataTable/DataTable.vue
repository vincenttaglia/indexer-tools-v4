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
function handleRowClick(row: T) {
  emit('row-click', row)
}

</script>

<template>
  <div
    ref="tableContainerRef"
    class="data-table-container"
    :style="{ height: tableHeight }"
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
  overflow: hidden;
}

.data-table-header-row {
  display: flex;
  width: 100%;
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
  border-bottom: 1px solid var(--app-surface-200);
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  width: 100%;
  display: flex;
  align-items: center;
  transition: background-color 150ms ease-out;
  cursor: pointer;
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
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  flex-shrink: 0;
  flex-grow: 0;
  min-width: 0;
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
  width: 100%;
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
  width: 100%;
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
</style>
