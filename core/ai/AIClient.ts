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
  private static instance:
    AIClient;


  private constructor() {}


  public static getInstance(): AIClient {
    if (
      !AIClient.instance
    ) {
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
        (
          message,
        ) =>
          typeof message.content ===
            "string" &&
          message.content
            .trim()
            .length > 0,
      );

    if (
      cleanMessages.length ===
      0
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

    if (
      !generationId
    ) {
      const lastUserMessage =
        [
          ...cleanMessages,
        ]
          .reverse()
          .find(
            (
              message,
            ) =>
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

            conversationId:
              options.conversationId ??
              null,
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

    const {
      data,
      error,
    } =
      await invokeEdgeFunction<{
        success: boolean;

        text?: string;

        content?: string;

        model?: string;

        error?: string;

        conversationId?: string;

        usage?: {
          prompt_tokens?: number;

          completion_tokens?: number;

          total_tokens?: number;
        };

        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      }>(
        "gemini-chat",
        {
          body: {
            generationId,

            generationType,

            messages:
              cleanMessages,

            max_tokens:
              options.maxTokens ??
              4000,

            imageUrl:
              options.imageUrl,

            conversationId:
              options.conversationId,
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
      data.success !==
        true
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

    return {
      content:
        content.trim(),

      model:
        data.model ??
        "gemini-3.8-flash",

      generationId,

      routedTo:
        "cloud",

      usage:
        data.usage
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
  }
  }
