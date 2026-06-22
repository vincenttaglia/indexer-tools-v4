import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useToast } from 'primevue/usetoast'
import { storeToRefs } from 'pinia'
import { useAccountStore, useChainStore } from '@/stores'
import {
  createGraphQLClient,
  fetchIndexingRules,
  setIndexingRule,
  deleteIndexingRule,
} from '@/api'

/**
 * Shared offchain-sync state and actions for use across dashboards.
 *
 * Exposes the set of deployment IPFS hashes that currently have an `offchain`
 * indexing rule, plus add/remove handlers that toggle the rule via the indexer
 * agent. Mutations invalidate the `indexing-rules` query so every consumer
 * (including the Offchain Sync Manager) stays in sync.
 *
 * Requires the active account to have an `agentEndpoint` configured; when it is
 * absent the query is disabled and the synced set is empty.
 */
export function useOffchainSync() {
  const accountStore = useAccountStore()
  const chainStore = useChainStore()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { activeAccount } = storeToRefs(accountStore)

  function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : 'Unknown error'
  }

  const agentEndpoint = computed(() => activeAccount.value?.agentEndpoint ?? '')
  const hasAgent = computed(() => !!agentEndpoint.value)

  const indexingRulesQuery = useQuery({
    queryKey: computed(() => [
      'indexing-rules',
      agentEndpoint.value,
      chainStore.selectedChain,
    ] as const),
    queryFn: async () => {
      if (!agentEndpoint.value) throw new Error('No agent endpoint configured')
      const client = createGraphQLClient(agentEndpoint.value)
      const rules = await fetchIndexingRules(client, chainStore.selectedChain)
      return rules.filter((r) => r.decisionBasis === 'offchain')
    },
    enabled: hasAgent,
  })

  /** Set of deployment IPFS hashes that currently have an offchain rule. */
  const offchainSyncedHashes = computed(() => {
    const rules = indexingRulesQuery.data.value ?? []
    return new Set(
      rules
        .filter((r) => r.identifierType === 'deployment')
        .map((r) => r.identifier),
    )
  })

  function isOffchainSynced(ipfsHash: string) {
    return offchainSyncedHashes.value.has(ipfsHash)
  }

  const addMutation = useMutation({
    mutationFn: async (ipfsHash: string) => {
      const client = createGraphQLClient(agentEndpoint.value)
      return setIndexingRule(client, {
        identifier: ipfsHash,
        identifierType: 'deployment',
        decisionBasis: 'offchain',
        protocolNetwork: chainStore.selectedChain,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indexing-rules'] })
      toast.add({
        severity: 'success',
        summary: 'Offchain sync added',
        detail: 'The deployment will now be synced offchain.',
        life: 4000,
      })
    },
    onError: (err) => {
      toast.add({
        severity: 'error',
        summary: 'Failed to add offchain sync',
        detail: errorMessage(err),
        life: 6000,
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (ipfsHash: string) => {
      const client = createGraphQLClient(agentEndpoint.value)
      return deleteIndexingRule(client, {
        identifier: ipfsHash,
        protocolNetwork: chainStore.selectedChain,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indexing-rules'] })
      toast.add({
        severity: 'success',
        summary: 'Offchain sync removed',
        detail: 'The deployment will no longer be synced offchain.',
        life: 4000,
      })
    },
    onError: (err) => {
      toast.add({
        severity: 'error',
        summary: 'Failed to remove offchain sync',
        detail: errorMessage(err),
        life: 6000,
      })
    },
  })

  function noAgentToast() {
    toast.add({
      severity: 'warn',
      summary: 'No agent endpoint',
      detail: 'Configure your indexer agent endpoint in Settings first.',
      life: 5000,
    })
  }

  function addOffchainSync(ipfsHash: string) {
    if (!hasAgent.value) return noAgentToast()
    // Avoid enqueueing a duplicate request on rapid double-clicks.
    if (addMutation.isPending.value) return
    addMutation.mutate(ipfsHash)
  }

  function removeOffchainSync(ipfsHash: string) {
    if (!hasAgent.value) return noAgentToast()
    if (removeMutation.isPending.value) return
    removeMutation.mutate(ipfsHash)
  }

  const isMutating = computed(
    () => addMutation.isPending.value || removeMutation.isPending.value,
  )

  return {
    hasAgent,
    offchainSyncedHashes,
    isOffchainSynced,
    addOffchainSync,
    removeOffchainSync,
    addMutation,
    removeMutation,
    isMutating,
  }
}
