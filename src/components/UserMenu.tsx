import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { User, Settings as SettingsIcon, LogOut, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { useSession, signOut, setSessionAvatar } from "@/lib/auth";
import { updateEmployeeAdmin } from "@/backend/functions/employees.functions";
import { useState } from "react";

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 500 * 1024;

export function UserMenu({
  size = "md",
  align = "end",
}: {
  size?: "sm" | "md" | "lg";
  align?: "start" | "center" | "end";
}) {
  const session = useSession();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const updateFn = useServerFn(updateEmployeeAdmin);

  if (!session) return null;

  const dim = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const settingsPath =
    session.role === "admin"
      ? "/admin/settings"
      : session.role === "staff"
        ? "/staff/profile"
        : "/employee/settings";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f || !session?.employeeId) return;
    if (!ACCEPTED.includes(f.type)) { toast.error("Only PNG, JPEG or WEBP"); return; }
    if (f.size > MAX_BYTES) { toast.error("Image must be 500 KB or less"); return; }
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
      await updateFn({ data: { id: session.employeeId, avatar_url: dataUrl } });
      setSessionAvatar(dataUrl);
      toast.success("Avatar updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Avatar update failed");
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="relative">
            <EmployeeAvatar
              id={session.employeeId ?? session.username}
              name={session.name}
              url={session.avatarUrl}
              className={dim}
            />
            {busy && (
              <div className="absolute inset-0 grid place-items-center rounded-full bg-foreground/40">
                <Loader2 className="h-4 w-4 animate-spin text-background" />
              </div>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <EmployeeAvatar
              id={session.employeeId ?? session.username}
              name={session.name}
              url={session.avatarUrl}
              className="h-8 w-8"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{session.name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{session.username}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" /> Change photo
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={settingsPath}>
              <User className="mr-2 h-4 w-4" /> Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={settingsPath}>
              <SettingsIcon className="mr-2 h-4 w-4" /> Preferences
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={doLogout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}