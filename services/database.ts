import { supabase } from "./supabase";

export interface DatabaseResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getCurrentUser() {
  const {
    data: {
      user,
    },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }

  if (!user) {
    return {
      success: false,
      data: null,
      error: "User is not authenticated.",
    };
  }

  return {
    success: true,
    data: user,
  };
}

export async function selectRows<T = unknown>(
  table: string,
  columns = "*"
): Promise<DatabaseResponse<T[]>> {
  try {
    if (!table.trim()) {
      return {
        success: false,
        error: "Table name is required.",
      };
    }

    const {
      data,
      error,
    } = await supabase
      .from(table)
      .select(columns);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: (data ?? []) as T[],
    };
  } catch (error) {
    console.error(
      "selectRows error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Database request failed.",
    };
  }
}

export async function selectUserProfile<T = unknown>(
  userId?: string
): Promise<DatabaseResponse<T | null>> {
  try {
    let id = userId?.trim();

    if (!id) {
      const userResult =
        await getCurrentUser();

      if (
        !userResult.success ||
        !userResult.data
      ) {
        return {
          success: false,
          error:
            userResult.error ??
            "User is not authenticated.",
        };
      }

      id =
        userResult.data.id;
    }

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select("*")
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
      data: data as T | null,
    };
  } catch (error) {
    console.error(
      "selectUserProfile error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load user profile.",
    };
  }
}

export async function upsertUserProfile<T = unknown>(
  values: Record<
    string,
    unknown
  >
): Promise<DatabaseResponse<T>> {
  try {
    const userResult =
      await getCurrentUser();

    if (
      !userResult.success ||
      !userResult.data
    ) {
      return {
        success: false,
        error:
          userResult.error ??
          "User is not authenticated.",
      };
    }

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .upsert(
        {
          ...values,
          id:
            userResult.data.id,
        },
        {
          onConflict: "id",
        }
      )
      .select("*")
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (error) {
    console.error(
      "upsertUserProfile error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save user profile.",
    };
  }
}
