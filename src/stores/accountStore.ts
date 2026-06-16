import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { IndexerAccount } from '@/types'
import { accountKey } from '@/types'
import { useChainStore } from './chainStore'

/**
 * Manages indexer accounts.
 *
 * Users can configure multiple indexer accounts (different addresses/chains).
 * One account is active at a time. Persisted to localStorage.
 */
export const useAccountStore = defineStore('accounts', () => {
  /** All configured indexer accounts. */
  const accounts = ref<IndexerAccount[]>([])

  /**
   * Composite key of the active account (address-chain), or null if no
   * account is selected.
   */
  const activeAccountKey = ref<string | null>(null)

  /** The currently active IndexerAccount, or null if none is selected. */
  const activeAccount = computed<IndexerAccount | null>(() => {
    if (activeAccountKey.value === null) return null
    return accounts.value.find(
      (a) => accountKey(a) === activeAccountKey.value,
    ) ?? null
  })

  /** Add a new indexer account. If it is the first account, auto-activate it. */
  function addAccount(account: IndexerAccount): void {
    const key = accountKey(account)
    const exists = accounts.value.some((a) => accountKey(a) === key)
    if (exists) return

    accounts.value.push(account)

    // Auto-activate the first account added
    if (accounts.value.length === 1) {
      setActive(key)
    }
  }

  /** Remove an account by its composite key. Clears activeAccountKey if it was active. */
  function removeAccount(key: string): void {
    accounts.value = accounts.value.filter((a) => accountKey(a) !== key)

    if (activeAccountKey.value === key) {
      const firstAccount = accounts.value[0]
      if (firstAccount != null) {
        setActive(accountKey(firstAccount))
      } else {
        activeAccountKey.value = null
      }
    }
  }

  /**
   * Set the active account by composite key. Also switches the selected chain
   * to match the account's chain, so the network follows the account.
   */
  function setActive(key: string): void {
    const account = accounts.value.find((a) => accountKey(a) === key)
    if (account != null) {
      activeAccountKey.value = key
      useChainStore().selectedChain = account.chain
    }
  }

  return {
    accounts,
    activeAccountKey,
    activeAccount,
    addAccount,
    removeAccount,
    setActive,
  }
}, {
  persist: true,
})
