import type { ChainId } from './network'

export interface IndexerAccount {
  /** Indexer address (0x...) */
  address: string
  /** Chain this account operates on */
  chain: ChainId
  /** Display name for the account */
  label: string
  /** Indexer Agent Admin API endpoint (optional) */
  agentEndpoint: string
  /** Graphman API endpoint (optional) */
  graphmanEndpoint: string
  /** Graphman Bearer token (optional) */
  graphmanToken: string
}

/** Data fetched from Network Subgraph about an indexer */
export interface IndexerOnChainData {
  indexingRewardCut: number
  availableStake: string
  url: string | null
}

/** Composite key for an indexer account */
export function accountKey(account: IndexerAccount): string {
  return `${account.address.toLowerCase()}-${account.chain}`
}
