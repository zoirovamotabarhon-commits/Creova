import { supabase } from "./supabase";

export async function getProfile(userId: string) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateProfile(
  userId: string,
  updates: Record<string, unknown>
) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
