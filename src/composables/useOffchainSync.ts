import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
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
  const { activeAccount } = storeToRefs(accountStore)

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
    },
  })

  function addOffchainSync(ipfsHash: string) {
    if (!hasAgent.value) return
    addMutation.mutate(ipfsHash)
  }

  function removeOffchainSync(ipfsHash: string) {
    if (!hasAgent.value) return
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
