import test from "node:test";
import assert from "node:assert/strict";
import type { ChatMessage, ToolCall } from "../src/types.js";

test("typed chat messages make roles explicit", () => {
  const message: ChatMessage = { role: "user", content: "hello" };
  assert.equal(message.role, "user");
});

test("tool calls carry typed id, name, and argument map", () => {
  const call: ToolCall = {
    id: "call_1",
    name: "read_file",
    arguments: { file_path: "README.md" }
  };

  assert.equal(call.name, "read_file");
});
