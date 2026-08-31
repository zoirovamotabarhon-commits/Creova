export interface ToolExecutionContext {
  userId?: string;
  projectId?: string;
  [key: string]: any;
}

export abstract class Tool<TInput = any, TOutput = any> {
  abstract readonly name: string;
  abstract readonly description: string;

  /**
   * Validates input parameters before execution.
   */
  validate(input: TInput): boolean {
    return true;
  }

  /**
   * Main execution logic to be implemented by child tools.
   */
  abstract execute(
    input: TInput,
    context?: ToolExecutionContext
  ): Promise<TOutput>;
}
