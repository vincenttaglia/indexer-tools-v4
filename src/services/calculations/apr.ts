/**
 * APR (Annual Percentage Rate) calculations for Graph Protocol subgraph allocations.
 *
 * Ported from v3 commonCalcs.js — calculateApr and calculateNewApr.
 *
 * The core formula:
 *   APR = (signalledTokens / totalTokensSignalled) * issuancePerYear / (stakedTokens + newAllocation) * 100
 *
 * All token amounts (signalledTokens, stakedTokens, totalTokensSignalled,
 * networkGRTIssuancePerBlock) arrive as wei strings from the network subgraph.
 * The result is a percentage number (e.g. 12.5 means 12.5%).
 */

const WEI_PER_GRT = 1e18

export interface AprParams {
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
  /** New allocation amount in GRT (as a string, NOT wei) — "0" for current APR */
  newAllocation?: string
}

/**
 * Calculates the current APR for a subgraph deployment.
 * This is equivalent to calculateNewApr with newAllocation = "0".
 *
 * @returns APR as a percentage number (e.g. 12.5 for 12.5%)
 */
export function calculateApr(params: AprParams): number {
  return calculateNewApr({ ...params, newAllocation: '0' })
}

/**
 * Calculates the projected APR for a subgraph deployment when adding a new allocation.
 *
 * Faithfully ported from v3:
 *   signalledTokens / totalTokensSignalled * issuancePerYear / (stakedTokens + toWei(newAllocation)) * 100
 *
 * @returns APR as a percentage number (e.g. 12.5 for 12.5%)
 */
export function calculateNewApr(params: AprParams): number {
  const {
    signalledTokens,
    stakedTokens,
    totalTokensSignalled,
    networkGRTIssuancePerBlock,
    blocksPerDay,
    newAllocation = '0',
  } = params

  const newAllocationWei = Number(newAllocation) * WEI_PER_GRT
  const totalStaked = Number(stakedTokens) + newAllocationWei

  if (totalStaked <= 0) {
    return 0
  }

  try {
    const issuancePerYear = Number(networkGRTIssuancePerBlock) * blocksPerDay * 365

    const apr =
      (Number(signalledTokens) / Number(totalTokensSignalled)) *
      issuancePerYear /
      totalStaked *
      100

    return isFinite(apr) ? apr : 0
  } catch {
    return 0
  }
}
