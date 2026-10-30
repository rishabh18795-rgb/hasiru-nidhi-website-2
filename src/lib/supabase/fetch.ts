/**
 * fetch with a deadline. Without it, a slow or unreachable Supabase makes every page that reads settings, the catalogue or the
 * session hang until the platform times the request out. With it, those calls fail fast and pages fall back to their
 * "temporarily unavailable" states. Not used for file uploads (those can legitimately take longer).
 */
export function fetchWithTimeout(ms = 5000): typeof fetch {
  return (input, init) => {
    const deadline = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    return fetch(input, { ...init, signal });
  };
}
