/**
 * Avatar helpers — DiceBear auto-generated URLs and initials fallback.
 */

export type AvatarType = "initials" | "dicebear" | "readyplayerme";

export function dicebearUrl(fullName: string, userId: string, style = "adventurer") {
  const seed = encodeURIComponent(`${fullName || "user"}${userId}`);
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
}

export function getInitials(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "—";
}

export function hasCustomAvatar(avatarUrl?: string | null, avatarType?: string | null) {
  return !!avatarUrl && avatarType !== "initials";
}
