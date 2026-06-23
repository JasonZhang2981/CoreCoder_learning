import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Config } from "../src/config.js";
import { ContextManager, estimateTokens } from "../src/context.js";
import { loadSession, listSessions, saveSession, setSessionDirForTests } from "../src/session.js";
import { systemPrompt } from "../src/prompt.js";
import { ALL_TOOLS } from "../src/tools/index.js";
import type { ChatMessage } from "../src/types.js";

test("config defaults and environment overrides", () => {
  const defaults = Config.fromEnv({});
  assert.equal(defaults.model, "gpt-4o");
  assert.equal(defaults.maxTokens, 4096);

  const overridden = Config.fromEnv({
    CORECODER_MODEL: "test-model",
    OPENAI_API_KEY: "sk-test",
    OPENAI_BASE_URL: "https://example.test/v1",
    CORECODER_MAX_TOKENS: "123"
  });
  assert.equal(overridden.model, "test-model");
  assert.equal(overridden.apiKey, "sk-test");
  assert.equal(overridden.baseUrl, "https://example.test/v1");
  assert.equal(overridden.maxTokens, 123);
});

test("context manager estimates and compresses oversized tool output", () => {
  const messages: ChatMessage[] = [
    { role: "tool", toolCallId: "t1", content: "x\n".repeat(5_000) }
  ];
  const before = estimateTokens(messages);
  const ctx = new ContextManager(500);
  const compressed = ctx.maybeCompress(messages);
  const after = estimateTokens(messages);

  assert.equal(compressed, true);
  assert.ok(after < before);
});

test("sessions save, load, sanitize, and list records", async () => {
  const dir = await mkdtemp(join(tmpdir(), "corecoder-ts-sessions-"));
  setSessionDirForTests(dir);
  try {
    const messages: ChatMessage[] = [{ role: "user", content: "test message" }];
    const id = await saveSession(messages, "test-model", "../Research Notes!");
    assert.equal(id, "Research-Notes");

    const loaded = await loadSession("../Research Notes!");
    assert.ok(loaded);
    assert.deepEqual(loaded[0], messages);
    assert.equal(loaded[1], "test-model");

    const sessions = await listSessions();
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.preview, "test message");
  } finally {
    setSessionDirForTests(undefined);
    await rm(dir, { recursive: true, force: true });
  }
});

test("system prompt lists available tools", () => {
  const prompt = systemPrompt(ALL_TOOLS);
  assert.match(prompt, /read_file/);
  assert.match(prompt, /edit_file/);
});
