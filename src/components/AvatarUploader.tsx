import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { updateEmployeeAdmin } from "@/backend/functions/employees.functions";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 500 * 1024;

export function AvatarUploader({
  userId,
  name,
  url,
  onChange,
  size = "md",
  canEdit = true,
  className,
}: {
  userId: string;
  name: string;
  url?: string | null;
  onChange?: (url: string | null) => void;
  size?: "md" | "lg";
  canEdit?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(url ?? null);
  const updateFn = useServerFn(updateEmployeeAdmin);

  async function persist(next: string | null) {
    setBusy(true);
    try {
      await updateFn({ data: { id: userId, avatar_url: next } });
      setLocalUrl(next);
      onChange?.(next);
      toast.success(next ? "Avatar updated" : "Avatar removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Avatar update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) { toast.error("Only PNG, JPEG or WEBP"); return; }
    if (f.size > MAX_BYTES) { toast.error("Image must be 500 KB or less"); return; }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
    await persist(dataUrl);
  }

  const isLg = size === "lg";
  const dim = isLg ? "h-20 w-20" : "h-14 w-14";
  const uploadBtnDim = isLg ? "h-6 w-6" : "h-5 w-5";
  const uploadIconDim = isLg ? "h-3 w-3" : "h-2.5 w-2.5";
  const removeBtnDim = isLg ? "h-5 w-5" : "h-4.5 w-4.5";
  const removeIconDim = isLg ? "h-2.5 w-2.5" : "h-2 w-2";
  const ringCls = isLg ? "ring-2" : "ring-1.5";

  return (
    <div className={`relative inline-block ${className ?? ""}`}>
      <EmployeeAvatar id={userId} name={name} url={localUrl} className={dim} />
      {canEdit && (
        <>
          <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            title="Upload avatar"
            className={`absolute -bottom-0.5 -end-0.5 grid ${uploadBtnDim} place-items-center rounded-full bg-gradient-brand text-brand-foreground shadow-sm ${ringCls} ring-background transition-transform active:scale-90 hover:scale-105 disabled:opacity-60`}
          >
            <Upload className={uploadIconDim} />
          </button>
          {localUrl && (
            <button
              type="button"
              onClick={() => persist(null)}
              disabled={busy}
              title="Remove avatar"
              className={`absolute -top-0.5 -end-0.5 grid ${removeBtnDim} place-items-center rounded-full bg-destructive text-destructive-foreground shadow-sm ${ringCls} ring-background transition-transform active:scale-90 hover:scale-105 disabled:opacity-60`}
            >
              <X className={removeIconDim} />
            </button>
          )}
        </>
      )}
    </div>
  );
}