export class AppError extends Error {
  code: string;

  constructor(message: string, code = "UNKNOWN_ERROR") {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required.") {
    super(message, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

export class InsufficientCoinsError extends AppError {
  constructor(message = "Insufficient coin balance.") {
    super(message, "INSUFFICIENT_COINS");
    this.name = "InsufficientCoinsError";
  }
}

export function getErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred."
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}
