import type { Tool } from "./tools/base.js";
import { schemaFor } from "./tools/base.js";

export function systemPrompt(tools: Tool[]): string {
  const toolList = tools.map((tool) => {
    const schema = schemaFor(tool).function;
    return `- ${schema.name}: ${schema.description}`;
  }).join("\n");

  return [
    "You are CoreCoder TS, a minimal learning coding agent.",
    "Use tools when needed, then explain the result clearly.",
    "",
    "Available tools:",
    toolList
  ].join("\n");
}
