/**
 * ─── App Lifecycle, Sync & Zombie-Connection Recovery Layer ─────────────────
 * Solves tab-switching freeze & zombie sockets on mobile/APK while preserving
 * existing offline submission capabilities and queueing architecture.
 *
 * Capabilities:
 * 1. Zombie Connection Prevention: Non-invasive fetch wrapper with AbortController
 *    timeouts so hung suspended sockets fail cleanly into the existing offline queue.
 * 2. Targeted Cache-Control: Applies cache-busting headers strictly to auth/token
 *    endpoints, leaving submission routes and Service Worker offline caching untouched.
 * 3. App Resume Revalidation: On `visibilitychange`, `pageshow` (BFCache), and `focus`,
 *    silently re-verifies session, tests storage health, resets stuck spinners, and
 *    triggers existing offline queue sync via `manual-sync-trigger`.
 */

let isInitialized = false;
let originalFetch = null;
let lastResumeTime = 0;
const RESUME_THROTTLE_MS = 1500; // prevent stampeding when visibilitychange + focus fire together

/**
 * Checks if a URL points to an authentication or session endpoint.
 * Cache-busting is strictly targeted to these routes.
 */
export function isAuthEndpoint(url) {
  if (!url) return false;
  const urlStr = typeof url === 'string' ? url : url.url || url.toString();
  return (
    urlStr.includes('/auth/v1/') ||
    urlStr.includes('/api/anonymous/verify-otp') ||
    urlStr.includes('/api/anonymous/send-otp') ||
    urlStr.includes('/reset-password') ||
    urlStr.includes('/login')
  );
}

/**
 * Checks if a URL and method require cache-busting to prevent stale data.
 * Applies strictly to:
 * 1. Auth/session verification routes
 * 2. Dynamic Supabase REST database queries (`GET /rest/v1/*`)
 * 3. Dynamic backend API queries (`GET /api/*`)
 * Does NOT apply to static assets, photo URLs, or offline submission POST/RPC endpoints.
 */
export function shouldBustCache(url, method = 'GET') {
  if (!url) return false;
  const urlStr = typeof url === 'string' ? url : url.url || url.toString();
  const m = String(method || 'GET').toUpperCase();

  // Auth/session endpoints always bust cache
  if (isAuthEndpoint(urlStr)) return true;

  // Supabase dynamic REST queries must never be served from stale browser cache
  if (m === 'GET' && urlStr.includes('/rest/v1/')) return true;

  // Dynamic backend API queries must never be served from stale browser cache
  if (m === 'GET' && urlStr.includes('/api/')) return true;

  return false;
}

/**
 * Checks if a URL is an evidence photo upload or long-running endpoint.
 */
export function isLongRunningEndpoint(url) {
  if (!url) return false;
  const urlStr = typeof url === 'string' ? url : url.url || url.toString();
  return urlStr.includes('/storage/v1/object/') || urlStr.includes('upload');
}

/**
 * Verifies local storage health. If suspended or locked during backgrounding,
 * tests read/write access.
 */
export function verifyStorageHealth() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const testKey = '__gs_lifecycle_ping__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (err) {
    console.warn('[LifecycleRecovery] Storage ping failed:', err);
    return false;
  }
}

/**
 * Installs the non-invasive fetch timeout & targeted auth/query cache-control wrapper.
 * Preserves all original fetch behaviors, headers, and offline submission handling.
 */
export function installFetchInterceptor({ defaultTimeoutMs = 12000, uploadTimeoutMs = 45000 } = {}) {
  if (typeof window === 'undefined' || !window.fetch) return;
  if (originalFetch) return; // already installed

  originalFetch = window.fetch;

  window.fetch = async function interceptedFetch(input, init = {}) {
    const method = init.method || 'GET';
    const bustCache = shouldBustCache(input, method);
    const isLong = isLongRunningEndpoint(input);
    const timeoutMs = isLong ? uploadTimeoutMs : defaultTimeoutMs;

    // Clone headers or create new Headers object to inject cache-busting for auth & dynamic queries
    let headers = init.headers;
    if (bustCache) {
      if (headers instanceof Headers) {
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        headers.set('Pragma', 'no-cache');
      } else if (Array.isArray(headers)) {
        headers = [
          ...headers,
          ['Cache-Control', 'no-store, no-cache, must-revalidate'],
          ['Pragma', 'no-cache'],
        ];
      } else {
        headers = {
          ...headers,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        };
      }
    }

    // Set up AbortController timeout to prevent zombie sockets from hanging indefinitely
    const controller = new AbortController();
    let timeoutId = null;
    let timedOut = false;

    // Chain with existing AbortSignal if caller provided one
    if (init.signal) {
      if (init.signal.aborted) {
        controller.abort(init.signal.reason);
      } else {
        init.signal.addEventListener('abort', () => controller.abort(init.signal.reason), { once: true });
      }
    }

    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms (zombie connection prevented)`, 'AbortError'));
    }, timeoutMs);

    const mergedInit = {
      ...init,
      headers: headers !== undefined ? headers : init.headers,
      signal: controller.signal,
      ...(bustCache ? { cache: 'no-store' } : {}),
    };

    try {
      const response = await originalFetch(input, mergedInit);
      return response;
    } catch (err) {
      if (timedOut) {
        const timeoutError = new Error(`Network timeout (${timeoutMs}ms) \u2014 you may be offline.`);
        timeoutError.name = 'AbortError';
        timeoutError.isTimeout = true;
        throw timeoutError;
      }
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };
}

/**
 * Removes the fetch interceptor (useful for test teardown).
 */
export function uninstallFetchInterceptor() {
  if (originalFetch && typeof window !== 'undefined') {
    window.fetch = originalFetch;
    originalFetch = null;
  }
}

/**
 * Executes foreground resume recovery logic.
 */
export async function handleAppResume({ supabase } = {}) {
  const now = Date.now();
  if (now - lastResumeTime < RESUME_THROTTLE_MS) {
    return; // throttle rapid duplicate events
  }
  lastResumeTime = now;

  console.log('[LifecycleRecovery] App resumed from background/tab-switch. Running recovery...');

  // 1. Verify Storage Health
  verifyStorageHealth();

  // 2. Clear stuck UI spinners & notify views
  window.dispatchEvent(new CustomEvent('app-lifecycle-resume', { detail: { timestamp: now } }));
  window.dispatchEvent(new CustomEvent('app-reset-stuck-spinners', { detail: { timestamp: now } }));

  // 3. Flush existing offline queue if online
  // If connection was restored while hidden, browser missed the window 'online' event
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      window.dispatchEvent(new Event('manual-sync-trigger'));
    } catch (e) {
      console.warn('[LifecycleRecovery] Error dispatching manual-sync-trigger:', e);
    }
  }

  // 4. Silently re-verify auth/session state without disturbing active form inputs
  if (supabase?.auth?.getSession) {
    try {
      // Use short 6-second timeout for session refresh probe
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session probe timed out')), 6000)
      );
      const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);
      if (error) {
        console.warn('[LifecycleRecovery] Silent session revalidation error:', error.message);
      } else if (data?.session) {
        window.dispatchEvent(new CustomEvent('app-session-verified', { detail: { session: data.session } }));
      }
    } catch (err) {
      console.warn('[LifecycleRecovery] Session check failed or timed out:', err.message);
    }
  }

  // 5. Silently trigger stale data revalidation
  window.dispatchEvent(new CustomEvent('app-data-revalidate', { detail: { timestamp: now } }));
}

/**
 * Initializes the App Lifecycle Recovery system.
 * Call this once at the root level (main.jsx).
 *
 * @param {Object} options
 * @param {Object} options.supabase - The Supabase client instance
 * @param {number} [options.defaultTimeoutMs=12000] - Default network timeout
 * @param {number} [options.uploadTimeoutMs=45000] - Upload network timeout
 * @returns {Function} Cleanup function to unbind all listeners
 */
export function initAppLifecycleRecovery({ supabase, defaultTimeoutMs = 12000, uploadTimeoutMs = 45000 } = {}) {
  if (typeof window === 'undefined') return () => {};
  if (isInitialized) {
    console.log('[LifecycleRecovery] Already initialized');
    return () => {};
  }
  isInitialized = true;

  // 1. Install fetch wrapper with AbortController timeout & auth cache-control
  installFetchInterceptor({ defaultTimeoutMs, uploadTimeoutMs });

  // 2. Attach resume event listeners
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      handleAppResume({ supabase });
    }
  };

  const onPageShow = (event) => {
    // event.persisted is true when restored from Back-Forward Cache (BFCache)
    if (event?.persisted || document.visibilityState === 'visible') {
      handleAppResume({ supabase });
    }
  };

  const onFocus = () => {
    if (document.visibilityState === 'visible') {
      handleAppResume({ supabase });
    }
  };

  const onOnline = () => {
    // When device connects online, trigger the existing offline queue sync
    window.dispatchEvent(new Event('manual-sync-trigger'));
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onOnline);
    uninstallFetchInterceptor();
    isInitialized = false;
  };
}

/**
 * Resets internal state for unit testing.
 */
export function _resetStateForTests() {
  isInitialized = false;
  lastResumeTime = 0;
  uninstallFetchInterceptor();
}

