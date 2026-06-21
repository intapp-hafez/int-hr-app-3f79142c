import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyPermissions,
  type EffectivePerm,
  type PermissionAction,
} from "@/backend/functions/permissions.functions";
import { useSession } from "@/lib/auth";

export function usePermissions() {
  const session = useSession();
  const fn = useServerFn(getMyPermissions);
  const q = useQuery({
    queryKey: ["my-permissions", session?.employeeId ?? null],
    queryFn: () => fn(),
    enabled: !!session,
    staleTime: 60_000,
  });
  const data = q.data;
  function can(page: string, action: PermissionAction): boolean {
    if (!data) return false;
    if (data.isAdmin) return true;
    const row = data.perms.find((p: EffectivePerm) => p.page === page);
    if (!row) return false;
    return Boolean((row as any)[`can_${action}`]);
  }
  return { isAdmin: data?.isAdmin ?? false, perms: data?.perms ?? [], can, loading: q.isLoading };
}

export function Can({
  page,
  action,
  children,
  fallback = null,
}: {
  page: string;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return can(page, action) ? <>{children}</> : <>{fallback}</>;
}