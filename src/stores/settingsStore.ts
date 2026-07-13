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
  /**
   * User's The Graph Gateway API key (used for subgraph queries).
   *
   * Defaults to `VITE_THEGRAPH_API_KEY` from `.env` when present, so a fresh
   * browser session can boot with credentials already configured. The
   * persistence plugin rehydrates from localStorage after this default, so
   * any user-supplied value wins over the env default on subsequent loads.
   */
  const theGraphApiKey = ref(import.meta.env.VITE_THEGRAPH_API_KEY ?? '')

  /** User's DRPC API key (used for RPC calls to chain nodes). Same env-fallback semantics as theGraphApiKey. */
  const drpcApiKey = ref(import.meta.env.VITE_DRPC_API_KEY ?? '')

  /** Whether dark mode is enabled. Defaults to true. */
  const darkMode = ref(true)

  /** Comma/newline-separated IPFS hashes of blacklisted subgraphs. */
  const subgraphBlacklist = ref('')

  /** Comma/newline-separated IPFS hashes of synclist subgraphs. */
  const subgraphSynclist = ref('')

  // ---------------------------------------------------------------------------
  // Allocation optimizer settings
  // ---------------------------------------------------------------------------

  /** Per-deployment cap as a fraction of the budget, in [0, 1]. 0 disables the pct cap. */
  const maxAllocationPct = ref(0.10)

  /** Per-deployment cap in absolute GRT. 0 disables the raw cap. */
  const maxAllocationGrt = ref(0)

  /** Tighter pct cap for deployments listed in `optimizerRiskyDeployments`. */
  const riskyAllocationPct = ref(0.02)

  /** Tighter raw GRT cap for deployments listed in `optimizerRiskyDeployments`. */
  const riskyAllocationGrt = ref(0)

  /** Comma/newline-separated IPFS hashes of deployments subject to the risky caps. */
  const optimizerRiskyDeployments = ref('')

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
    maxAllocationPct,
    maxAllocationGrt,
    riskyAllocationPct,
    riskyAllocationGrt,
    optimizerRiskyDeployments,
    columnPreferences,
    getColumnConfig,
    setColumnVisibility,
    reorderColumns,
    resetColumnConfig,
  }
}, {
  persist: true,
})
