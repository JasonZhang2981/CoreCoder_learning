import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Tool } from "./base.js";
import { stringArg } from "./base.js";
import { trackChangedFile } from "./edit.js";

export const writeFileTool: Tool = {
  name: "write_file",
  description: "Write text content to a file, creating parent directories when needed.",
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Path to write." },
      content: { type: "string", description: "Text content to write." }
    },
    required: ["file_path", "content"]
  },
  async execute(args) {
    const filePath = stringArg(args, "file_path");
    const content = stringArg(args, "content");
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
    trackChangedFile(filePath);
    return `Wrote ${content.length} characters to ${filePath}`;
  }
};
