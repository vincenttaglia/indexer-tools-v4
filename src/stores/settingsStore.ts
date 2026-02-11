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

  /** Comma/newline-separated IPFS hashes of blacklisted subgraphs. */
  const subgraphBlacklist = ref('')

  /** Comma/newline-separated IPFS hashes of synclist subgraphs. */
  const subgraphSynclist = ref('')

  return {
    theGraphApiKey,
    drpcApiKey,
    darkMode,
    subgraphBlacklist,
    subgraphSynclist,
  }
}, {
  persist: true,
})
