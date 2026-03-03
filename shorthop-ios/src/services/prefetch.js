/**
 * In-memory prefetch cache for moments.
 *
 * When a calendar day is tapped, HomeScreen calls prefetchMoments() immediately.
 * By the time DayScreen mounts (~200ms navigation animation later), the fetch
 * is already in-flight or complete, so the screen renders data instantly.
 */

const _cache = new Map(); // date -> Promise<moment[]> | moment[]
const _highlightsCache = new Map(); // `${date}|${team}` -> Promise<data> | data

export function prefetchMoments(date, fetchFn) {
  if (_cache.has(date)) return; // already in-flight or done
  const promise = fetchFn()
    .then((data) => {
      _cache.set(date, data);
      return data;
    })
    .catch(() => {
      _cache.delete(date);
      return [];
    });
  _cache.set(date, promise);
}

export async function consumeMoments(date, fetchFn) {
  const cached = _cache.get(date);
  if (cached !== undefined) {
    return cached; // may be a Promise or a resolved array — both are awaitable
  }
  return fetchFn();
}

export function invalidateMoments(date) {
  _cache.delete(date);
}

// ─── Highlights prefetch ───────────────────────────────────────────────────────

export function prefetchHighlights(date, team, fetchFn) {
  const key = `${date}|${team || ""}`;
  if (_highlightsCache.has(key)) return;
  const promise = fetchFn()
    .then((data) => {
      _highlightsCache.set(key, data);
      return data;
    })
    .catch(() => {
      _highlightsCache.delete(key);
      return null;
    });
  _highlightsCache.set(key, promise);
}

export async function consumeHighlights(date, team, fetchFn) {
  const key = `${date}|${team || ""}`;
  const cached = _highlightsCache.get(key);
  if (cached !== undefined) return cached;
  return fetchFn();
}
