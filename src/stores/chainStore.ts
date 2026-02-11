import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ChainId } from '@/types'
import { getChainConfig } from '@/config/chains'
import { useSettingsStore } from './settingsStore'

/**
 * Tracks the currently selected chain.
 *
 * Persisted to localStorage so the user's chain selection survives page refresh.
 */
export const useChainStore = defineStore('chain', () => {
  /** The currently selected chain. Defaults to Arbitrum One. */
  const selectedChain = ref<ChainId>('arbitrum-one')

  /**
   * Full chain configuration for the selected chain, with the user's
   * API key interpolated into subgraph and RPC URLs.
   */
  const chainConfig = computed(() => {
    const settings = useSettingsStore()
    return getChainConfig(selectedChain.value, settings.theGraphApiKey)
  })

  return {
    selectedChain,
    chainConfig,
  }
}, {
  persist: true,
})
