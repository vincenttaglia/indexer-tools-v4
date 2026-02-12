import { computed } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useSettingsStore } from '@/stores'

/**
 * Extract the column ID from a TanStack column definition.
 * Checks the `id` property first, then falls back to `accessorKey`.
 */
function getColumnId<T>(col: ColumnDef<T, any>): string {
  if ('id' in col && col.id) return col.id
  if ('accessorKey' in col && col.accessorKey) return String(col.accessorKey)
  return ''
}

/**
 * Filters and reorders column definitions based on user preferences.
 * Returns columns in the user's preferred order with hidden columns removed.
 */
export function useColumnPreferences<T>(
  dashboardId: string,
  allColumns: ColumnDef<T, any>[],
) {
  const settingsStore = useSettingsStore()

  // Extract default column IDs from the column definitions
  const defaultColumnIds = allColumns.map(col => getColumnId(col)).filter(Boolean)

  const visibleColumns = computed(() => {
    const config = settingsStore.getColumnConfig(dashboardId, defaultColumnIds)
    const visibleIds = new Set(config.filter(c => c.visible).map(c => c.id))
    const orderedIds = config.map(c => c.id)

    // Filter to visible, then sort by config order
    return allColumns
      .filter(col => {
        const id = getColumnId(col)
        return visibleIds.has(id)
      })
      .sort((a, b) => {
        const aId = getColumnId(a)
        const bId = getColumnId(b)
        return orderedIds.indexOf(aId) - orderedIds.indexOf(bId)
      })
  })

  return { visibleColumns }
}
