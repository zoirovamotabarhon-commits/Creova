import { Tool, ToolExecutionContext } from '../Tool';
import { supabase } from '../../../services/supabase';

export interface FileToolInput {
  action: 'read' | 'write' | 'list';
  path: string;
  content?: string;
}

export interface FileToolOutput {
  success: boolean;
  data?: string | string[];
  error?: string;
}

export class FileTool extends Tool<FileToolInput, FileToolOutput> {
  readonly name = 'file_tool';
  readonly description = 'Reads, writes, or lists real project files stored in Supabase workspace.';

  async execute(
    input: FileToolInput,
    context?: ToolExecutionContext
  ): Promise<FileToolOutput> {
    const { action, path, content } = input;
    const projectId = context?.projectId;

    try {
      if (!projectId) {
        return { success: false, error: 'Project ID is required in ToolExecutionContext.' };
      }

      switch (action) {
        case 'read': {
          const { data, error } = await supabase
            .from('project_files')
            .select('content')
            .eq('project_id', projectId)
            .eq('path', path)
            .single();

          if (error) throw error;
          return { success: true, data: data?.content || '' };
        }

        case 'write': {
          if (content === undefined) {
            return { success: false, error: 'Content is required for write action.' };
          }

          const { error } = await supabase
            .from('project_files')
            .upsert({
              project_id: projectId,
              path,
              content,
              updated_at: new Date().toISOString(),
            });

          if (error) throw error;
          return { success: true, data: `Successfully saved ${path}` };
        }

        case 'list': {
          const { data, error } = await supabase
            .from('project_files')
            .select('path')
            .eq('project_id', projectId);

          if (error) throw error;
          const filePaths = data?.map((item) => item.path) || [];
          return { success: true, data: filePaths };
        }

        default:
          return { success: false, error: 'Invalid action provided.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
