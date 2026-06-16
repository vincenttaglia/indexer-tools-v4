import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChainStore, useSettingsStore, useAccountStore } from '@/stores'
import { createGraphQLClient, fetchIndexerUrls, fetchAllDeploymentStatuses } from '@/api'
import { getChainConfig } from '@/config/chains'
import type { OtherIndexerDetail, DeploymentStatus } from '@/types'

/**
 * Per-deployment aggregation of other indexers' health.
 */
export interface OtherIndexersHealth {
  healthyCount: number
  failedCount: number
  /** Highest entity count reported by any other indexer for this deployment, or null if none reported one */
  maxEntityCount: number | null
  details: OtherIndexerDetail[]
}

/**
 * Composable that discovers other indexers and fetches their deployment statuses.
 *
 * This is an expensive operation (queries the Network Subgraph for all indexer URLs,
 * then fetches /status from each one) so it is manually triggered, not auto-fetched.
 *
 * @returns { data, loading, fetch } - data is a Map<ipfsHash, OtherIndexersHealth>
 */
export function useOtherIndexersQuery() {
  const chainStore = useChainStore()
  const settingsStore = useSettingsStore()
  const accountStore = useAccountStore()
  const { selectedChain } = storeToRefs(chainStore)
  const { theGraphApiKey } = storeToRefs(settingsStore)
  const { activeAccount } = storeToRefs(accountStore)

  const data = ref<Map<string, OtherIndexersHealth>>()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const fetchedCount = ref(0)
  const totalCount = ref(0)

  async function fetchOtherIndexers() {
    if (!theGraphApiKey.value || !activeAccount.value) return

    loading.value = true
    error.value = null
    fetchedCount.value = 0

    try {
      const config = getChainConfig(selectedChain.value, theGraphApiKey.value)
      const client = createGraphQLClient(config.networkSubgraphUrl)

      // Step 1: Get all indexer URLs
      const allIndexers = await fetchIndexerUrls(client)

      // Filter out the user's own indexer and indexers with no URL
      const ownAddress = activeAccount.value.address.toLowerCase()
      const otherIndexers = allIndexers.filter(
        (ix) => ix.url && ix.id.toLowerCase() !== ownAddress,
      )

      totalCount.value = otherIndexers.length

      // Step 2: Fetch statuses from each indexer (with concurrency limit)
      const aggregation = new Map<string, OtherIndexersHealth>()
      const CONCURRENCY = 10
      const batches: typeof otherIndexers[] = []

      for (let i = 0; i < otherIndexers.length; i += CONCURRENCY) {
        batches.push(otherIndexers.slice(i, i + CONCURRENCY))
      }

      for (const batch of batches) {
        const promises = batch.map(async (indexer) => {
          try {
            const statuses = await fetchAllDeploymentStatuses(indexer.url)
            return { url: indexer.url, statuses }
          } catch {
            return { url: indexer.url, statuses: new Map() as Map<string, DeploymentStatus> }
          }
        })

        const results = await Promise.all(promises)
        fetchedCount.value += batch.length

        // Aggregate results
        for (const { url, statuses } of results) {
          for (const [ipfsHash, status] of statuses) {
            const existing = aggregation.get(ipfsHash) ?? { healthyCount: 0, failedCount: 0, maxEntityCount: null, details: [] }
            if (status.health === 'healthy') {
              existing.healthyCount++
            } else if (status.health === 'failed') {
              existing.failedCount++
            }
            const parsedEntityCount = status.entityCount != null ? parseInt(status.entityCount, 10) : NaN
            const entityCount = Number.isFinite(parsedEntityCount) ? parsedEntityCount : null
            if (entityCount !== null) {
              existing.maxEntityCount =
                existing.maxEntityCount === null
                  ? entityCount
                  : Math.max(existing.maxEntityCount, entityCount)
            }
            existing.details.push({
              url,
              health: status.health,
              latestBlock: status.chains?.[0]?.latestBlock?.number ?? null,
              entityCount,
              fatalError: status.fatalError ? {
                message: status.fatalError.message,
                deterministic: status.fatalError.deterministic,
                blockNumber: status.fatalError.block?.number ?? null,
              } : null,
            })
            aggregation.set(ipfsHash, existing)
          }
        }
      }

      data.value = aggregation
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  const enabled = computed(() => !!theGraphApiKey.value && !!activeAccount.value)

  return {
    data,
    loading,
    error,
    fetchedCount,
    totalCount,
    enabled,
    fetch: fetchOtherIndexers,
  }
}
