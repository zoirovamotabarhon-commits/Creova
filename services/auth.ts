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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
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
  } catch {
    return {
      success: false,
      message: "Unexpected server error.",
    };
  }
}

export async function register(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
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
      message: "Registration successful.",
      data,
    };
  } catch {
    return {
      success: false,
      message: "Unexpected server error.",
    };
  }
}

export async function logout(): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signOut();

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
  } catch {
    return {
      success: false,
      message: "Unexpected server error.",
    };
  }
}

export async function resetPassword(
  email: string
): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

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
  } catch {
    return {
      success: false,
      message: "Unexpected server error.",
    };
  }
}

export async function getCurrentUser() {
  return await supabase.auth.getUser();
}

export async function getCurrentSession() {
  return await supabase.auth.getSession();
}
