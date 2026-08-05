export function greeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Xayrli tong";
  if (hour < 18) return "Xayrli kun";

  return "Xayrli kech";
}
