export function formatDate(date: Date | string): string {
  const parsed =
    typeof date === "string" ? new Date(date) : date;

  return parsed.toLocaleDateString();
}

export function formatDateTime(
  date: Date | string
): string {
  const parsed =
    typeof date === "string" ? new Date(date) : date;

  return parsed.toLocaleString();
}

export function timeAgo(date: Date | string): string {
  const parsed =
    typeof date === "string" ? new Date(date) : date;

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays}d ago`;
}
