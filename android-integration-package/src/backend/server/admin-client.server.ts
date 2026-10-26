import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Server-only admin Supabase client. Uses a non-reserved env var
// (ADMIN_SUPABASE_SERVICE_ROLE_KEY) because the SUPABASE_ prefix is
// reserved on this stack. Never import this from client code.
function build() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://hydakxwzpfzwolencnmp.supabase.co";
  const key = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing ADMIN_SUPABASE_SERVICE_ROLE_KEY. Add the Supabase service role key in project secrets.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

let _client: ReturnType<typeof build> | undefined;
export const supabaseAdmin = new Proxy({} as ReturnType<typeof build>, {
  get(_t, prop, recv) {
    if (!_client) _client = build();
    return Reflect.get(_client, prop, recv);
  },
});