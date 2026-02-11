/**
 * Ethereum address formatting and validation utilities.
 */

/**
 * Shortens an Ethereum address for display.
 *
 * @param address - Full Ethereum address (0x...)
 * @param chars - Number of characters to show on each side (default: 4)
 * @returns Shortened address string
 *
 * @example
 * shortenAddress('0x1234567890abcdef1234567890abcdef12345678') // => '0x1234...5678'
 * shortenAddress('0x1234567890abcdef1234567890abcdef12345678', 6) // => '0x123456...345678'
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) {
    return ''
  }
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Validates whether a string is a valid Ethereum address.
 *
 * Checks the basic format: starts with "0x" followed by exactly 40 hexadecimal characters.
 * Does not perform EIP-55 checksum validation.
 *
 * @param address - The string to validate
 * @returns true if the string is a valid Ethereum address format
 *
 * @example
 * isValidAddress('0x1234567890abcdef1234567890abcdef12345678') // => true
 * isValidAddress('0xinvalid') // => false
 * isValidAddress('not an address') // => false
 */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}
