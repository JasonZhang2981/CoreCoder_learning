import { readFile, writeFile } from "node:fs/promises";
import type { Tool } from "./base.js";
import { stringArg } from "./base.js";

export const changedFiles = new Set<string>();

export function trackChangedFile(filePath: string): void {
  changedFiles.add(filePath);
}

export const editFileTool: Tool = {
  name: "edit_file",
  description: "Replace one exact string in a file. The old string must appear exactly once.",
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Path to edit." },
      old_string: { type: "string", description: "Exact text to replace." },
      new_string: { type: "string", description: "Replacement text." }
    },
    required: ["file_path", "old_string", "new_string"]
  },
  async execute(args) {
    const filePath = stringArg(args, "file_path");
    const oldString = stringArg(args, "old_string");
    const newString = stringArg(args, "new_string");
    const content = await readFile(filePath, "utf8");
    const first = content.indexOf(oldString);
    if (first === -1) {
      return `Error: old_string not found in ${filePath}`;
    }
    if (content.indexOf(oldString, first + oldString.length) !== -1) {
      return `Error: old_string appears multiple times in ${filePath}`;
    }
    await writeFile(filePath, content.replace(oldString, newString), "utf8");
    trackChangedFile(filePath);
    return `Edited ${filePath}`;
  }
};
