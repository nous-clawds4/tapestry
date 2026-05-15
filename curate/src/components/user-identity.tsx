"use client";

import { useProfile } from "@/hooks/use-profile";
import { profileDisplayName, shortNpub } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  pubkey: string;
  /** Show avatar image if available. Default true. */
  showAvatar?: boolean;
  /** Size of avatar in px. Default 20. */
  avatarSize?: number;
  /** Additional className for the wrapper. */
  className?: string;
  /** Text size class. Default "text-[12px]". */
  textClass?: string;
}

/**
 * Renders a user identity with profile pic + display name.
 * Fallback order: picture → name → nip05 → npub (never hex).
 */
export function UserIdentity({
  pubkey,
  showAvatar = true,
  avatarSize = 20,
  className,
  textClass = "text-[12px]",
}: Props) {
  const profile = useProfile(pubkey);
  const displayName = profileDisplayName(profile, pubkey);
  const picture = profile?.picture;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {showAvatar && picture ? (
        <img
          src={picture}
          alt=""
          className="rounded-full object-cover shrink-0"
          style={{ width: avatarSize, height: avatarSize }}
          onError={(e) => {
            // Hide broken images
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : showAvatar ? (
        <span
          className="rounded-full bg-rule shrink-0 flex items-center justify-center text-mute"
          style={{
            width: avatarSize,
            height: avatarSize,
            fontSize: avatarSize * 0.45,
          }}
        >
          {displayName[0]?.toUpperCase() ?? "?"}
        </span>
      ) : null}
      <span className={cn(textClass, "text-mute truncate")}>{displayName}</span>
    </span>
  );
}
