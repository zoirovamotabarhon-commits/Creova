import { supabase } from "./supabase";

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    name:
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : undefined,
  };
}
