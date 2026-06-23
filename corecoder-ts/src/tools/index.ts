import type { Tool } from "./base.js";
import { schemaFor } from "./base.js";
import { agentTool } from "./agent.js";
import { bashTool } from "./bash.js";
import { editFileTool } from "./edit.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { readFileTool } from "./read.js";
import { writeFileTool } from "./write.js";

export { changedFiles } from "./edit.js";
export type { Tool, ToolSchema } from "./base.js";
export { schemaFor } from "./base.js";

export const ALL_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  globTool,
  grepTool,
  bashTool,
  agentTool
];

export function getTool(name: string, tools: Tool[] = ALL_TOOLS): Tool | undefined {
  return tools.find((tool) => tool.name === name);
}

export function toolSchemas(tools: Tool[] = ALL_TOOLS) {
  return tools.map(schemaFor);
}
