/**
 * In-memory prefetch cache for moments.
 *
 * When a calendar day is tapped, HomeScreen calls prefetchMoments() immediately.
 * By the time DayScreen mounts (~200ms navigation animation later), the fetch
 * is already in-flight or complete, so the screen renders data instantly.
 */

const _cache = new Map(); // date -> Promise<moment[]> | moment[]

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
