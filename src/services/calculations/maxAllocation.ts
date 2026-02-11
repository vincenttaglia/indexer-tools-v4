/**
 * Maximum efficient allocation calculation for Graph Protocol subgraphs.
 *
 * Ported from v3 commonCalcs.js — maxAllo.
 *
 * The formula:
 *   maxAllocation = signalledTokens / totalTokensSignalled * issuancePerYear / targetApr - stakedTokens
 *
 * The result is divided by 1e18 to convert from wei to GRT (matching v3 behaviour).
 * All token inputs arrive as wei strings from the network subgraph.
 */

const WEI_PER_GRT = 1e18

export interface MaxAllocationParams {
  /** Target APR as a percentage (e.g. 10 for 10%) */
  targetApr: number
  /** Signal on this subgraph deployment (wei string) */
  signalledTokens: string
  /** Total stake allocated to this subgraph deployment (wei string) */
  stakedTokens: string
  /** Total signal across the entire network (wei string) */
  totalTokensSignalled: string
  /** GRT issuance rate per block from the network (wei string) */
  networkGRTIssuancePerBlock: string
  /** Number of blocks produced per day on this chain */
  blocksPerDay: number
}

/**
 * Calculates the maximum allocation size that would still achieve the target APR.
 *
 * Faithfully ported from v3:
 *   signalledTokens / totalTokensSignalled * issuancePerYear / (targetApr / 100) - stakedTokens
 *   then divided by 1e18 to return GRT.
 *
 * @returns Maximum allocation in GRT. May be negative if the subgraph is already
 *          over-allocated relative to the target APR.
 */
export function calculateMaxAllocation(params: MaxAllocationParams): number {
  const {
    targetApr,
    signalledTokens,
    stakedTokens,
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
  } = params

  if (targetApr <= 0) {
    return 0
  }

  try {
    const targetAprDecimal = targetApr / 100
    const issuancePerYear = Number(networkGRTIssuancePerBlock) * blocksPerDay * 365

    const maxAllo =
      (Number(signalledTokens) / Number(totalTokensSignalled)) *
      issuancePerYear /
      targetAprDecimal -
      Number(stakedTokens)

    const result = maxAllo / WEI_PER_GRT

    return isFinite(result) ? result : 0
  } catch {
    return 0
  }
}
