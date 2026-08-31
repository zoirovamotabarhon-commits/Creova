import { useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface RealtimeFilePayload {
  id: string;
  project_id: string;
  path: string;
  content: string;
  updated_at: string;
}

interface UseSupabaseRealtimeOptions {
  projectId?: string;
  onFileUpdated?: (payload: RealtimeFilePayload) => void;
  onFileInserted?: (payload: RealtimeFilePayload) => void;
  onFileDeleted?: (payload: { id: string }) => void;
}

export function useSupabaseRealtime({
  projectId,
  onFileUpdated,
  onFileInserted,
  onFileDeleted,
}: UseSupabaseRealtimeOptions) {
  useEffect(() => {
    if (!projectId) return;

    // Supabase Realtime Channel creation
    const channel = supabase
      .channel(`project-files-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'project_files',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (onFileUpdated) {
            onFileUpdated(payload.new as RealtimeFilePayload);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_files',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (onFileInserted) {
            onFileInserted(payload.new as RealtimeFilePayload);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'project_files',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (onFileDeleted) {
            onFileDeleted(payload.old as { id: string });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, onFileUpdated, onFileInserted, onFileDeleted]);
}
