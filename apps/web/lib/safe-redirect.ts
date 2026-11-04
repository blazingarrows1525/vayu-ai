const PROBE_ORIGIN = "http://vayu.invalid";

/**
 * Resolve a user-supplied `?redirect=` to a same-origin path, or `fallback`.
 *
 * A prefix check ("starts with / but not //") is not enough: `/\evil.com` and a decoded
 * `/<TAB>/evil.com` both pass it, and the URL parser turns them into `//evil.com`. So the value is
 * parsed against a fixed origin and accepted only if it stays on that origin.
 */
export function safeRedirect(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
