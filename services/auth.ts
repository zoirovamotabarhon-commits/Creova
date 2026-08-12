import { supabase } from "./supabase";

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

const RESET_PASSWORD_REDIRECT =
  "creova://reset-password";

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      return {
        success: false,
        message: "Email manzilini kiriting.",
      };
    }

    if (!password) {
      return {
        success: false,
        message: "Parolni kiriting.",
      };
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: true,
      message: "Login successful.",
      data,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Login failed.",
    };
  }
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      return {
        success: false,
        message: "Name is required.",
      };
    }

    if (!cleanEmail) {
      return {
        success: false,
        message: "Email is required.",
      };
    }

    if (!password) {
      return {
        success: false,
        message: "Password is required.",
      };
    }

    const { data, error } =
      await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
          },
        },
      });

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: true,
      message:
        "Ro'yxatdan o'tish muvaffaqiyatli yakunlandi.",
      data,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Registration failed.",
    };
  }
}

export async function logout(): Promise<AuthResponse> {
  try {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: true,
      message: "Logout successful.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Logout failed.",
    };
  }
}

export async function resetPassword(
  email: string
): Promise<AuthResponse> {
  try {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      return {
        success: false,
        message: "Email manzilini kiriting.",
      };
    }

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo:
            RESET_PASSWORD_REDIRECT,
        }
      );

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: true,
      message:
        "Password reset email sent.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Password reset failed.",
    };
  }
}

export async function updatePassword(
  password: string
): Promise<AuthResponse> {
  try {
    if (!password) {
      return {
        success: false,
        message: "Parolni kiriting.",
      };
    }

    const { data, error } =
      await supabase.auth.updateUser({
        password,
      });

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: true,
      message:
        "Parol muvaffaqiyatli yangilandi.",
      data,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Password update failed.",
    };
  }
}

export async function getCurrentUser() {
  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

export async function getCurrentSession() {
  const {
    data,
    error,
  } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return data.session;
}
