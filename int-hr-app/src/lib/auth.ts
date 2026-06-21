import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "manager" | "staff" | "employee";
export type Session = { username: string; role: Role; name: string; employeeId?: string; roles: string[]; avatarUrl?: string | null };

function pickRole(roles: string[]): Role {
  if (roles.includes("admin") || roles.includes("hr")) return "admin";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("staff")) return "staff";
  return "employee";
}

export function pathForRole(role: Role | string): "/admin" | "/manager" | "/staff" | "/employee" {
  if (role === "admin" || role === "hr") return "/admin";
  if (role === "manager") return "/manager";
  if (role === "staff") return "/staff";
  return "/employee";
}

type AuthState = { loaded: boolean; session: Session | null };
let _state: AuthState = { loaded: false, session: null };
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
let _initialized = false;

async function hydrate(userId?: string, email?: string, metaName?: string) {
  if (!userId) {
    _state = { loaded: true, session: null };
    emit();
    return;
  }
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  _state = {
    loaded: true,
    session: {
      username: profile?.email ?? email ?? "",
      name: profile?.full_name ?? metaName ?? email ?? "",
      role: pickRole(roles),
      employeeId: userId,
      roles,
      avatarUrl: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    },
  };
  emit();
}

function ensureInit() {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;
  supabase.auth.getSession().then(({ data }) => {
    const u = data.session?.user;
    hydrate(u?.id, u?.email ?? undefined, (u?.user_metadata as { full_name?: string } | undefined)?.full_name);
  });
  supabase.auth.onAuthStateChange((_e, s) => {
    const u = s?.user;
    hydrate(u?.id, u?.email ?? undefined, (u?.user_metadata as { full_name?: string } | undefined)?.full_name);
  });
}

function subscribe(cb: () => void) {
  ensureInit();
  subs.add(cb);
  return () => subs.delete(cb);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, () => _state.session, () => null);
}

export function useAuthReady(): boolean {
  return useSyncExternalStore(subscribe, () => _state.loaded, () => false);
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function setSessionAvatar(url: string | null) {
  if (!_state.session) return;
  _state = { ..._state, session: { ..._state.session, avatarUrl: url } };
  emit();
}

export type ChangePasswordResult = "ok" | "wrong-current" | "too-short" | "no-session" | "error";

export async function changePassword(current: string, next: string): Promise<ChangePasswordResult> {
  if (next.length < 6) return "too-short";
  const { data: sess } = await supabase.auth.getSession();
  const email = sess.session?.user.email;
  if (!email) return "no-session";
  const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: current });
  if (reauthErr) return "wrong-current";
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return "error";
  return "ok";
}