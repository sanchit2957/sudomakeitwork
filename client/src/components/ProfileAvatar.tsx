import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Curated harmonious color palette for deterministic user avatars
const AVATAR_PALETTE = [
  { bg: "bg-[#0f766e]", text: "text-white", border: "border-[#115e59]" }, // Deep Teal
  { bg: "bg-[#2563eb]", text: "text-white", border: "border-[#1d4ed8]" }, // Royal Blue
  { bg: "bg-[#7c3aed]", text: "text-white", border: "border-[#6d28d9]" }, // Violet
  { bg: "bg-[#db2777]", text: "text-white", border: "border-[#be185d]" }, // Pink
  { bg: "bg-[#ea580c]", text: "text-white", border: "border-[#c2410c]" }, // Orange
  { bg: "bg-[#059669]", text: "text-white", border: "border-[#047857]" }, // Emerald
  { bg: "bg-[#4f46e5]", text: "text-white", border: "border-[#4338ca]" }, // Indigo
  { bg: "bg-[#d97706]", text: "text-white", border: "border-[#b45309]" }, // Amber
  { bg: "bg-[#0891b2]", text: "text-white", border: "border-[#0e7490]" }, // Cyan
  { bg: "bg-[#be123c]", text: "text-white", border: "border-[#9f1239]" }, // Rose
];

export function getAvatarColor(identifier?: string | null) {
  if (!identifier || identifier.trim() === "") {
    return AVATAR_PALETTE[0];
  }
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

/**
 * Returns strictly the first letter of the name (or first letter of email username).
 * Example: "Ayushi Singh" -> "A", "Rahul Sharma" -> "R"
 */
export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim().length > 0) {
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase();
  }
  if (email && email.trim().length > 0) {
    const handle = email.trim().split("@")[0];
    return handle.charAt(0).toUpperCase() || "U";
  }
  return "U";
}

/**
 * Returns only the first word of the full name.
 * Example: "Ayushi Singh" -> "Ayushi", "Rahul Sharma" -> "Rahul"
 */
export function getFirstName(name?: string | null, email?: string | null, fallback = "User"): string {
  if (name && name.trim().length > 0) {
    const firstWord = name.trim().split(/\s+/)[0];
    if (firstWord.length > 0) return firstWord;
  }
  if (email && email.trim().length > 0) {
    const handle = email.trim().split("@")[0];
    const segment = handle.split(/[._-]/)[0];
    if (segment.length > 0) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
  }
  return fallback;
}

export type ProfileAvatarProps = {
  user?: {
    name?: string | null;
    email?: string | null;
    photoUrl?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
  } | null;
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  onClick?: () => void;
  showBorder?: boolean;
};

const SIZE_CLASSES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs font-bold",
  md: "h-10 w-10 text-sm font-black",
  lg: "h-12 w-12 text-base font-black",
  xl: "h-14 w-14 text-lg font-black",
  "2xl": "h-16 w-16 text-xl font-black",
};

export function ProfileAvatar({
  user,
  src,
  name,
  email,
  size = "md",
  className,
  onClick,
  showBorder = true,
}: ProfileAvatarProps) {
  const resolvedPhoto = src || user?.photoUrl || user?.avatarUrl || null;
  const resolvedName = name || user?.name || null;
  const resolvedEmail = email || user?.email || null;
  const seedString = resolvedName || resolvedEmail || "anonymous";

  const color = getAvatarColor(seedString);
  const initial = getInitials(resolvedName, resolvedEmail);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <Avatar
      onClick={onClick}
      className={cn(
        sizeClass,
        "relative shrink-0 select-none overflow-hidden rounded-full shadow-sm transition-transform duration-200",
        showBorder && "ring-2 ring-white/60 dark:ring-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
        onClick && "cursor-pointer hover:scale-105 active:scale-95",
        className
      )}
    >
      {resolvedPhoto ? (
        <AvatarImage
          src={resolvedPhoto}
          alt={resolvedName || "User Avatar"}
          className="h-full w-full object-cover"
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "flex h-full w-full items-center justify-center font-extrabold tracking-tight select-none",
          color.bg,
          color.text
        )}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

export type UserProfileBadgeProps = {
  user?: {
    name?: string | null;
    email?: string | null;
    photoUrl?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
    [key: string]: any;
  } | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  avatarClassName?: string;
  textClassName?: string;
  subtext?: string;
  subtextClassName?: string;
  onClick?: () => void;
  clickable?: boolean;
  fallbackName?: string;
};

const BADGE_TEXT_SIZES = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-sm font-extrabold",
  lg: "text-base font-black",
  xl: "text-lg font-black",
};

/**
 * Reusable Profile Component:
 * Circular avatar (custom photo or first-letter initial) next to only the first word of full name.
 * Example: "Ayushi Singh" displays as avatar + "Ayushi" only.
 */
export function UserProfileBadge({
  user,
  size = "md",
  className,
  avatarClassName,
  textClassName,
  subtext,
  subtextClassName,
  onClick,
  clickable = false,
  fallbackName,
}: UserProfileBadgeProps) {
  const firstName = getFirstName(user?.name, user?.email, fallbackName);
  const isInteractive = clickable || Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive && onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={cn(
        "inline-flex items-center gap-2.5 min-w-0 select-none text-left",
        isInteractive && "group cursor-pointer transition-opacity hover:opacity-90 active:scale-[0.98]",
        className
      )}
    >
      <ProfileAvatar
        user={user}
        size={size}
        className={avatarClassName}
        showBorder
      />
      <div className="flex flex-col min-w-0 leading-tight">
        <span
          className={cn(
            "truncate tracking-tight font-extrabold text-[#142c2b] dark:text-[#f4f4f5]",
            BADGE_TEXT_SIZES[size] || BADGE_TEXT_SIZES.md,
            isInteractive && "group-hover:text-primary transition-colors",
            textClassName
          )}
        >
          {firstName}
        </span>
        {subtext && (
          <span
            className={cn(
              "truncate font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
              subtextClassName
            )}
          >
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}

export default ProfileAvatar;
