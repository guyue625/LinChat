export function formatStorageSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${Number(value.toFixed(value >= 10 || index === 0 ? 0 : 1))} ${
    units[index]
  }`;
}

export function invitationStatus(invitation: {
  disabled: boolean;
  usedCount: number;
  maxUses: number;
  expiresAt?: string;
}) {
  if (invitation.disabled) return "revoked" as const;
  if (invitation.usedCount >= invitation.maxUses) return "exhausted" as const;
  if (
    invitation.expiresAt &&
    new Date(invitation.expiresAt).getTime() <= Date.now()
  ) {
    return "expired" as const;
  }
  return "active" as const;
}

export function matchesUserSearch(
  user: { username: string; displayName?: string },
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return `${user.username} ${user.displayName ?? ""}`
    .toLowerCase()
    .includes(normalized);
}
