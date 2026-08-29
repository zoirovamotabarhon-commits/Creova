export function formatCoins(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function formatCurrency(
  amount: number,
  currency = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function truncateText(
  text: string,
  maxLength: number
): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

export function capitalize(text: string): string {
  if (!text) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}
