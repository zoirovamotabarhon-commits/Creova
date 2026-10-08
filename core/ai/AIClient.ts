import type {
  AIMessage,
  AIOptions,
  AIResponse,
} from "./AIProvider";

import {
  invokeEdgeFunction,
} from "../../services/edgeFunctions";

import {
  createGeneration,
} from "../../services/generation";

export class AIClient {
  private static instance: AIClient;

  private constructor() {}

  public static getInstance(): AIClient {
    if (!AIClient.instance) {
      AIClient.instance =
        new AIClient();
    }

    return AIClient.instance;
  }

  public async chat(
    messages: AIMessage[],
    options: AIOptions = {},
  ): Promise<AIResponse> {
    const cleanMessages =
      messages.filter(
        (message) =>
          typeof message.content ===
            "string" &&
          message.content
            .trim()
            .length > 0,
      );

    if (
      cleanMessages.length === 0
    ) {
      throw new Error(
        "At least one AI message is required.",
      );
    }

    const generationType =
      options.generationType ??
      "chat";

    let generationId =
      options.generationId;

    /*
     * Create a generation only when
     * the caller did not provide one.
     */
    if (!generationId) {
      const lastUserMessage =
        [...cleanMessages]
          .reverse()
          .find(
            (message) =>
              message.role ===
              "user",
          );

      const prompt =
        lastUserMessage
          ?.content
          ?.trim();

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
        await invokeEdgeFunction<{
          success: boolean;

          text?: string;

          content?: string;

          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;

          model?: string;

          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };

          error?: string;
        }>(
          "gemini-chat",
          {
            body: {
              generationId,

              generationType,

              messages: cleanMessages,

              /*
               * Gemini 3.8 Flash:
               *
               * Do NOT send:
               * - temperature
               * - top_p
               *
               * max_tokens is translated by the
               * Edge Function into maxOutputTokens.
               */
              max_tokens:
                options.maxTokens ??
                4000,

              imageUrl:
                options.imageUrl,
            },
          },
        );

      if (error) {
        throw new Error(
          error.message,
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
        typeof data.text ===
          "string"
          ? data.text
          : typeof data.content ===
              "string"
            ? data.content
            : typeof data
                  .choices?.[0]
                  ?.message
                  ?.content ===
                "string"
              ? data
                  .choices[0]
                  .message
                  .content
              : "";

      if (
        !content.trim()
      ) {
        throw new Error(
          "AI returned an empty response.",
        );
      }

      const model =
        typeof data.model ===
          "string" &&
        data.model.trim()
          ? data.model
          : "gemini-3.8-flash";

      return {
        content:
          content.trim(),

        model,

        generationId,

        routedTo:
          "cloud",

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
