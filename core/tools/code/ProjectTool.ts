import { Tool, ToolExecutionContext } from '../Tool';
import { supabase } from '../../../services/supabase';

export interface ProjectToolInput {
  action: 'get_structure' | 'get_metadata';
}

export interface ProjectToolOutput {
  success: boolean;
  data?: any;
  error?: string;
}

export class ProjectTool extends Tool<ProjectToolInput, ProjectToolOutput> {
  readonly name = 'project_tool';
  readonly description = 'Fetches workspace environment, file hierarchy, and general configuration.';

  async execute(
    input: ProjectToolInput,
    context?: ToolExecutionContext
  ): Promise<ProjectToolOutput> {
    const { action } = input;
    const projectId = context?.projectId;

    try {
      if (!projectId) {
        return { success: false, error: 'Project ID context is missing.' };
      }

      if (action === 'get_structure') {
        const { data, error } = await supabase
          .from('project_files')
          .select('path, created_at, updated_at')
          .eq('project_id', projectId);

        if (error) throw error;
        return { success: true, data };
      }

      if (action === 'get_metadata') {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (error) throw error;
        return { success: true, data };
      }

      return { success: false, error: 'Unsupported action.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
