/**
 * EBO-based sync check.
 *
 * Returns whether a deployment's latest indexed block is at or past the
 * current epoch's start block for its chain — the criterion that gates
 * "closable" in the wizard's Step 1.
 *
 * Returns null (treated as "not synced" by callers) when either input is
 * missing or non-positive. Non-positive guards against fail-open from
 * garbage data: graph-node and the EBO subgraph return block numbers as
 * BigInt JSON strings, and the boundary normalizers fall back to 0 for
 * unparseable values — without this guard, `0 >= 0` would evaluate true
 * and mark a subgraph with no data as synced.
 */
export function isSyncedToEpoch(
  latestBlock: number | null | undefined,
  epochBlockNumber: number | null | undefined,
): boolean | null {
  if (latestBlock == null || epochBlockNumber == null) return null
  if (latestBlock <= 0 || epochBlockNumber <= 0) return null
  return latestBlock >= epochBlockNumber
}
