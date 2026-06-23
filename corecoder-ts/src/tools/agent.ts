import type { Tool } from "./base.js";
import { stringArg } from "./base.js";

export const agentTool: Tool = {
  name: "agent",
  description: "Placeholder sub-agent tool for learning. It mirrors Python's boundary without spawning a real agent.",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "Task for the sub-agent." }
    },
    required: ["prompt"]
  },
  execute(args) {
    const prompt = stringArg(args, "prompt");
    return `Sub-agent placeholder received: ${prompt}`;
  }
};
