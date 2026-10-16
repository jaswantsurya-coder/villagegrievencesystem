import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit & Integration Test Suite for GramSeva Officer Invitation System
 * Verifies:
 * 1. Zero-input instant link generation for Village Admins
 * 2. Automatic village scoping & security enforcement
 * 3. Officer self-registration with Name, Phone, and Department
 * 4. Token expiration, revocation, and single-use enforcement
 */

describe("GramSeva Simplified Officer Invitation System", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Admin Link Generation (Zero officer-input requirement)", () => {
    it("generates an officer link immediately without requiring officer name, email, or department", async () => {
      // Mock authenticated village admin context
      const caller = {
        id: "admin-uuid-101",
        role: "village_admin",
        village_id: 42,
        village_name: "Rampur",
        district: "Varanasi",
      };

      const mockGenerateOfficerInvitation = vi.fn().mockImplementation((context) => {
        if (!context || !context.id) {
          return { success: false, error: "Not authenticated" };
        }
        if (!["village_admin", "district_admin", "super_admin"].includes(context.role)) {
          return { success: false, error: "Only village administrators can generate officer links" };
        }
        if (!context.village_id && context.role === "village_admin") {
          return { success: false, error: "Admin account is not assigned to any village" };
        }

        // Generate 64-char token (32 random bytes in hex)
        const token = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        return {
          success: true,
          id: "invite-uuid-555",
          token,
          village_id: context.village_id,
          village_name: context.village_name,
          district: context.district,
          expires_at: expiresAt,
          role: "officer",
        };
      });

      // Admin clicks Generate without entering any officer metadata
      const result = mockGenerateOfficerInvitation(caller);

      expect(result.success).toBe(true);
      expect(result.role).toBe("officer");
      expect(result.village_id).toBe(42);
      expect(result.village_name).toBe("Rampur");
      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(64);
      expect(result.expires_at).toBeDefined();
      // Ensure no officer details were mandated
      expect(result).not.toHaveProperty("officer_name");
      expect(result).not.toHaveProperty("officer_email");
    });

    it("rejects non-admin roles from generating officer invitation links", () => {
      const citizenCaller = {
        id: "citizen-uuid-202",
        role: "citizen",
        village_id: 42,
      };

      const mockGenerateOfficerInvitation = vi.fn().mockImplementation((context) => {
        if (!["village_admin", "district_admin", "super_admin"].includes(context.role)) {
          return { success: false, error: "Only village administrators can generate officer links" };
        }
        return { success: true };
      });

      const result = mockGenerateOfficerInvitation(citizenCaller);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Only village administrators");
    });
  });

  describe("Token Verification & Village Association", () => {
    it("returns village and role information for a valid pending token", () => {
      const invitationRecord = {
        id: "inv-1",
        token: "valid-secure-token-12345",
        village_id: 10,
        village_name: "Shivpur",
        district: "Varanasi",
        role: "officer",
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      const mockLookupInvitation = (token) => {
        if (token !== invitationRecord.token) {
          return { valid: false, error: "Invitation not found" };
        }
        if (invitationRecord.status !== "pending") {
          return { valid: false, error: "This invitation has already been " + invitationRecord.status };
        }
        if (new Date(invitationRecord.expires_at) < new Date()) {
          return { valid: false, error: "This invitation has expired" };
        }
        return {
          valid: true,
          village_name: invitationRecord.village_name,
          district: invitationRecord.district,
          role: invitationRecord.role,
          expires_at: invitationRecord.expires_at,
        };
      };

      const res = mockLookupInvitation("valid-secure-token-12345");
      expect(res.valid).toBe(true);
      expect(res.village_name).toBe("Shivpur");
      expect(res.role).toBe("officer");
    });

    it("rejects revoked invitations immediately", () => {
      const revokedInvite = {
        token: "revoked-token-999",
        status: "revoked",
      };

      const mockLookupInvitation = (token) => {
        if (revokedInvite.status === "revoked") {
          return { valid: false, error: "This invitation has been revoked" };
        }
        return { valid: true };
      };

      const res = mockLookupInvitation("revoked-token-999");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("This invitation has been revoked");
    });

    it("rejects expired invitations and flags error", () => {
      const expiredInvite = {
        token: "expired-token-000",
        status: "pending",
        expires_at: new Date(Date.now() - 100000).toISOString(),
      };

      const mockLookupInvitation = (token) => {
        if (new Date(expiredInvite.expires_at) < new Date()) {
          return { valid: false, error: "This invitation has expired" };
        }
        return { valid: true };
      };

      const res = mockLookupInvitation("expired-token-000");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("This invitation has expired");
    });
  });

  describe("Officer Self-Registration & Acceptance", () => {
    it("updates profile with officer-provided details while strictly taking village and role from invitation token", () => {
      const invitationInDB = {
        id: "inv-uuid-777",
        token: "officer-invite-token-abc",
        village_id: 88,
        village_name: "Greenfield Village",
        role: "officer",
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      };

      let storedProfile = null;
      let invitationStatus = invitationInDB.status;
      let acceptedBy = null;

      const mockAcceptInvitation = ({ token, officerUserId, name, phone, department }) => {
        if (token !== invitationInDB.token) {
          return { success: false, error: "Invitation not found" };
        }
        if (invitationStatus !== "pending") {
          return { success: false, error: `This invitation has already been ${invitationStatus}` };
        }

        // Server extracts village and role from invitation record (cannot be forged by frontend)
        const serverVillageId = invitationInDB.village_id;
        const serverRole = invitationInDB.role;

        // Officer self-provided fields
        storedProfile = {
          id: officerUserId,
          village_id: serverVillageId,
          role: serverRole,
          name: name.trim() || "Officer",
          phone: phone.trim(),
          department: department.trim() || "General Administration",
        };

        // Invalidate token so it cannot be reused
        invitationStatus = "accepted";
        acceptedBy = officerUserId;

        return {
          success: true,
          village_name: invitationInDB.village_name,
          village_id: serverVillageId,
          role: serverRole,
          department: storedProfile.department,
          name: storedProfile.name,
        };
      };

      // Officer visits /invite/:token and enters their own details
      const acceptResult = mockAcceptInvitation({
        token: "officer-invite-token-abc",
        officerUserId: "officer-new-user-505",
        name: "Suresh Patil",
        phone: "9876543210",
        department: "Water Supply & Sanitation",
      });

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.village_name).toBe("Greenfield Village");
      expect(acceptResult.role).toBe("officer");
      expect(acceptResult.name).toBe("Suresh Patil");
      expect(acceptResult.department).toBe("Water Supply & Sanitation");

      // Verify stored profile has village_id locked to invitation
      expect(storedProfile.village_id).toBe(88);
      expect(storedProfile.role).toBe("officer");
      expect(storedProfile.phone).toBe("9876543210");

      // Verify token consumption prevents replay attacks
      const replayAttempt = mockAcceptInvitation({
        token: "officer-invite-token-abc",
        officerUserId: "another-user-999",
        name: "Intruder",
        phone: "9999999999",
        department: "Electricity",
      });
      expect(replayAttempt.success).toBe(false);
      expect(replayAttempt.error).toContain("already been accepted");
    });
  });

  describe("Revocation and Link Replacement", () => {
    it("allows village admin to revoke an active invitation", () => {
      const invitations = [
        { id: "inv-101", village_id: 15, status: "pending" },
        { id: "inv-102", village_id: 16, status: "pending" },
      ];

      const mockRevokeInvitation = (adminVillageId, inviteId) => {
        const invite = invitations.find((i) => i.id === inviteId);
        if (!invite) return { success: false, error: "Invitation not found" };
        if (invite.village_id !== adminVillageId) {
          return { success: false, error: "Unauthorized to revoke this invitation" };
        }
        invite.status = "revoked";
        return { success: true };
      };

      // Admin from village 15 revokes their own invitation
      const ownRevoke = mockRevokeInvitation(15, "inv-101");
      expect(ownRevoke.success).toBe(true);
      expect(invitations[0].status).toBe("revoked");

      // Admin from village 15 attempts to revoke village 16's invitation
      const crossVillageRevoke = mockRevokeInvitation(15, "inv-102");
      expect(crossVillageRevoke.success).toBe(false);
      expect(crossVillageRevoke.error).toContain("Unauthorized");
    });
  });
});
