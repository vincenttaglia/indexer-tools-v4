import type { AllocationRaw } from '@/types'
import { weiToGrt } from '@/services/calculations'

const ZERO_POI = '0x0000000000000000000000000000000000000000000000000000000000000000'

interface ClosingAllocation {
  allocationId: string
  ipfsHash: string
  allocatedTokens: string
  isLegacy: boolean
}

interface NewAllocation {
  ipfsHash: string
  amountGrt: number
}

interface PoiData {
  poi: string
  blockHeight: number
  publicPOI: string
}

interface CommandParams {
  closingAllocations: ClosingAllocation[]
  newAllocations: NewAllocation[]
  customPOIs: Map<string, string>
  customBlockHeights: Map<string, number>
  customPublicPOIs: Map<string, string>
  chainId: string
}

/**
 * Build POI CLI argument string for a deployment.
 * Returns empty string if no POI is set; handles "0x0" special case.
 */
function buildPoiArg(
  ipfsHash: string,
  customPOIs: Map<string, string>,
  customBlockHeights: Map<string, number>,
  customPublicPOIs: Map<string, string>,
): string {
  const poi = customPOIs.get(ipfsHash)
  if (!poi) return ''

  if (poi === '0x0') {
    return `${ZERO_POI} true 0 ${ZERO_POI} `
  }

  const blockHeight = customBlockHeights.get(ipfsHash) ?? 0
  const publicPOI = customPublicPOIs.get(ipfsHash) ?? ZERO_POI
  return `${poi} true ${blockHeight} ${publicPOI} `
}

/**
 * Generate `graph indexer rules` CLI commands.
 *
 * Closing allocations get a `rules delete` command.
 * New allocations get a `rules set` command with allocationAmount + decisionBasis.
 */
export function generateIndexingRuleCommands(params: CommandParams): string {
  const { closingAllocations, newAllocations, chainId } = params
  let commands = ''

  for (const alloc of closingAllocations) {
    commands += `graph indexer rules delete ${alloc.ipfsHash} --network ${chainId}\n`
  }

  for (const alloc of newAllocations) {
    if (alloc.amountGrt > 0) {
      commands += `graph indexer rules set ${alloc.ipfsHash} allocationAmount ${alloc.amountGrt} decisionBasis always --network ${chainId}\n`
    }
  }

  return commands
}

/**
 * Generate `graph indexer actions queue` CLI commands.
 *
 * Order matches v3 priority:
 *   1. unallocate (closing without re-opening)
 *   2. reallocate decrease (closing + re-opening at lower amount)
 *   3. allocate (new, not replacing)
 *   4. reallocate increase (closing + re-opening at higher amount)
 */
export function generateActionQueueCommands(params: CommandParams): string {
  const {
    closingAllocations,
    newAllocations,
    customPOIs,
    customBlockHeights,
    customPublicPOIs,
    chainId,
  } = params

  let unallocate = ''
  let reallocateDecrease = ''
  let allocate = ''
  let reallocateIncrease = ''
  const skip = new Set<string>()

  // Build a lookup of new allocation amounts by IPFS hash
  const newAllocMap = new Map<string, number>()
  for (const alloc of newAllocations) {
    newAllocMap.set(alloc.ipfsHash, alloc.amountGrt)
  }

  for (const alloc of closingAllocations) {
    const poiArg = buildPoiArg(alloc.ipfsHash, customPOIs, customBlockHeights, customPublicPOIs)
    const newAmount = newAllocMap.get(alloc.ipfsHash)

    if (newAmount !== undefined && newAmount > 0) {
      // Reallocate
      const currentGrt = weiToGrt(alloc.allocatedTokens)
      const cmd = `graph indexer actions queue reallocate ${alloc.ipfsHash} ${alloc.allocationId} ${newAmount} ${poiArg}--network ${chainId}\n`

      if (currentGrt > newAmount) {
        reallocateDecrease += cmd
      } else {
        reallocateIncrease += cmd
      }
      skip.add(alloc.ipfsHash)
    } else {
      // Unallocate
      unallocate += `graph indexer actions queue unallocate ${alloc.ipfsHash} ${alloc.allocationId} ${poiArg}--network ${chainId}\n`
    }
  }

  for (const alloc of newAllocations) {
    if (alloc.amountGrt > 0 && !skip.has(alloc.ipfsHash)) {
      allocate += `graph indexer actions queue allocate ${alloc.ipfsHash} ${alloc.amountGrt} --network ${chainId}\n`
    }
  }

  return `${unallocate}${reallocateDecrease}${allocate}${reallocateIncrease}`
}

/**
 * Helper to extract ClosingAllocation[] from a Map of AllocationRaw.
 */
export function toClosingAllocations(
  allocMap: Map<string, AllocationRaw>,
): ClosingAllocation[] {
  return [...allocMap.values()].map((alloc) => ({
    allocationId: alloc.id,
    ipfsHash: alloc.subgraphDeployment.ipfsHash,
    allocatedTokens: alloc.allocatedTokens,
    isLegacy: alloc.isLegacy,
  }))
}

/**
 * Helper to extract NewAllocation[] from wizard state.
 */
export function toNewAllocations(
  selectedDeployments: Set<string>,
  allocationAmounts: Map<string, string>,
): NewAllocation[] {
  const result: NewAllocation[] = []
  for (const ipfsHash of selectedDeployments) {
    const amount = parseFloat(allocationAmounts.get(ipfsHash) ?? '0')
    result.push({ ipfsHash, amountGrt: amount })
  }
  return result
}
