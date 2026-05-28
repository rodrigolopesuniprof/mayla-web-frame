/**
 * Avatar helpers — DiceBear (local) + initials fallback.
 */
import { createAvatar } from "@dicebear/core";
import {
  adventurer,
  avataaars,
  bottts,
  lorelei,
  micah,
  notionists,
  openPeeps,
  personas,
  thumbs,
} from "@dicebear/collection";

export type AvatarType = "initials" | "dicebear" | "readyplayerme";

export const DICEBEAR_STYLES = [
  "adventurer",
  "avataaars",
  "bottts",
  "lorelei",
  "micah",
  "notionists",
  "openPeeps",
  "personas",
  "thumbs",
] as const;
export type DicebearStyle = (typeof DICEBEAR_STYLES)[number];

const STYLE_MAP: Record<DicebearStyle, any> = {
  adventurer,
  avataaars,
  bottts,
  lorelei,
  micah,
  notionists,
  openPeeps,
  personas,
  thumbs,
};

export const DICEBEAR_STYLE_LABELS: Record<DicebearStyle, string> = {
  adventurer: "Aventura",
  avataaars: "Avataaars",
  bottts: "Robôs",
  lorelei: "Lorelei",
  micah: "Micah",
  notionists: "Notion",
  openPeeps: "Open Peeps",
  personas: "Personas",
  thumbs: "Polegares",
};

/** Generate a DiceBear avatar locally as a data URI (no network). */
export function dicebearDataUri(style: DicebearStyle, seed: string): string {
  const collection = STYLE_MAP[style] ?? adventurer;
  return createAvatar(collection, { seed: seed || "user" }).toDataUri();
}

/** Legacy helper kept for backwards compatibility (signup flow). Uses local generation. */
export function dicebearUrl(fullName: string, userId: string, style: DicebearStyle = "adventurer") {
  const seed = `${fullName || "user"}${userId}`;
  return dicebearDataUri(style, seed);
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
