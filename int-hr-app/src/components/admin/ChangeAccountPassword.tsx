import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function ChangeAccountPassword({ userId, name, email }: { userId: string; name: string; email: string }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!session?.roles.includes("admin")) return null;

  function close() {
    if (busy) return;
    setOpen(false); setPassword(""); setConfirm(""); setError("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8 || password.length > 128 || !password.trim()) { setError("Password must contain 8–128 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setBusy(true); setError("");
    try {
      const result = await supabase.functions.invoke("send-smtp-email", {
        body: { action: "change-account-password", userId, password },
      });
      if (result.error) {
        let message = "Password was not changed. Please retry.";
        const response = result.error.context;
        if (response instanceof Response) {
          const details = await response.json().catch(() => null);
          if (typeof details?.error === "string") message = details.error;
        }
        throw new Error(message);
      }
      if (result.data?.ok !== true) throw new Error(result.data?.error || "Password was not changed");
      toast.success(`Password changed for ${name || email}`);
      setOpen(false); setPassword(""); setConfirm("");
    } catch (e) { setError(e instanceof Error ? e.message : "Password was not changed"); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" size="sm" title={`Change password for ${name || email}`} onClick={() => setOpen(true)}>
      <KeyRound /> Change password
    </Button>
    <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
      <DialogContent className="max-w-md" onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}>
        <DialogHeader><DialogTitle>Change account password</DialogTitle><DialogDescription>{name}<br />{email}</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`password-${userId}`}>New password</Label><Input id={`password-${userId}`} type="password" autoComplete="new-password" autoFocus required minLength={8} maxLength={128} value={password} disabled={busy} onChange={(event) => { setPassword(event.target.value); setError(""); }} /></div>
          <div className="space-y-2"><Label htmlFor={`confirm-${userId}`}>Confirm new password</Label><Input id={`confirm-${userId}`} type="password" autoComplete="new-password" required value={confirm} disabled={busy} onChange={(event) => { setConfirm(event.target.value); setError(""); }} aria-invalid={!!error} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <KeyRound />}Change password</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}