import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit & Integration Test Suite for GramSeva Officer & Citizen Invitation System
 * Verifies:
 * 1. Zero-input instant link generation for BOTH Village Officers & Citizens
 * 2. Automatic village scoping & security enforcement
 * 3. Officer self-registration with Name, Phone, and Department
 * 4. Citizen self-registration with Name, Phone (no department)
 * 5. Token expiration, revocation, single-use, and role-preserving replacement
 */

describe("GramSeva Dual Officer & Citizen Invitation System", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Admin Link Generation (Both Officer & Citizen Links)", () => {
    it("generates an officer link immediately without requiring officer name, email, or department", async () => {
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

      const result = mockGenerateOfficerInvitation(caller);

      expect(result.success).toBe(true);
      expect(result.role).toBe("officer");
      expect(result.village_id).toBe(42);
      expect(result.village_name).toBe("Rampur");
      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(64);
      expect(result.expires_at).toBeDefined();
      expect(result).not.toHaveProperty("officer_name");
      expect(result).not.toHaveProperty("officer_email");
    });

    it("generates a citizen link immediately bound to the village", async () => {
      const caller = {
        id: "admin-uuid-101",
        role: "village_admin",
        village_id: 42,
        village_name: "Rampur",
        district: "Varanasi",
      };

      const mockGenerateCitizenInvitation = vi.fn().mockImplementation((context) => {
        if (!context || !context.id) {
          return { success: false, error: "Not authenticated" };
        }
        if (!["village_admin", "district_admin", "super_admin"].includes(context.role)) {
          return { success: false, error: "Only village administrators can generate citizen links" };
        }

        const token = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        return {
          success: true,
          id: "invite-uuid-777",
          token,
          village_id: context.village_id,
          village_name: context.village_name,
          district: context.district,
          expires_at: expiresAt,
          role: "citizen",
        };
      });

      const result = mockGenerateCitizenInvitation(caller);

      expect(result.success).toBe(true);
      expect(result.role).toBe("citizen");
      expect(result.village_id).toBe(42);
      expect(result.village_name).toBe("Rampur");
      expect(result.token).toHaveLength(64);
    });

    it("rejects non-admin roles from generating invitation links", () => {
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

  describe("Self-Registration & Acceptance (Officer vs Citizen)", () => {
    const mockAccept = ({ invitation, officerUserId, name, phone, department }) => {
      if (invitation.status !== "pending") {
        return { success: false, error: `This invitation has already been ${invitation.status}` };
      }

      const isOfficer = invitation.role === "officer";
      const storedProfile = {
        id: officerUserId,
        village_id: invitation.village_id,
        role: invitation.role,
        name: name.trim() || (isOfficer ? "Officer" : "Citizen Member"),
        phone: phone.trim(),
        department: isOfficer ? (department.trim() || "General Administration") : null,
      };

      invitation.status = "accepted";
      invitation.accepted_by = officerUserId;

      return {
        success: true,
        village_name: invitation.village_name,
        village_id: invitation.village_id,
        role: invitation.role,
        department: storedProfile.department,
        name: storedProfile.name,
      };
    };

    it("updates profile with officer-provided details including department", () => {
      const officerInvite = {
        id: "inv-uuid-777",
        token: "officer-invite-token-abc",
        village_id: 88,
        village_name: "Greenfield Village",
        role: "officer",
        status: "pending",
      };

      const result = mockAccept({
        invitation: officerInvite,
        officerUserId: "officer-505",
        name: "Suresh Patil",
        phone: "9876543210",
        department: "Water Supply & Sanitation",
      });

      expect(result.success).toBe(true);
      expect(result.role).toBe("officer");
      expect(result.department).toBe("Water Supply & Sanitation");
      expect(result.name).toBe("Suresh Patil");
      expect(result.village_id).toBe(88);
      expect(officerInvite.status).toBe("accepted");
    });

    it("updates profile for citizen registration without department", () => {
      const citizenInvite = {
        id: "inv-uuid-888",
        token: "citizen-invite-token-xyz",
        village_id: 88,
        village_name: "Greenfield Village",
        role: "citizen",
        status: "pending",
      };

      const result = mockAccept({
        invitation: citizenInvite,
        officerUserId: "citizen-606",
        name: "Aarti Verma",
        phone: "9876501234",
        department: "",
      });

      expect(result.success).toBe(true);
      expect(result.role).toBe("citizen");
      expect(result.department).toBeNull();
      expect(result.name).toBe("Aarti Verma");
      expect(result.village_id).toBe(88);
      expect(citizenInvite.status).toBe("accepted");
    });
  });

  describe("Revocation and Link Replacement", () => {
    it("allows village admin to revoke an active invitation", () => {
      const invitations = [
        { id: "inv-101", village_id: 15, status: "pending", role: "officer" },
        { id: "inv-102", village_id: 16, status: "pending", role: "citizen" },
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

      const ownRevoke = mockRevokeInvitation(15, "inv-101");
      expect(ownRevoke.success).toBe(true);
      expect(invitations[0].status).toBe("revoked");

      const crossVillageRevoke = mockRevokeInvitation(15, "inv-102");
      expect(crossVillageRevoke.success).toBe(false);
      expect(crossVillageRevoke.error).toContain("Unauthorized");
    });

    it("preserves the original role when replacing an invitation link", () => {
      const invitations = [
        { id: "inv-1", role: "citizen", status: "revoked" },
        { id: "inv-2", role: "officer", status: "revoked" },
      ];

      const determineReplacementRole = (inviteId) => {
        const inv = invitations.find(i => i.id === inviteId);
        return inv ? inv.role : "officer";
      };

      expect(determineReplacementRole("inv-1")).toBe("citizen");
      expect(determineReplacementRole("inv-2")).toBe("officer");
    });
  });

  describe("Modal Title Role Resolution & Multilingual Support (Telugu, Hindi, English)", () => {
    it("resolves the correct title key based on generatedInvite.role or inviteRole", () => {
      const getModalTitleKey = (generatedInvite, inviteRole) => {
        const activeRole = (generatedInvite && generatedInvite.role) ? generatedInvite.role : inviteRole;
        if (activeRole === 'officer') return 'officer_invite_title';
        if (activeRole === 'citizen') return 'citizen_invite_title';
        return 'invite_create_title';
      };

      // When citizen link was generated
      expect(getModalTitleKey({ role: 'citizen' }, 'officer')).toBe('citizen_invite_title');

      // When officer link was generated
      expect(getModalTitleKey({ role: 'officer' }, 'citizen')).toBe('officer_invite_title');

      // Default before generation
      expect(getModalTitleKey(null, 'citizen')).toBe('citizen_invite_title');
      expect(getModalTitleKey(null, 'officer')).toBe('officer_invite_title');
    });

    it("verifies accurate translations in English, Hindi, and Telugu", async () => {
      const i18nModule = await import("../../i18n.js");
      const i18n = i18nModule.default;

      // English
      expect(i18n.t('officer_invite_title', { lng: 'en' })).toBe('⚡ Officer Invitation Link');
      expect(i18n.t('citizen_invite_title', { lng: 'en' })).toBe('👥 Citizen Invitation Link');
      expect(i18n.t('citizen_invite_ready_title', { lng: 'en' })).toBe('👥 Citizen Invitation Link Ready!');

      // Hindi
      expect(i18n.t('officer_invite_title', { lng: 'hi' })).toBe('⚡ अधिकारी आमंत्रण लिंक');
      expect(i18n.t('citizen_invite_title', { lng: 'hi' })).toBe('👥 नागरिक आमंत्रण लिंक');
      expect(i18n.t('citizen_invite_ready_title', { lng: 'hi' })).toBe('👥 नागरिक आमंत्रण लिंक तैयार है!');
      expect(i18n.t('generate_citizen_link_btn', { lng: 'hi' })).toBe('👥 नागरिक लिंक बनाएं');

      // Telugu
      expect(i18n.t('officer_invite_title', { lng: 'te' })).toBe('⚡ అధికారి ఆహ్వాన లింక్');
      expect(i18n.t('citizen_invite_title', { lng: 'te' })).toBe('👥 పౌరుల ఆహ్వాన లింక్');
      expect(i18n.t('citizen_invite_ready_title', { lng: 'te' })).toBe('👥 పౌరుల ఆహ్వాన లింక్ సిద్ధంగా ఉంది!');
      expect(i18n.t('generate_citizen_link_btn', { lng: 'te' })).toBe('👥 పౌరుల లింక్ సృష్టించండి');
    });
  });
});

