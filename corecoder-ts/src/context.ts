import type { ChatMessage } from "./types.js";

const CHARS_PER_TOKEN = 4;
const TOOL_SNIP_LIMIT = 4_000;

export function estimateTokens(messages: ChatMessage[]): number {
  const chars = JSON.stringify(messages).length;
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

export class ContextManager {
  constructor(public maxTokens = 128_000) {}

  maybeCompress(messages: ChatMessage[]): boolean {
    const before = estimateTokens(messages);
    if (before <= this.maxTokens) {
      return false;
    }

    this.snipToolOutputs(messages);

    if (estimateTokens(messages) <= this.maxTokens) {
      return true;
    }

    const keep = Math.max(4, Math.floor(messages.length / 2));
    const removed = messages.length - keep;
    const tail = messages.slice(-keep);
    messages.splice(0, messages.length, {
      role: "system",
      content: `[context compressed: ${removed} older messages omitted]`
    }, ...tail);
    return true;
  }

  snipToolOutputs(messages: ChatMessage[]): void {
    for (const message of messages) {
      if (message.role === "tool" && message.content.length > TOOL_SNIP_LIMIT) {
        const head = message.content.slice(0, 2_000);
        const tail = message.content.slice(-1_000);
        message.content = `${head}\n...[snipped ${message.content.length - 3_000} chars]...\n${tail}`;
      }
    }
  }
}
