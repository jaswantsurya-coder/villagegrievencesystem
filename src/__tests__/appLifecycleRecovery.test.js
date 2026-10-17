import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isAuthEndpoint,
  isLongRunningEndpoint,
  verifyStorageHealth,
  installFetchInterceptor,
  uninstallFetchInterceptor,
  handleAppResume,
  initAppLifecycleRecovery,
  _resetStateForTests,
} from "../services/appLifecycleRecovery.js";

describe("App Lifecycle, Sync & Zombie-Connection Recovery Layer", () => {
  let mockListeners = {};
  let storageMap = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    _resetStateForTests();

    mockListeners = {};
    storageMap = {};

    // Mock localStorage
    const mockStorage = {
      getItem: vi.fn((key) => (key in storageMap ? storageMap[key] : null)),
      setItem: vi.fn((key, val) => { storageMap[key] = String(val); }),
      removeItem: vi.fn((key) => { delete storageMap[key]; }),
      clear: vi.fn(() => { storageMap = {}; }),
    };
    global.localStorage = mockStorage;

    // Mock Event and CustomEvent if needed
    if (typeof global.Event === 'undefined') {
      global.Event = class Event {
        constructor(type) { this.type = type; }
      };
    }
    if (typeof global.CustomEvent === 'undefined') {
      global.CustomEvent = class CustomEvent {
        constructor(type, init = {}) {
          this.type = type;
          this.detail = init.detail;
        }
      };
    }

    // Mock Window and Document event handling
    const addEventListener = vi.fn((event, handler) => {
      mockListeners[event] = mockListeners[event] || [];
      mockListeners[event].push(handler);
    });
    const removeEventListener = vi.fn((event, handler) => {
      if (mockListeners[event]) {
        mockListeners[event] = mockListeners[event].filter(h => h !== handler);
      }
    });
    const dispatchEvent = vi.fn((event) => {
      const type = event.type;
      const handlers = mockListeners[type] || [];
      handlers.forEach(h => h(event));
      return true;
    });

    global.window = {
      addEventListener,
      removeEventListener,
      dispatchEvent,
      fetch: vi.fn(),
    };
    global.document = {
      visibilityState: 'visible',
      addEventListener,
      removeEventListener,
      dispatchEvent,
    };
    try {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    _resetStateForTests();
    delete global.window;
    delete global.document;
    delete global.localStorage;
  });

  describe("Endpoint Categorization (Targeted Cache-Control & Timeouts)", () => {
    it("identifies auth endpoints correctly", () => {
      expect(isAuthEndpoint("https://xyz.supabase.co/auth/v1/token?grant_type=password")).toBe(true);
      expect(isAuthEndpoint("https://xyz.supabase.co/auth/v1/user")).toBe(true);
      expect(isAuthEndpoint("/api/anonymous/verify-otp")).toBe(true);
      expect(isAuthEndpoint("/api/anonymous/send-otp")).toBe(true);
      expect(isAuthEndpoint("/login")).toBe(true);
    });

    it("does not categorize submission or standard RPC routes as auth", () => {
      expect(isAuthEndpoint("https://xyz.supabase.co/rest/v1/rpc/svc_create_complaint")).toBe(false);
      expect(isAuthEndpoint("/api/anonymous/submit-complaint")).toBe(false);
      expect(isAuthEndpoint("https://xyz.supabase.co/rest/v1/complaints")).toBe(false);
      expect(isAuthEndpoint(null)).toBe(false);
    });

    it("identifies file upload endpoints correctly", () => {
      expect(isLongRunningEndpoint("https://xyz.supabase.co/storage/v1/object/complaint-evidence/123.jpg")).toBe(true);
      expect(isLongRunningEndpoint("/api/upload")).toBe(true);
      expect(isLongRunningEndpoint("https://xyz.supabase.co/rest/v1/complaints")).toBe(false);
    });
  });

  describe("Storage Health Verification", () => {
    it("verifies localStorage read/write capability", () => {
      expect(verifyStorageHealth()).toBe(true);
      expect(global.localStorage.setItem).toHaveBeenCalledWith('__gs_lifecycle_ping__', '1');
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('__gs_lifecycle_ping__');
    });

    it("handles storage exceptions gracefully", () => {
      global.localStorage.setItem.mockImplementationOnce(() => {
        throw new Error("QuotaExceeded or SecurityError");
      });
      expect(verifyStorageHealth()).toBe(false);
    });
  });

  describe("Fetch Interceptor (Zombie Connection Protection & Cache Busting)", () => {
    it("injects Cache-Control headers strictly for auth endpoints", async () => {
      let capturedInit = null;
      global.window.fetch = vi.fn().mockImplementation((input, init) => {
        capturedInit = init;
        return Promise.resolve({ ok: true, status: 200 });
      });

      installFetchInterceptor({ defaultTimeoutMs: 5000 });

      // 1. Call auth endpoint
      await window.fetch("https://xyz.supabase.co/auth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(capturedInit.headers["Cache-Control"]).toBe("no-store, no-cache, must-revalidate");
      expect(capturedInit.headers["Pragma"]).toBe("no-cache");

      // 2. Call non-auth grievance submission endpoint
      await window.fetch("https://xyz.supabase.co/rest/v1/rpc/svc_create_complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(capturedInit.headers["Cache-Control"]).toBeUndefined();
    });

    it("aborts hung requests cleanly with AbortError when socket freezes", async () => {
      global.window.fetch = vi.fn().mockImplementation((input, init) => {
        return new Promise((resolve, reject) => {
          if (init.signal) {
            init.signal.addEventListener("abort", () => {
              const err = new Error("The user aborted a request.");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      });

      installFetchInterceptor({ defaultTimeoutMs: 40 }); // 40ms fast timeout for test

      let caughtError = null;
      try {
        await window.fetch("https://xyz.supabase.co/rest/v1/rpc/svc_create_complaint", {
          method: "POST",
          body: JSON.stringify({ p_title: "Test" }),
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.name).toBe("AbortError");
      expect(caughtError.message).toContain("Network timeout");
    });
  });

  describe("Resume & Lifecycle Synchronization", () => {
    it("dispatches manual-sync-trigger on resume when online", async () => {
      const syncSpy = vi.fn();
      window.addEventListener("manual-sync-trigger", syncSpy);

      const resumeSpy = vi.fn();
      window.addEventListener("app-lifecycle-resume", resumeSpy);

      const spinnerSpy = vi.fn();
      window.addEventListener("app-reset-stuck-spinners", spinnerSpy);

      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "test-user" } } } }),
        },
      };

      await handleAppResume({ supabase: mockSupabase });

      expect(syncSpy).toHaveBeenCalled();
      expect(resumeSpy).toHaveBeenCalled();
      expect(spinnerSpy).toHaveBeenCalled();
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    it("throttles rapid duplicate resume events", async () => {
      const resumeSpy = vi.fn();
      window.addEventListener("app-lifecycle-resume", resumeSpy);

      // Call twice immediately
      await handleAppResume();
      await handleAppResume();

      // Only first invocation should have run
      expect(resumeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Root Initialization & Cleanup", () => {
    it("initializes once and unbinds cleanly on cleanup", () => {
      const mockSupabase = { auth: { getSession: vi.fn() } };
      const cleanup = initAppLifecycleRecovery({ supabase: mockSupabase });

      expect(typeof cleanup).toBe("function");

      // Cleanup
      cleanup();
    });
  });
});
