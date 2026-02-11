import { ref } from 'vue'
import { defineStore } from 'pinia'

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

  return {
    theGraphApiKey,
    drpcApiKey,
    darkMode,
  }
}, {
  persist: true,
})
