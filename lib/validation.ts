const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(
  email: string
): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function validatePassword(
  password: string
): boolean {
  return password.length >= 8;
}

export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): boolean {
  return password === confirmPassword;
}

export function validateRequired(
  value: string
): boolean {
  return value.trim().length > 0;
}

export function validatePromptLength(
  prompt: string,
  maxLength = 12000
): boolean {
  const trimmed = prompt.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
    }
