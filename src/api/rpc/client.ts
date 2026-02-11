import { createPublicClient, http, type PublicClient, type Chain } from 'viem'
import { mainnet, arbitrum, sepolia, arbitrumSepolia } from 'viem/chains'
import type { ChainId } from '@/types'

/**
 * Maps our application ChainId to the corresponding viem chain definition.
 */
const CHAIN_MAP: Record<ChainId, Chain> = {
  'mainnet': mainnet,
  'arbitrum-one': arbitrum,
  'sepolia': sepolia,
  'arbitrum-sepolia': arbitrumSepolia,
}

/**
 * Creates a viem PublicClient for the given chain and RPC URL.
 *
 * @param chainId - The application chain identifier
 * @param rpcUrl - The JSON-RPC endpoint URL
 * @returns A viem PublicClient configured for the specified chain
 */
export function createRpcClient(chainId: ChainId, rpcUrl: string): PublicClient {
  const chain = CHAIN_MAP[chainId]
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  })
}
