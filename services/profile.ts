import { supabase } from "./supabase";

export interface Profile {
  id: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export async function getProfile(
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  values: Partial<Omit<Profile, "id">>
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      ...values,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Profile;
}
