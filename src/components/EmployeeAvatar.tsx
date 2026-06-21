import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import flower1 from "@/assets/flower-1.png.asset.json";
import flower2 from "@/assets/flower-2.png.asset.json";
import flower3 from "@/assets/flower-3.png.asset.json";

const DEFAULT_AVATARS = [flower1.url, flower2.url, flower3.url];

function hashIndex(id: string, mod: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function employeePhotoUrl(id: string) {
  return DEFAULT_AVATARS[hashIndex(id, DEFAULT_AVATARS.length)];
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function EmployeeAvatar({
  id,
  name,
  className,
  fallbackClassName,
  url,
}: {
  id: string;
  name: string;
  className?: string;
  fallbackClassName?: string;
  url?: string | null;
}) {
  return (
    <Avatar className={cn("h-10 w-10", className)}>
      <AvatarImage src={url || employeePhotoUrl(id)} alt={name} />
      <AvatarFallback className={cn("bg-gradient-brand text-brand-foreground text-[10px] font-semibold", fallbackClassName)}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}