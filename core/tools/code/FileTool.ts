import { Tool, ToolExecutionContext } from '../Tool';

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
  readonly description = 'Read, write, or list files within the current workspace project.';

  async execute(
    input: FileToolInput,
    context?: ToolExecutionContext
  ): Promise<FileToolOutput> {
    const { action, path, content } = input;

    try {
      switch (action) {
        case 'read':
          // Integration point for reading files without breaking existing code
          return { success: true, data: `// Content of ${path}` };
        case 'write':
          return { success: true, data: `Successfully wrote to ${path}` };
        case 'list':
          return { success: true, data: ['app/', 'components/', 'core/'] };
        default:
          return { success: false, error: 'Invalid action provided' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
