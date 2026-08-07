export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function request<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, options);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as T;

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    };
  }
}
