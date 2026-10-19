export type PasswordCaller = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc: (name: string, args: { _user_id: string; _role: string }) => Promise<{ data: unknown; error: unknown }>;
};

export async function changeAccountPassword(
  caller: PasswordCaller,
  createAdmin: () => { auth: { admin: { updateUserById: (id: string, input: { password: string }) => Promise<{ error: unknown }> } } },
  body: unknown,
) {
  const identity = await caller.auth.getUser();
  if (identity.error || !identity.data.user) return { status: 401, body: { ok: false, error: "Invalid session" } };
  const role = await caller.rpc("has_role", { _user_id: identity.data.user.id, _role: "admin" });
  if (role.error || role.data !== true) return { status: 403, body: { ok: false, error: "Only administrators can change account passwords" } };
  const input = body as { userId?: unknown; password?: unknown } | null;
  if (!input || typeof input.userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.userId)) {
    return { status: 400, body: { ok: false, error: "Select a valid account" } };
  }
  if (typeof input.password !== "string" || input.password.length < 8 || input.password.length > 128 || !input.password.trim()) {
    return { status: 400, body: { ok: false, error: "Password must contain 8–128 characters" } };
  }
  // No target-role restriction: admins manage passwords for every account type.
  // Never persist, log or return the password, and never alter roles or account status.
  const { error } = await createAdmin().auth.admin.updateUserById(input.userId, { password: input.password });
  if (error) return { status: 400, body: { ok: false, error: "Password was not changed. Check the account and password requirements, then retry." } };
  return { status: 200, body: { ok: true } };
}