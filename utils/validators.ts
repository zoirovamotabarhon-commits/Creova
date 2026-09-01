export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email.trim()
  );
};

export const isValidEmail = validateEmail;

export const validatePassword = (
  password: string
): boolean => {
  return password.length >= 8;
};

export const isValidPassword = validatePassword;

export const validatePasswordMatch = (
  password: string,
  confirmPassword: string
): boolean => {
  return password === confirmPassword;
};

export const validateRequired = (
  value: string
): boolean => {
  return value.trim().length > 0;
};
