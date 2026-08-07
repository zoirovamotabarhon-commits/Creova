import { supabase } from "./supabase";

export async function getData<T = unknown>(
  table: string
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as T[];
}

export async function getById<T = unknown>(
  table: string,
  id: string
): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as T | null;
}

export async function insertData<T = unknown>(
  table: string,
  values: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .insert(values)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as T;
}

export async function updateData<T = unknown>(
  table: string,
  id: string,
  values: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .update(values)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as T;
}

export async function deleteData(
  table: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
    }
