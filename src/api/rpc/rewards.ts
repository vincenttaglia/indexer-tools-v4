import type { PublicClient, Address } from 'viem'

// ---------------------------------------------------------------------------
// Rewards contract ABI (only the functions we need)
// ---------------------------------------------------------------------------

/**
 * Minimal ABI for the Graph Protocol Rewards contract.
 * Contains only the view functions used by the indexer tools.
 */
export const REWARDS_ABI = [
  {
    inputs: [],
    name: 'getAccRewardsPerSignal',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getNewRewardsPerSignal',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_rewardsIssuer', type: 'address' },
      { internalType: 'address', name: '_allocationID', type: 'address' },
    ],
    name: 'getRewards',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'issuancePerBlock',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ---------------------------------------------------------------------------
// Pending rewards (per allocation)
// ---------------------------------------------------------------------------

/**
 * Known rewards issuers used by The Graph Protocol.
 * Legacy allocations use the legacy issuer; newer allocations use the standard one.
 */
export const REWARDS_ISSUERS = {
  legacy: '0x00669A4CF01450B64E8A2A20E9b1FCB71E61eF03' as Address,
  standard: '0xb2Bb92d0DE618878E438b55D5846cfecD9301105' as Address,
} as const

/**
 * Fetches pending (uncollected) rewards for a specific allocation.
 *
 * @param client - A viem PublicClient connected to the appropriate chain
 * @param contractAddress - The rewards contract address for the active chain
 * @param allocationId - The allocation address (0x...)
 * @param isLegacy - Whether this allocation uses the legacy rewards issuer
 * @returns The pending reward amount in wei as a bigint
 */
export async function getPendingRewards(
  client: PublicClient,
  contractAddress: Address,
  allocationId: Address,
  isLegacy: boolean = false,
): Promise<bigint> {
  const issuer = isLegacy ? REWARDS_ISSUERS.legacy : REWARDS_ISSUERS.standard

  const result = await client.readContract({
    address: contractAddress,
    abi: REWARDS_ABI,
    functionName: 'getRewards',
    args: [issuer, allocationId],
  })

  return result
}

/**
 * Fetches pending rewards for multiple allocations in parallel.
 * Failed individual reads return 0n to avoid blocking the entire batch.
 *
 * @param client - A viem PublicClient connected to the appropriate chain
 * @param contractAddress - The rewards contract address for the active chain
 * @param allocations - Array of { id, isLegacy } allocation descriptors
 * @returns Map of allocation ID to pending reward amount (bigint)
 */
export async function getBatchPendingRewards(
  client: PublicClient,
  contractAddress: Address,
  allocations: Array<{ id: Address; isLegacy: boolean }>,
): Promise<Map<string, bigint>> {
  const results = new Map<string, bigint>()

  // Process in batches of 50 to avoid overwhelming the RPC endpoint
  const batchSize = 50

  for (let i = 0; i < allocations.length; i += batchSize) {
    const batch = allocations.slice(i, i + batchSize)

    const promises = batch.map(async (allocation) => {
      try {
        const reward = await getPendingRewards(
          client,
          contractAddress,
          allocation.id,
          allocation.isLegacy,
        )
        results.set(allocation.id, reward)
      } catch {
        // If an individual call fails, record 0 rather than failing the batch
        results.set(allocation.id, 0n)
      }
    })

    await Promise.all(promises)

    // Throttle between batches to avoid rate limiting (matching v3's 1.5s delay)
    if (i + batchSize < allocations.length) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }

  return results
}
