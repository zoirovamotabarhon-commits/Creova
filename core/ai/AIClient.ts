import type {
  AIMessage,
  AIOptions,
  AIResponse,
} from "./AIProvider";

import { supabase } from "../../services/supabase";
import { createGeneration } from "../../services/generation";

export class AIClient {
  private static instance: AIClient;

  private constructor() {}

  public static getInstance(): AIClient {
    if (!AIClient.instance) {
      AIClient.instance = new AIClient();
    }

    return AIClient.instance;
  }

  /**
   * Calls the private OpenAI edge function.
   *
   * If the caller does not supply a generationId,
   * we create the server-side generation first.
   */
  public async chat(
    messages: AIMessage[],
    options: AIOptions = {},
  ): Promise<AIResponse> {
    const cleanMessages = messages.filter(
      (message) =>
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    );

    if (cleanMessages.length === 0) {
      throw new Error(
        "At least one AI message is required.",
      );
    }

    const generationType =
      options.generationType ?? "chat";

    let generationId =
      options.generationId;

    if (!generationId) {
      const lastUserMessage =
        [...cleanMessages]
          .reverse()
          .find(
            (message) =>
              message.role === "user",
          );

      const prompt =
        lastUserMessage?.content?.trim();

      if (!prompt) {
        throw new Error(
          "A user message is required to create a generation.",
        );
      }

      const generation =
        await createGeneration(
          generationType,
          undefined,
          prompt,
          {
            feature:
              generationType,
          },
        );

      if (
        !generation.success ||
        !generation.generationId
      ) {
        throw new Error(
          generation.error ??
            "Unable to create AI generation.",
        );
      }

      generationId =
        generation.generationId;
    }

    try {
      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          "openai-chat",
          {
            body: {
              generationId,
              messages:
                cleanMessages,
              temperature:
                options.temperature ??
                0.7,
              max_tokens:
                options.maxTokens ??
                2000,
              top_p:
                options.topP,
            },
          },
        );

      if (error) {
        throw new Error(
          `AI request failed: ${error.message}`,
        );
      }

      if (
        !data ||
        data.success !== true
      ) {
        throw new Error(
          data?.error ??
            "AI request failed.",
        );
      }

      const content =
        typeof data.text === "string"
          ? data.text
          : typeof data.content ===
              "string"
            ? data.content
            : typeof data.choices?.[0]
                  ?.message?.content ===
                "string"
              ? data.choices[0]
                  .message.content
              : "";

      if (!content.trim()) {
        throw new Error(
          "AI returned an empty response.",
        );
      }

      const model =
        typeof data.model ===
          "string" &&
        data.model.trim()
          ? data.model
          : "unknown";

      return {
        content:
          content.trim(),
        model,
        generationId,
        usage:
          data.usage &&
          typeof data.usage ===
            "object"
            ? {
                promptTokens:
                  Number(
                    data.usage
                      .prompt_tokens ??
                      0,
                  ),
                completionTokens:
                  Number(
                    data.usage
                      .completion_tokens ??
                      0,
                  ),
                totalTokens:
                  Number(
                    data.usage
                      .total_tokens ??
                      0,
                  ),
              }
            : undefined,
      };
    } catch (error) {
      console.error(
        "AIClient Error:",
        error,
      );

      throw error;
    }
  }
              }
