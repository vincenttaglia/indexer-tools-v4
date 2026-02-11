/**
 * Proportion calculation for Graph Protocol subgraph signal-to-stake ratio.
 *
 * Ported from v3 subgraphs store — getProportions getter.
 *
 * The formula:
 *   proportion = (signalledTokens / totalTokensSignalled) / (stakedTokens / totalTokensAllocated)
 *
 * A proportion > 1 means the subgraph is under-allocated relative to its signal
 * (potentially more profitable). A proportion < 1 means it is over-allocated.
 *
 * All token amounts arrive as wei strings from the network subgraph.
 * Since both numerator and denominator are ratios of wei values, the units cancel
 * and the result is a dimensionless number.
 */

export interface ProportionParams {
  /** Signal on this subgraph deployment (wei string) */
  signalledTokens: string
  /** Total signal across the entire network (wei string) */
  totalTokensSignalled: string
  /** Total stake allocated to this subgraph deployment (wei string) */
  stakedTokens: string
  /** Total stake allocated across the entire network (wei string) */
  totalTokensAllocated: string
}

/**
 * Calculates the signal-to-stake proportion for a subgraph deployment.
 *
 * @returns A dimensionless ratio. Values > 1 indicate the subgraph is
 *          under-allocated relative to its signal share.
 */
export function calculateProportion(params: ProportionParams): number {
  const {
    signalledTokens,
    totalTokensSignalled,
    stakedTokens,
    totalTokensAllocated,
  } = params

  const staked = Number(stakedTokens)
  if (staked <= 0) {
    return 0
  }

  try {
    const signalRatio = Number(signalledTokens) / Number(totalTokensSignalled)
    const stakeRatio = staked / Number(totalTokensAllocated)

    if (stakeRatio === 0) {
      return 0
    }

    const proportion = signalRatio / stakeRatio

    return isFinite(proportion) ? proportion : 0
  } catch {
    return 0
  }
}
