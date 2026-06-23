import { ContextManager } from "./context.js";
import { systemPrompt } from "./prompt.js";
import type { ChatMessage, ToolHandler, TokenHandler } from "./types.js";
import type { LLMClient } from "./llm.js";
import type { Tool } from "./tools/base.js";
import { ALL_TOOLS, getTool, toolSchemas } from "./tools/index.js";

export class Agent {
  public messages: ChatMessage[] = [];
  public context: ContextManager;
  private system: string;

  constructor(
    public llm: LLMClient,
    public tools: Tool[] = ALL_TOOLS,
    maxContextTokens = 128_000,
    private maxRounds = 50
  ) {
    this.context = new ContextManager(maxContextTokens);
    this.system = systemPrompt(this.tools);
  }

  fullMessages(): ChatMessage[] {
    return [{ role: "system", content: this.system }, ...this.messages];
  }

  async chat(userInput: string, onToken?: TokenHandler, onTool?: ToolHandler): Promise<string> {
    this.messages.push({ role: "user", content: userInput });
    this.context.maybeCompress(this.messages);

    for (let round = 0; round < this.maxRounds; round += 1) {
      const response = await this.llm.chat(this.fullMessages(), toolSchemas(this.tools), onToken);

      if (response.toolCalls.length === 0) {
        this.messages.push(response.message);
        return response.content;
      }

      this.messages.push(response.message);
      const results = await Promise.all(response.toolCalls.map(async (call) => {
        onTool?.(call.name, call.arguments);
        const result = await this.execTool(call.name, call.arguments);
        return {
          role: "tool" as const,
          toolCallId: call.id,
          content: result
        };
      }));
      this.messages.push(...results);
      this.context.maybeCompress(this.messages);
    }

    return "(reached maximum tool-call rounds)";
  }

  reset(): void {
    this.messages = [];
  }

  private async execTool(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = getTool(name, this.tools);
    if (!tool) {
      return `Error: unknown tool '${name}'`;
    }
    try {
      return await tool.execute(args);
    } catch (error) {
      if (error instanceof Error) {
        return `Error executing ${name}: ${error.message}`;
      }
      return `Error executing ${name}`;
    }
  }
}
