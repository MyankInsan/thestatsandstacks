/**
 * LRU tiebreaker — when multiple candidates pass variety rules, prefer the
 * least-recently-used so all rotation primitives get exercised within ~30 days.
 * Never-used candidates rank highest (treated as infinite age).
 */
export function lruRank<T extends string>(
  candidates: T[],
  recentUsage: T[],
  lookback = 50,
): T[] {
  if (candidates.length <= 1) return [...candidates];

  const window = recentUsage.slice(-lookback);
  const lastUsedIndex = new Map<T, number>();
  for (let i = 0; i < window.length; i++) {
    lastUsedIndex.set(window[i], i);
  }

  return [...candidates].sort((a, b) => {
    const aIdx = lastUsedIndex.has(a) ? lastUsedIndex.get(a)! : -Infinity;
    const bIdx = lastUsedIndex.has(b) ? lastUsedIndex.get(b)! : -Infinity;
    return aIdx - bIdx;
  });
}

export function lruPick<T extends string>(
  candidates: T[],
  recentUsage: T[],
  lookback = 50,
): T | undefined {
  const ranked = lruRank(candidates, recentUsage, lookback);
  return ranked[0];
}
