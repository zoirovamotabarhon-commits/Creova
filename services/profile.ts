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

const PROFILE_COLUMNS =
  "id, name, email, avatar_url, created_at, updated_at";

async function getAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return {
      success: false as const,
      user: null,
      error: error.message,
    };
  }

  if (!user) {
    return {
      success: false as const,
      user: null,
      error:
        "User is not authenticated.",
    };
  }

  return {
    success: true as const,
    user,
    error: undefined,
  };
}

export async function getProfile(
  userId?: string
): Promise<ProfileResponse> {
  try {
    const authResult =
      await getAuthenticatedUser();

    if (
      !authResult.success
    ) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    const id =
      userId?.trim() ||
      authResult.user.id;

    if (id !== authResult.user.id) {
      return {
        success: false,
        error:
          "You can only access your own profile.",
      };
    }

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (data) {
      return {
        success: true,
        data: data as Profile,
      };
    }

    const createResult =
      await createProfile();

    if (
      !createResult.success
    ) {
      return {
        success: false,
        error:
          createResult.error ??
          "Profile does not exist.",
      };
    }

    return createResult;
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
      "name" |
        "email" |
        "avatar_url"
    >
  > = {}
): Promise<ProfileResponse> {
  try {
    const authResult =
      await getAuthenticatedUser();

    if (
      !authResult.success
    ) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    const user =
      authResult.user;

    const name =
      profile.name ??
      (
        typeof user
          .user_metadata?.name ===
        "string"
          ? user.user_metadata
              .name
          : null
      );

    const email =
      profile.email ??
      user.email ??
      null;

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          name,
          email,
          avatar_url:
            profile.avatar_url ??
            null,
        },
        {
          onConflict: "id",
        }
      )
      .select(
        PROFILE_COLUMNS
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
      "name" |
        "email" |
        "avatar_url"
    >
  >
): Promise<ProfileResponse> {
  try {
    const authResult =
      await getAuthenticatedUser();

    if (
      !authResult.success
    ) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    const user =
      authResult.user;

    const payload: Partial<
      Pick<
        Profile,
        "name" |
          "email" |
          "avatar_url"
      >
    > = {};

    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        "name"
      )
    ) {
      payload.name =
        updates.name?.trim() ||
        null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        "email"
      )
    ) {
      payload.email =
        updates.email?.trim() ||
        null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        "avatar_url"
      )
    ) {
      payload.avatar_url =
        updates.avatar_url
          ?.trim() || null;
    }

    if (
      Object.keys(payload)
        .length === 0
    ) {
      return getProfile(
        user.id
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          ...payload,
        },
        {
          onConflict: "id",
        }
      )
      .select(
        PROFILE_COLUMNS
      )
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Keep legacy Auth metadata synchronized
    // because some existing CREOVA screens
    // still read user_metadata.name.
    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "name"
      )
    ) {
      const {
        error:
          metadataError,
      } =
        await supabase.auth.updateUser(
          {
            data: {
              name:
                payload.name ??
                "",
            },
          }
        );

      if (
        metadataError
      ) {
        console.warn(
          "Profile saved, but Auth metadata could not be synchronized:",
          metadataError.message
        );
      }
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
    const authResult =
      await getAuthenticatedUser();

    if (
      !authResult.success
    ) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    const {
      error,
    } = await supabase
      .from("profiles")
      .delete()
      .eq(
        "id",
        authResult.user.id
      );

    if (error) {
      return {
        success: false,
        error: error.message,
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
