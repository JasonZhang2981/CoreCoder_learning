import type { AssistantMessage, ChatMessage, LLMResponse, TokenHandler, ToolCall } from "./types.js";
import type { ToolSchema } from "./tools/base.js";

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

const PRICING: Record<string, [input: number, output: number]> = {
  "gpt-5.4": [2.5, 15],
  "gpt-5.4-mini": [0.75, 4.5],
  "gpt-4o": [2.5, 10],
  "gpt-4o-mini": [0.15, 0.6],
  "deepseek-chat": [0.27, 1.1],
  "kimi-k2.5": [0.6, 3],
  "qwen-max": [0.78, 3.9]
};

export type LLMOptions = {
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
};

export interface LLMClient {
  model: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedCost: number | undefined;
  chat(messages: ChatMessage[], tools?: ToolSchema[], onToken?: TokenHandler): Promise<LLMResponse>;
}

export class LLM implements LLMClient {
  public model: string;
  public totalPromptTokens = 0;
  public totalCompletionTokens = 0;
  private apiKey: string;
  private baseUrl: string;
  private temperature: number;
  private maxTokens: number;

  constructor(options: LLMOptions) {
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.temperature = options.temperature ?? 0;
    this.maxTokens = options.maxTokens ?? 4096;
  }

  get estimatedCost(): number | undefined {
    const pricing = PRICING[this.model];
    if (!pricing) {
      return undefined;
    }
    const [inputRate, outputRate] = pricing;
    return (
      this.totalPromptTokens * inputRate / 1_000_000
      + this.totalCompletionTokens * outputRate / 1_000_000
    );
  }

  async chat(messages: ChatMessage[], tools: ToolSchema[] = [], onToken?: TokenHandler): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(toOpenAIMessage),
      temperature: this.temperature,
      max_tokens: this.maxTokens
    };
    if (tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as ChatCompletionResponse;
    const choice = data.choices?.[0]?.message;
    const content = choice?.content ?? "";
    if (content && onToken) {
      onToken(content);
    }

    const toolCalls = parseToolCalls(choice?.tool_calls ?? []);
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    this.totalPromptTokens += promptTokens;
    this.totalCompletionTokens += completionTokens;
    const message = assistantMessage(content, toolCalls);

    return {
      content,
      toolCalls,
      promptTokens,
      completionTokens,
      message
    };
  }
}

function assistantMessage(content: string, toolCalls: ToolCall[]): AssistantMessage {
  if (toolCalls.length > 0) {
    return { role: "assistant", content: content || null, toolCalls };
  }
  return { role: "assistant", content };
}

function toOpenAIMessage(message: ChatMessage): OpenAIMessage {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content
    };
  }

  if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: "assistant",
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments)
        }
      }))
    };
  }

  return {
    role: message.role,
    content: message.content
  };
}

function parseToolCalls(rawCalls: NonNullable<ChatCompletionResponse["choices"]>[number]["message"] extends infer M
  ? M extends { tool_calls?: infer T } ? NonNullable<T> : never
  : never): ToolCall[] {
  return rawCalls.map((raw, index) => {
    const args = raw.function?.arguments;
    return {
      id: raw.id ?? `call_${index}`,
      name: raw.function?.name ?? "",
      arguments: parseArguments(args)
    };
  });
}

function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
