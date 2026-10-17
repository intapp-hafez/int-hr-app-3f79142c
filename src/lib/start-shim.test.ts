import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), eq: vi.fn(), select: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.session }, from: mocks.from },
}));

import { createServerFn } from "./start-shim";
import { createServerFn as createIntServerFn } from "../../int-hr-app/src/lib/start-shim";

describe.each([["main", createServerFn], ["int app", createIntServerFn]])("%s role context", (_name, createFn) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ data: { session: { user: { id: "current-user" } } } });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
  });

  it("loads real account roles for trip allowance and payment checks", async () => {
    mocks.eq.mockResolvedValue({ data: [{ role: "admin" }], error: null });
    const fn = createFn().handler(({ context }: any) => context.roles.some((role: string) => role === "admin"));
    expect(await fn()).toBe(true);
    expect(mocks.from).toHaveBeenCalledWith("user_roles");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "current-user");
  });

  it("provides an empty array when the account has no roles", async () => {
    mocks.eq.mockResolvedValue({ data: null, error: null });
    const fn = createFn().handler(({ context }: any) => context.roles.some((role: string) => role === "admin"));
    expect(await fn()).toBe(false);
  });

  it("provides an empty array while signed out without querying roles", async () => {
    mocks.session.mockResolvedValue({ data: { session: null } });
    const fn = createFn().handler(({ context }: any) => context.roles);
    expect(await fn()).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not proceed when the role lookup fails", async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { message: "Role lookup failed" } });
    const handler = vi.fn();
    const fn = createFn().handler(handler);
    await expect(fn()).rejects.toThrow("Role lookup failed");
    expect(handler).not.toHaveBeenCalled();
  });
});