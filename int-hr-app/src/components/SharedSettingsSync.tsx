import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { startSharedSettingsSync } from "@/lib/shared-settings-sync";

export function SharedSettingsSync() {
  const queryClient = useQueryClient();
  const userId = useSession()?.employeeId;
  useEffect(() => {
    if (!userId) return;
    return startSharedSettingsSync(supabase, queryClient);
  }, [queryClient, userId]);
  return null;
}