import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "./base.js";
import { stringArg } from "./base.js";

const execAsync = promisify(exec);
const BLOCKED = ["rm -rf /", "sudo ", "mkfs", ":(){", "dd if="];

export const bashTool: Tool = {
  name: "bash",
  description: "Run a shell command and return stdout and stderr.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Command to run." }
    },
    required: ["command"]
  },
  async execute(args) {
    const command = stringArg(args, "command");
    if (BLOCKED.some((bad) => command.includes(bad))) {
      return `Error: blocked dangerous command: ${command}`;
    }
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30_000, maxBuffer: 1024 * 1024 });
      return [stdout, stderr].filter(Boolean).join("\n") || "(no output)";
    } catch (error) {
      if (error instanceof Error) {
        return `Error: ${error.message}`;
      }
      return "Error: command failed";
    }
  }
};
