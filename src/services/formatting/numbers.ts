/**
 * Number formatting utilities for display in the indexer dashboard.
 */

/**
 * Formats a number with locale-aware thousands separators and fixed decimal places.
 *
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with commas and decimal places
 *
 * @example
 * formatNumber(1500.123) // => '1,500.12'
 * formatNumber(1500.1, 4) // => '1,500.1000'
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Formats a number as a percentage string.
 *
 * @param value - The percentage value (e.g. 12.5 for 12.5%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercent(12.567) // => '12.57%'
 * formatPercent(0.5, 1) // => '0.5%'
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}

/**
 * Formats a duration in seconds as a human-readable string.
 *
 * Ported from v3 calculateReadableDuration:
 *   "{d}d {h}h {m}m"
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(90061) // => '1d 1h 1m'
 * formatDuration(3600) // => '0d 1h 0m'
 */
export function formatDuration(seconds: number): string {
  seconds = Math.floor(seconds)
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

/**
 * Abbreviates a large number with a suffix (K, M, B, T).
 *
 * @param value - The number to abbreviate
 * @returns Abbreviated string
 *
 * @example
 * abbreviateNumber(1500) // => '1.5K'
 * abbreviateNumber(2300000) // => '2.3M'
 * abbreviateNumber(1000000000) // => '1.0B'
 * abbreviateNumber(500) // => '500'
 */
export function abbreviateNumber(value: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1e12) {
    return `${sign}${(absValue / 1e12).toFixed(1)}T`
  }
  if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(1)}B`
  }
  if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(1)}M`
  }
  if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(1)}K`
  }
  if (absValue < 0.01) {
    return `${sign}0`
  }
  return `${sign}${absValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`
}
