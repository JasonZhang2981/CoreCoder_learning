import type { JsonSchema } from "../types.js";

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
};

export interface Tool<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute(args: TArgs): Promise<string> | string;
}

export function schemaFor(tool: Tool): ToolSchema {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  };
}

export function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new TypeError(`${key} must be a string`);
  }
  return value;
}

export function optionalStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new TypeError(`${key} must be a string`);
  }
  return value;
}
