import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Dirent } from "node:fs";
import type { Tool } from "./base.js";
import { optionalStringArg, stringArg } from "./base.js";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "__pycache__"]);

export async function* walkFiles(root: string): AsyncGenerator<string> {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        yield* walkFiles(path);
      }
    } else if (entry.isFile()) {
      yield path;
    }
  }
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = escaped.replaceAll("\\*\\*", ".*").replaceAll("\\*", "[^/]*");
  return new RegExp(`^${regex}$`);
}

export const globTool: Tool = {
  name: "glob",
  description: "Find files matching a small glob pattern such as **/*.ts.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern." },
      path: { type: "string", description: "Directory to search. Defaults to current directory." }
    },
    required: ["pattern"]
  },
  async execute(args) {
    const pattern = stringArg(args, "pattern");
    const root = optionalStringArg(args, "path") ?? ".";
    const regex = patternToRegExp(pattern);
    const matches: string[] = [];

    for await (const file of walkFiles(root)) {
      const normalized = file.replaceAll("\\", "/");
      if (regex.test(normalized) || regex.test(normalized.replace(`${root}/`, ""))) {
        matches.push(file);
      }
    }

    return matches.length ? matches.slice(0, 200).join("\n") : "No files matched";
  }
};
