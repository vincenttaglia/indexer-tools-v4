import type { ChainConfig, ChainId } from '@/types'

/**
 * Chain configuration definitions for all supported Graph Protocol networks.
 *
 * Subgraph URLs contain an `[api-key]` placeholder that is replaced at runtime
 * with the user's The Graph API key via `getChainConfig()`.
 */

const API_KEY_PLACEHOLDER = '[api-key]'

interface ChainConfigTemplate extends Omit<ChainConfig, 'networkSubgraphUrl' | 'eboSubgraphUrl' | 'rpcUrl'> {
  networkSubgraphUrlTemplate: string
  eboSubgraphUrlTemplate: string
  rpcUrlTemplate: string
}

const CHAIN_CONFIGS: Record<ChainId, ChainConfigTemplate> = {
  mainnet: {
    id: 'mainnet',
    label: 'Ethereum Mainnet',
    networkSubgraphUrlTemplate: `https://gateway.thegraph.com/api/${API_KEY_PLACEHOLDER}/subgraphs/id/9Co7EQe5PgW3ugCUJrJgRv4u9zdEuDJf8NvMWftNsBH8`,
    eboSubgraphUrlTemplate: `https://gateway.thegraph.com/api/${API_KEY_PLACEHOLDER}/subgraphs/id/Fg36gCZE7pXEuZ3p8sxYzFE5UbgHtk7kcJiC5HBbfgmY`,
    rpcUrlTemplate: `https://lb.drpc.org/ogrpc?network=ethereum&dkey=${API_KEY_PLACEHOLDER}`,
    rewardsContractAddress: '0x9Ac758AB77733b4150A901ebd659cbF8cB93ED66',
    blocksPerDay: 7200,
    blockExplorer: 'https://etherscan.io',
  },
  'arbitrum-one': {
    id: 'arbitrum-one',
    label: 'Arbitrum One',
    networkSubgraphUrlTemplate: `https://gateway.thegraph.com/api/${API_KEY_PLACEHOLDER}/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp`,
    eboSubgraphUrlTemplate: `https://gateway.thegraph.com/api/${API_KEY_PLACEHOLDER}/subgraphs/id/4KFYqUWRTZQ9gn7GPHC6YQ2q15chJfVrX43ezYcwkgxB`,
    rpcUrlTemplate: `https://lb.drpc.org/ogrpc?network=arbitrum&dkey=${API_KEY_PLACEHOLDER}`,
    rewardsContractAddress: '0x971B9d3d0Ae3ECa029CAB5eA1fB0F72c85e6a525',
    blocksPerDay: 5760,
    blockExplorer: 'https://arbiscan.io',
  },
  sepolia: {
    id: 'sepolia',
    label: 'Sepolia Testnet',
    networkSubgraphUrlTemplate: `https://gateway.thegraph.com/api/${API_KEY_PLACEHOLDER}/subgraphs/id/8pVKDwHniAz87CHEQsiz2wgFXGZXrbMDkrxgauVVfMJC`,
    eboSubgraphUrlTemplate: `https://gateway.thegraph.com/api/${API_KEY_PLACEHOLDER}/subgraphs/id/3nEnuQEQd1aP6wksKvRUnuwLQcQy1zD3HPFaHZ8cMVqM`,
    rpcUrlTemplate: `https://lb.drpc.org/ogrpc?network=sepolia&dkey=${API_KEY_PLACEHOLDER}`,
    rewardsContractAddress: '0x9a86322dEa5136C74ee6d1b06F4Ab9A6bB2724E0',
    blocksPerDay: 43200,
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  'arbitrum-sepolia': {
    id: 'arbitrum-sepolia',
    label: 'Arbitrum Sepolia',
    networkSubgraphUrlTemplate: `https://gateway.thegraph.com/api/${API_KEY_PLACEHOLDER}/subgraphs/id/3xQHhMudr1oh69ut36G2mbzpYmYxwqCeU6wwqyCDCnqV`,
    eboSubgraphUrlTemplate: `https://gateway.thegraph.com/api/${API_KEY_PLACEHOLDER}/subgraphs/id/BhnsdeZihU4SuokxZMLF4FQBVJ3jgtZf6v51gHvz3bSS`,
    rpcUrlTemplate: `https://lb.drpc.org/ogrpc?network=arbitrum-sepolia&dkey=${API_KEY_PLACEHOLDER}`,
    rewardsContractAddress: '0x00b9d319E3D09E83c62f453B44354049Dd93a345',
    blocksPerDay: 43200,
    blockExplorer: 'https://sepolia.arbiscan.io',
  },
}

/**
 * Returns the full ChainConfig for a given chain, with the API key placeholder
 * replaced by the user's actual API key.
 */
export function getChainConfig(chainId: ChainId, apiKey: string): ChainConfig {
  const template = CHAIN_CONFIGS[chainId]
  return {
    id: template.id,
    label: template.label,
    networkSubgraphUrl: template.networkSubgraphUrlTemplate.replace(API_KEY_PLACEHOLDER, apiKey),
    eboSubgraphUrl: template.eboSubgraphUrlTemplate.replace(API_KEY_PLACEHOLDER, apiKey),
    rpcUrl: template.rpcUrlTemplate.replace(API_KEY_PLACEHOLDER, apiKey),
    rewardsContractAddress: template.rewardsContractAddress,
    blocksPerDay: template.blocksPerDay,
    blockExplorer: template.blockExplorer,
  }
}

/** Ordered list of available chains for UI selectors. */
export const CHAIN_OPTIONS: Array<{ id: ChainId; label: string }> = [
  { id: 'arbitrum-one', label: 'Arbitrum One' },
  { id: 'mainnet', label: 'Ethereum Mainnet' },
  { id: 'sepolia', label: 'Sepolia Testnet' },
  { id: 'arbitrum-sepolia', label: 'Arbitrum Sepolia' },
]

/**
 * Returns the human-readable label for a chain id, falling back to the id
 * itself if the chain is not in CHAIN_OPTIONS.
 */
export function getChainLabel(chainId: ChainId): string {
  const option = CHAIN_OPTIONS.find((o) => o.id === chainId)
  return option?.label ?? chainId
}

/** Compact 3-7 character codes used in pill badges (e.g. sidebar account switcher). */
export const CHAIN_ABBREV: Record<ChainId, string> = {
  mainnet: 'ETH',
  'arbitrum-one': 'ARB',
  sepolia: 'SEP',
  'arbitrum-sepolia': 'ARB-SEP',
}
