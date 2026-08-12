import { supabase } from "./supabase";

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileResponse {
  success: boolean;
  data?: Profile | null;
  error?: string;
}

export async function getProfile(
  userId?: string
): Promise<ProfileResponse> {
  try {
    let id = userId?.trim();

    if (!id) {
      const {
        data: {
          user,
        },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      if (!user) {
        return {
          success: false,
          error: "User is not authenticated.",
        };
      }

      id = user.id;
    }

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select(
        "id, name, email, avatar_url, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as Profile | null,
    };
  } catch (error) {
    console.error(
      "getProfile error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get profile.",
    };
  }
}

export async function createProfile(
  profile: Partial<
    Pick<
      Profile,
      "name" | "email" | "avatar_url"
    >
  >
): Promise<ProfileResponse> {
  try {
    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        success: false,
        error: userError.message,
      };
    }

    if (!user) {
      return {
        success: false,
        error: "User is not authenticated.",
      };
    }

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          name:
            profile.name ??
            user.user_metadata?.name ??
            null,
          email:
            profile.email ??
            user.email ??
            null,
          avatar_url:
            profile.avatar_url ??
            null,
        },
        {
          onConflict: "id",
        }
      )
      .select(
        "id, name, email, avatar_url, created_at, updated_at"
      )
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as Profile,
    };
  } catch (error) {
    console.error(
      "createProfile error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create profile.",
    };
  }
}

export async function updateProfile(
  updates: Partial<
    Pick<
      Profile,
      "name" | "email" | "avatar_url"
    >
  >
): Promise<ProfileResponse> {
  try {
    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        success: false,
        error: userError.message,
      };
    }

    if (!user) {
      return {
        success: false,
        error: "User is not authenticated.",
      };
    }

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          ...updates,
        },
        {
          onConflict: "id",
        }
      )
      .select(
        "id, name, email, avatar_url, created_at, updated_at"
      )
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as Profile,
    };
  } catch (error) {
    console.error(
      "updateProfile error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update profile.",
    };
  }
}

export async function deleteProfile(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const {
      data: {
        user,
      },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (!user) {
      return {
        success: false,
        error: "User is not authenticated.",
      };
    }

    const {
      error: deleteError,
    } = await supabase
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (deleteError) {
      return {
        success: false,
        error: deleteError.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "deleteProfile error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete profile.",
    };
  }
        }
