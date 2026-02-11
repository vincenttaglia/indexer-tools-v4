/**
 * Token conversion utilities for converting between wei (on-chain) and GRT (display) values.
 *
 * Token amounts from the Graph Protocol network subgraph are returned as string
 * representations of wei values (18 decimal places). These utilities handle the
 * conversion to human-readable GRT amounts.
 */

const WEI_PER_GRT = 1e18

/**
 * Converts a wei string to a GRT number.
 *
 * @param wei - Token amount as a string in wei (18 decimals)
 * @returns The equivalent amount in GRT as a number
 *
 * @example
 * weiToGrt('1000000000000000000') // => 1.0
 * weiToGrt('1500000000000000000000') // => 1500.0
 */
export function weiToGrt(wei: string): number {
  return Number(wei) / WEI_PER_GRT
}

/**
 * Converts a GRT number to a wei string.
 *
 * @param grt - Token amount in GRT
 * @returns The equivalent amount in wei as a string
 *
 * @example
 * grtToWei(1.0) // => '1000000000000000000'
 * grtToWei(1500) // => '1500000000000000000000'
 */
export function grtToWei(grt: number): string {
  return (grt * WEI_PER_GRT).toLocaleString('fullwide', { useGrouping: false })
}

/**
 * Formats a GRT value with commas and a fixed number of decimal places.
 *
 * @param grt - The GRT amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with commas and decimal places
 *
 * @example
 * formatGrt(1500.123456) // => '1,500.12'
 * formatGrt(1500.123456, 4) // => '1,500.1235'
 */
export function formatGrt(grt: number, decimals: number = 2): string {
  return grt.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Parses a wei string to a GRT number.
 * Alias for {@link weiToGrt} with a more descriptive name for use in data pipelines.
 *
 * @param value - Token amount as a string in wei (18 decimals)
 * @returns The equivalent amount in GRT as a number
 */
export function parseTokenAmount(value: string): number {
  return weiToGrt(value)
}
