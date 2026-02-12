import { ref } from 'vue'
import { defineStore } from 'pinia'

/** Per-dashboard column configuration */
export interface ColumnConfig {
  id: string
  visible: boolean
}

/**
 * Global application settings.
 *
 * Persisted to localStorage so configuration survives page refresh.
 */
export const useSettingsStore = defineStore('settings', () => {
  /** User's The Graph Gateway API key (used for subgraph queries). */
  const theGraphApiKey = ref('')

  /** User's DRPC API key (used for RPC calls to chain nodes). */
  const drpcApiKey = ref('')

  /** Whether dark mode is enabled. Defaults to true. */
  const darkMode = ref(true)

  /** Comma/newline-separated IPFS hashes of blacklisted subgraphs. */
  const subgraphBlacklist = ref('')

  /** Comma/newline-separated IPFS hashes of synclist subgraphs. */
  const subgraphSynclist = ref('')

  /** Per-dashboard column configuration (visibility and order) */
  const columnPreferences = ref<Record<string, ColumnConfig[]>>({})

  /** Get column config for a specific dashboard, returning defaults if not set */
  function getColumnConfig(dashboardId: string, defaultColumns: string[]): ColumnConfig[] {
    if (!columnPreferences.value[dashboardId]) {
      columnPreferences.value[dashboardId] = defaultColumns.map(id => ({
        id,
        visible: true,
      }))
    }
    return columnPreferences.value[dashboardId]
  }

  /** Update column visibility */
  function setColumnVisibility(
    dashboardId: string,
    columnId: string,
    visible: boolean,
  ) {
    const config = columnPreferences.value[dashboardId]
    if (!config) return
    const col = config.find(c => c.id === columnId)
    if (col) col.visible = visible
  }

  /** Reorder columns */
  function reorderColumns(
    dashboardId: string,
    fromIndex: number,
    toIndex: number,
  ) {
    const config = columnPreferences.value[dashboardId]
    if (!config) return
    const [moved] = config.splice(fromIndex, 1)
    if (moved) config.splice(toIndex, 0, moved)
  }

  /** Reset a dashboard's columns to defaults */
  function resetColumnConfig(dashboardId: string) {
    delete columnPreferences.value[dashboardId]
  }

  return {
    theGraphApiKey,
    drpcApiKey,
    darkMode,
    subgraphBlacklist,
    subgraphSynclist,
    columnPreferences,
    getColumnConfig,
    setColumnVisibility,
    reorderColumns,
    resetColumnConfig,
  }
}, {
  persist: true,
})
