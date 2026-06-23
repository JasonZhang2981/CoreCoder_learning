import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Tool } from "./base.js";
import { optionalStringArg, stringArg } from "./base.js";
import { walkFiles } from "./glob.js";

export const grepTool: Tool = {
  name: "grep",
  description: "Search files under a directory for a regular expression.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regular expression to search for." },
      path: { type: "string", description: "Directory to search. Defaults to current directory." }
    },
    required: ["pattern"]
  },
  async execute(args) {
    const pattern = stringArg(args, "pattern");
    const root = optionalStringArg(args, "path") ?? ".";
    const regex = new RegExp(pattern);
    const matches: string[] = [];

    for await (const file of walkFiles(root)) {
      const content = await readFile(file, "utf8").catch(() => "");
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (regex.test(line)) {
          matches.push(`${join(file)}:${index + 1}:${line}`);
        }
      });
    }

    return matches.length ? matches.slice(0, 200).join("\n") : "No matches";
  }
};
