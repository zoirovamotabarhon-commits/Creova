import { supabase } from './supabase';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export async function getOrCreateDefaultProject(
  userId: string,
): Promise<Project> {
  const { data: existing, error: findError } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    return existing as Project;
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: 'My Project',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as Project;
        }
