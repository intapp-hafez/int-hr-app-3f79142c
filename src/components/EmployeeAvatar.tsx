import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const GRADIENT_PALETTES = [
  "from-orange-500 to-amber-600 text-white",
  "from-blue-600 to-indigo-600 text-white",
  "from-emerald-600 to-teal-700 text-white",
  "from-purple-600 to-pink-600 text-white",
  "from-rose-500 to-red-600 text-white",
  "from-cyan-600 to-blue-700 text-white",
  "from-violet-600 to-purple-700 text-white",
  "from-amber-600 to-orange-700 text-white",
];

function getGradient(key?: string) {
  if (!key) return GRADIENT_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return GRADIENT_PALETTES[Math.abs(hash) % GRADIENT_PALETTES.length];
}

export function employeePhotoUrl(id: string) {
  // Retained for backwards compatibility if needed
  return undefined;
}

function initials(name?: string) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function EmployeeAvatar({
  id,
  name,
  className,
  fallbackClassName,
  url,
}: {
  id?: string;
  name: string;
  className?: string;
  fallbackClassName?: string;
  url?: string | null;
}) {
  const hasValidUrl =
    typeof url === "string" &&
    url.trim().length > 0 &&
    !url.includes("undefined") &&
    !url.includes("null");

  return (
    <Avatar className={cn("h-10 w-10 shrink-0 select-none", className)}>
      {hasValidUrl && (
        <AvatarImage
          src={url!}
          alt={name || "Avatar"}
          className="object-cover h-full w-full"
        />
      )}
      <AvatarFallback
        className={cn(
          "flex h-full w-full items-center justify-center font-bold tracking-wider bg-gradient-to-br shadow-inner",
          getGradient(id || name),
          fallbackClassName
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
