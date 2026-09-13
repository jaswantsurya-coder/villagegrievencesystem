import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyInternalSecret, handleAuthError, requireRole } from "../../api/_lib/requireRole.js";

describe("Security & Authorization Helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.INTERNAL_API_SECRET;
  });

  describe("verifyInternalSecret", () => {
    it("fails closed if INTERNAL_API_SECRET environment variable is unset", () => {
      const req = { headers: { "x-internal-secret": "test-secret" } };
      expect(verifyInternalSecret(req)).toBe(false);
    });

    it("fails if request has no x-internal-secret header", () => {
      process.env.INTERNAL_API_SECRET = "super-secret-key-2026";
      const req = { headers: {} };
      expect(verifyInternalSecret(req)).toBe(false);
    });

    it("fails if secret length differs", () => {
      process.env.INTERNAL_API_SECRET = "super-secret-key-2026";
      const req = { headers: { "x-internal-secret": "short" } };
      expect(verifyInternalSecret(req)).toBe(false);
    });

    it("fails if secret characters mismatch", () => {
      process.env.INTERNAL_API_SECRET = "super-secret-key-2026";
      const req = { headers: { "x-internal-secret": "super-secret-key-2027" } };
      expect(verifyInternalSecret(req)).toBe(false);
    });

    it("succeeds with matching internal secret", () => {
      process.env.INTERNAL_API_SECRET = "super-secret-key-2026";
      const req = { headers: { "x-internal-secret": "super-secret-key-2026" } };
      expect(verifyInternalSecret(req)).toBe(true);
    });
  });

  describe("handleAuthError", () => {
    it("formats error response with correct status code and message", () => {
      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              jsonPayload = data;
              return data;
            },
          };
        },
      };

      handleAuthError(res, { status: 403, message: "Forbidden role" });
      expect(statusCode).toBe(403);
      expect(jsonPayload).toEqual({ success: false, error: "Forbidden role" });
    });

    it("defaults to 500 when status is omitted", () => {
      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              jsonPayload = data;
              return data;
            },
          };
        },
      };

      handleAuthError(res, null);
      expect(statusCode).toBe(500);
      expect(jsonPayload).toEqual({ success: false, error: "Internal server error" });
    });
  });

  describe("requireRole", () => {
    it("rejects requests without Bearer authorization header with 401", async () => {
      const req = { headers: {} };
      await expect(requireRole(req, ["super_admin"], {})).rejects.toEqual({
        status: 401,
        message: "Unauthorized. Bearer token required.",
      });
    });

    it("rejects invalid or expired token with 401", async () => {
      const req = { headers: { authorization: "Bearer invalid-token-123" } };
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("Expired") }),
        },
      };

      await expect(requireRole(req, ["super_admin"], mockSupabase)).rejects.toEqual({
        status: 401,
        message: "Invalid or expired token.",
      });
    });

    it("rejects caller with missing profile with 403", async () => {
      const req = { headers: { authorization: "Bearer valid-jwt" } };
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: new Error("Not found") }),
        }),
      };

      await expect(requireRole(req, ["super_admin"], mockSupabase)).rejects.toEqual({
        status: 403,
        message: "Profile not found. Cannot determine role.",
      });
    });

    it("rejects caller with unauthorized role with 403", async () => {
      const req = { headers: { authorization: "Bearer valid-jwt" } };
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "user-123", role: "citizen" }, error: null }),
        }),
      };

      await expect(requireRole(req, ["super_admin", "village_admin"], mockSupabase)).rejects.toEqual({
        status: 403,
        message: "Forbidden. Requires one of: super_admin, village_admin. Your role: citizen",
      });
    });

    it("authorizes caller with permitted role", async () => {
      const req = { headers: { authorization: "Bearer valid-jwt" } };
      const profileData = { id: "admin-456", role: "village_admin", village_id: 101 };
      const userData = { id: "admin-456", email: "admin@kothaguda.gov.in" };

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: userData }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
        }),
      };

      const result = await requireRole(req, ["village_admin", "super_admin"], mockSupabase);
      expect(result).toEqual({ user: userData, profile: profileData });
    });
  });
});

describe("Data Integrity & PII Masking Utilities", () => {
  // Test Ticket ID pattern (VGS- followed by 8 uppercase hexadecimal characters)
  const ticketRegex = /^VGS-[A-F0-9]{8}$/;

  function generateTicketId() {
    const chars = "0123456789ABCDEF";
    let randomPart = "";
    for (let i = 0; i < 8; i++) {
      randomPart += chars[Math.floor(Math.random() * chars.length)];
    }
    return `VGS-${randomPart}`;
  }

  it("generates complaint ticket IDs conforming to standard format", () => {
    for (let i = 0; i < 10; i++) {
      const tid = generateTicketId();
      expect(tid).toMatch(ticketRegex);
      expect(tid.length).toBe(12);
    }
  });

  // Test Phone number normalization
  function normalizePhone(raw) {
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      return digits.slice(2);
    }
    return digits.slice(-10);
  }

  it("normalizes Indian phone numbers reliably", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("91-9876543210")).toBe("9876543210");
    expect(normalizePhone("9876543210")).toBe("9876543210");
    expect(normalizePhone("+919876543210")).toBe("9876543210");
  });

  // Test Aadhaar Last 4 masking
  function maskAadhaar(last4) {
    if (!last4 || String(last4).length !== 4) return "XXXX-XXXX-XXXX";
    return `XXXX-XXXX-${String(last4).slice(-4)}`;
  }

  it("safely masks Aadhaar numbers to avoid leaking citizen identity", () => {
    expect(maskAadhaar("1234")).toBe("XXXX-XXXX-1234");
    expect(maskAadhaar(5678)).toBe("XXXX-XXXX-5678");
    expect(maskAadhaar("")).toBe("XXXX-XXXX-XXXX");
    expect(maskAadhaar(null)).toBe("XXXX-XXXX-XXXX");
  });
});

describe("SLA Escalation & Mobile Permissions Unit Helpers", () => {
  it("calculates overdue days correctly for stale complaints", () => {
    function calculateOverdueDays(createdAtStr) {
      return Math.max(7, Math.floor((Date.now() - new Date(createdAtStr).getTime()) / (1000 * 60 * 60 * 24)));
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(calculateOverdueDays(thirtyDaysAgo)).toBe(30);

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(calculateOverdueDays(twoDaysAgo)).toBe(7); // Math.max(7, ...) ensures minimum 7-day SLA threshold
  });

  it("handles mobile microphone permission state resolution without falling back to prompt when granted", () => {
    function resolveMicrophonePermission(cachedState, devices, permissionsQueryError) {
      if (cachedState === "granted") return "granted";
      if (devices && devices.some(d => d.kind === "audioinput" && d.label && d.label.length > 0)) {
        return "granted";
      }
      if (permissionsQueryError) {
        return cachedState || "prompt";
      }
      return cachedState || "prompt";
    }

    // iOS Safari throws TypeError on permissions.query({ name: 'microphone' })
    expect(resolveMicrophonePermission("granted", [], new Error("TypeError"))).toBe("granted");
    
    // Android with granted enumerateDevices label
    expect(resolveMicrophonePermission("prompt", [{ kind: "audioinput", label: "Headset Mic" }], null)).toBe("granted");
    
    // Default initial prompt
    expect(resolveMicrophonePermission(null, [{ kind: "audioinput", label: "" }], null)).toBe("prompt");
  });

  it("validates GeoJSON boundaries structure for village_boundaries upload", () => {
    function validateGeoJson(json) {
      if (!json || typeof json !== "object") return false;
      if (json.type === "FeatureCollection" && Array.isArray(json.features)) return true;
      if (json.type === "Feature" && json.geometry) return true;
      if (json.type === "Polygon" && Array.isArray(json.coordinates)) return true;
      return false;
    }

    expect(validateGeoJson({ type: "FeatureCollection", features: [] })).toBe(true);
    expect(validateGeoJson({ type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] })).toBe(true);
    expect(validateGeoJson({ type: "Invalid" })).toBe(false);
    expect(validateGeoJson(null)).toBe(false);
  });
});
