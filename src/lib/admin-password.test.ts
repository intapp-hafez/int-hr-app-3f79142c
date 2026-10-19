import { describe, it, expect, vi } from "vitest";
import { changeAccountPassword } from "../../supabase/functions/send-smtp-email/password-change";

const userId = "12345678-1234-4234-8234-123456789abc";
function setup(role: string = "admin", lookupError: unknown = null) {
  const update = vi.fn().mockResolvedValue({ error: null });
  const createAdmin = vi.fn(() => ({ auth: { admin: { updateUserById: update } } }));
  const caller = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: role === "admin", error: lookupError }),
  };
  return { caller, createAdmin, update };
}
describe("Admin account password changes", () => {
  for (const role of ["employee", "hr", "finance", "staff", "user", "manager"]) {
    it(`rejects a ${role} caller`, async () => {
      const s = setup(role);
      const result = await changeAccountPassword(s.caller, s.createAdmin, { userId, password: "Test@12345" });
      expect(result.status).toBe(403);
      expect(s.createAdmin).not.toHaveBeenCalled();
    });
  }
  it("fails closed when role lookup fails", async () => {
    const s = setup("admin", new Error("lookup failed"));
    expect((await changeAccountPassword(s.caller, s.createAdmin, { userId, password: "Test@12345" })).status).toBe(403);
    expect(s.update).not.toHaveBeenCalled();
  });
  it("rejects signed-out callers", async () => {
    const s = setup();
    s.caller.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await changeAccountPassword(s.caller, s.createAdmin, {})).status).toBe(401);
    expect(s.createAdmin).not.toHaveBeenCalled();
  });
  it("allows admins to update another account without altering its roles", async () => {
    const s = setup();
    const target = "87654321-1234-4234-8234-123456789abc";
    const result = await changeAccountPassword(s.caller, s.createAdmin, { userId: target, password: "Test@12345" });
    expect(s.caller.rpc).toHaveBeenCalledWith("has_role", { _user_id: userId, _role: "admin" });
    expect(s.update).toHaveBeenCalledWith(target, { password: "Test@12345" });
    expect(result).toEqual({ status: 200, body: { ok: true } });
  });
  it("never reports success when auth rejects the change", async () => {
    const s = setup();
    s.update.mockResolvedValue({ error: new Error("rejected") });
    const result = await changeAccountPassword(s.caller, s.createAdmin, { userId, password: "Test@12345" });
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("Test@12345");
  });
  it("rejects invalid targets and passwords before privileged access", async () => {
    const s = setup();
    for (const input of [{ userId: "invalid", password: "Test@12345" }, { userId, password: "short" }, { userId, password: " ".repeat(10) }]) {
      expect((await changeAccountPassword(s.caller, s.createAdmin, input)).status).toBe(400);
    }
    expect(s.createAdmin).not.toHaveBeenCalled();
  });
});