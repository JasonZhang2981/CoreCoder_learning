export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type JsonSchema = {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: JsonValue[];
};

export type Role = "system" | "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type SystemMessage = {
  role: "system";
  content: string;
};

export type UserMessage = {
  role: "user";
  content: string;
};

export type AssistantMessage = {
  role: "assistant";
  content: string | null;
  toolCalls?: ToolCall[];
};

export type ToolMessage = {
  role: "tool";
  toolCallId: string;
  content: string;
};

export type ChatMessage = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

export type LLMResponse = {
  content: string;
  toolCalls: ToolCall[];
  promptTokens: number;
  completionTokens: number;
  message: AssistantMessage;
};

export type TokenHandler = (token: string) => void;
export type ToolHandler = (name: string, args: Record<string, unknown>) => void;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  return value;
}

export function asOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return asString(value, name);
}

export function asNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new TypeError(`${name} must be a number`);
  }
  return value;
}
