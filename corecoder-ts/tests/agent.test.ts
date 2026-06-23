import test from "node:test";
import assert from "node:assert/strict";
import { Agent } from "../src/agent.js";
import type { LLMClient } from "../src/llm.js";
import type { ChatMessage, LLMResponse } from "../src/types.js";
import type { ToolSchema } from "../src/tools/base.js";

class FakeLLM implements LLMClient {
  model = "fake-model";
  totalPromptTokens = 0;
  totalCompletionTokens = 0;
  estimatedCost = undefined;
  calls = 0;

  async chat(_messages: ChatMessage[], _tools?: ToolSchema[]): Promise<LLMResponse> {
    this.calls += 1;
    if (this.calls === 1) {
      const toolCall = {
        id: "call_1",
        name: "echo",
        arguments: { text: "hello" }
      };
      return {
        content: "",
        toolCalls: [toolCall],
        promptTokens: 1,
        completionTokens: 1,
        message: { role: "assistant", content: null, toolCalls: [toolCall] }
      };
    }
    return {
      content: "done",
      toolCalls: [],
      promptTokens: 1,
      completionTokens: 1,
      message: { role: "assistant", content: "done" }
    };
  }
}

test("agent executes tool calls and then returns final text", async () => {
  const fake = new FakeLLM();
  const agent = new Agent(fake, [{
    name: "echo",
    description: "Echo text.",
    parameters: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"]
    },
    execute(args) {
      return `echo:${String(args.text)}`;
    }
  }]);

  const response = await agent.chat("say hello");
  assert.equal(response, "done");
  assert.equal(fake.calls, 2);
  assert.equal(agent.messages.some((message) => message.role === "tool" && message.content === "echo:hello"), true);
});
