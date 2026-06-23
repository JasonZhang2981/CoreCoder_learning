import { readFile } from "node:fs/promises";
import type { Tool } from "./base.js";
import { stringArg } from "./base.js";

export const readFileTool: Tool = {
  name: "read_file",
  description: "Read a text file and return its contents.",
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Path to the file to read." }
    },
    required: ["file_path"]
  },
  async execute(args) {
    const filePath = stringArg(args, "file_path");
    return await readFile(filePath, "utf8");
  }
};
