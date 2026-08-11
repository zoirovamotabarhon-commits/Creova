import { supabase } from "./supabase";

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
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
    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email.trim()
      );

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: true,
      message: "Password reset email sent.",
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
