const DEFAULT_MODEL_PROVIDER_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL_PROVIDER_MODEL = "gpt-4.1-mini";

export const modelProviderEnvironmentKeys = [
  "MODEL_PROVIDER_API_KEY",
  "MODEL_PROVIDER_BASE_URL",
  "MODEL_PROVIDER_MODEL",
] as const;

type JsonSchema = Record<string, unknown>;

type ChatCompletionContentPart = {
  type?: string;
  text?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | ChatCompletionContentPart[];
      refusal?: string;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
  };
};

export class ModelProviderError extends Error {
  readonly status: number | null;
  readonly details: string | null;

  constructor(message: string, options: { status?: number | null; details?: string | null } = {}) {
    super(message);
    this.name = "ModelProviderError";
    this.status = options.status ?? null;
    this.details = options.details ?? null;
  }
}

export type GenerateStructuredOutputInput = {
  schemaName: string;
  schema: JsonSchema;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxCompletionTokens?: number;
  model?: string;
};

export type ModelProviderClient = {
  generateStructuredOutput<T>(input: GenerateStructuredOutputInput): Promise<T>;
};

export type ModelProviderClientOptions = {
  baseUrl?: string;
  model?: string;
  extraHeaders?: Record<string, string>;
};

export function createModelProviderClient(
  apiKey: string,
  options: ModelProviderClientOptions = {},
): ModelProviderClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_MODEL_PROVIDER_BASE_URL);
  const defaultModel = options.model ?? DEFAULT_MODEL_PROVIDER_MODEL;
  const extraHeaders = options.extraHeaders ?? {};

  return {
    async generateStructuredOutput<T>(input: GenerateStructuredOutputInput): Promise<T> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: input.model ?? defaultModel,
          temperature: input.temperature ?? 0.2,
          max_completion_tokens: input.maxCompletionTokens,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: input.schemaName,
              strict: true,
              schema: input.schema,
            },
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
      if (!response.ok) {
        throw new ModelProviderError(
          payload.error?.message ?? `Model provider request failed with status ${response.status}.`,
          {
            status: response.status,
            details: payload.error?.message ?? null,
          },
        );
      }

      const choice = payload.choices?.[0];
      const refusal = choice?.message?.refusal;
      if (refusal) {
        throw new ModelProviderError(`Model provider refused the request: ${refusal}`);
      }

      const content = readMessageContent(choice?.message?.content);
      if (!content) {
        throw new ModelProviderError("Model provider returned an empty structured response.");
      }

      try {
        return JSON.parse(content) as T;
      } catch (error) {
        throw new ModelProviderError("Model provider returned invalid JSON.", {
          details:
            error instanceof Error
              ? `${error.message}: ${content.slice(0, 240)}`
              : content.slice(0, 240),
        });
      }
    },
  };
}

function readMessageContent(content: string | ChatCompletionContentPart[] | undefined): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content.trim();
  }

  return content
    .map((part) => {
      if (part.type === "text") {
        return part.text ?? "";
      }

      return "";
    })
    .join("")
    .trim();
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
