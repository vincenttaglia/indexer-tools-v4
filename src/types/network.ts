export type ChainId = 'mainnet' | 'arbitrum-one' | 'sepolia' | 'arbitrum-sepolia'

export interface NetworkMetrics {
  totalTokensSignalled: string
  networkGRTIssuancePerBlock: string
  totalSupply: string
  currentEpoch: number
  totalTokensAllocated: string
  maxThawingPeriod: number
}

export interface ChainConfig {
  id: ChainId
  label: string
  networkSubgraphUrl: string
  eboSubgraphUrl: string
  rpcUrl: string
  rewardsContractAddress: string
  blocksPerDay: number
  blockExplorer: string
}

export interface EpochBlockNumber {
  blockNumber: number
  id: string
  network: {
    alias: string
    id: string
  }
}

export interface Epoch {
  epochNumber: number
  id: string
  blockNumbers: EpochBlockNumber[]
}
