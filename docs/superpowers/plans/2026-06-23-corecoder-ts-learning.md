# CoreCoder TS Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `corecoder-ts/` as a small TypeScript learning mirror of the Python CoreCoder project.

**Architecture:** The project mirrors the Python module names while making the hidden data shapes explicit through TypeScript types. Runtime code stays simple: config loads env vars, the Agent owns message history, LLM wraps OpenAI-compatible chat completions, tools implement a generic interface, and sessions persist JSON.

**Tech Stack:** TypeScript, Node.js ESM, Node built-in test runner, OpenAI-compatible HTTP fetch, strict `tsconfig`.

---

### Task 1: Project Skeleton And Core Types

**Files:**
- Create: `corecoder-ts/package.json`
- Create: `corecoder-ts/tsconfig.json`
- Create: `corecoder-ts/src/types.ts`
- Create: `corecoder-ts/src/index.ts`
- Create: `corecoder-ts/tests/types.test.ts`

- [ ] **Step 1: Write tests for public type-facing exports**

Create `corecoder-ts/tests/types.test.ts` with assertions that import the public package surface and create a typed message/tool-call shape.

- [ ] **Step 2: Add package and strict compiler config**

Create `package.json` scripts for `typecheck`, `build`, and `test`. Enable `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

- [ ] **Step 3: Add core message, tool-call, and JSON schema types**

Create discriminated unions for `ChatMessage`, `AssistantMessage`, `ToolMessage`, and explicit `ToolCall`/`LLMResponse` shapes.

- [ ] **Step 4: Run typecheck and the first test**

Run `npm run typecheck` and `npm test` from `corecoder-ts/`.

### Task 2: Tool System

**Files:**
- Create: `corecoder-ts/src/tools/base.ts`
- Create: `corecoder-ts/src/tools/read.ts`
- Create: `corecoder-ts/src/tools/write.ts`
- Create: `corecoder-ts/src/tools/edit.ts`
- Create: `corecoder-ts/src/tools/grep.ts`
- Create: `corecoder-ts/src/tools/glob.ts`
- Create: `corecoder-ts/src/tools/bash.ts`
- Create: `corecoder-ts/src/tools/agent.ts`
- Create: `corecoder-ts/src/tools/index.ts`
- Create: `corecoder-ts/tests/tools.test.ts`

- [ ] **Step 1: Write tests for tool lookup, schemas, and file tools**

Cover `getTool`, `ALL_TOOLS`, `read_file`, `write_file`, and `edit_file` with temporary files.

- [ ] **Step 2: Implement generic `Tool<TArgs>` and runtime argument helpers**

Use `unknown` for raw arguments and narrow them with small helper functions before executing.

- [ ] **Step 3: Implement mirrored built-in tools**

Keep each tool close to the Python behavior and return strings for readable tool results.

- [ ] **Step 4: Run tool tests and typecheck**

Run `npm test -- tests/tools.test.js` after build, then `npm run typecheck`.

### Task 3: Config, Context, Session, Prompt

**Files:**
- Create: `corecoder-ts/src/config.ts`
- Create: `corecoder-ts/src/context.ts`
- Create: `corecoder-ts/src/session.ts`
- Create: `corecoder-ts/src/prompt.ts`
- Create: `corecoder-ts/tests/core.test.ts`

- [ ] **Step 1: Write tests for config, context trimming, and sessions**

Test defaults, env overrides, token estimation, tool-output snipping, save/load/list sessions, and prompt schema inclusion.

- [ ] **Step 2: Implement config defaults and environment parsing**

Mirror the Python env names where practical: `CORECODER_MODEL`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `CORECODER_PROVIDER`, token settings.

- [ ] **Step 3: Implement context manager and session persistence**

Use approximate token counting and JSON session files under `~/.corecoder/sessions` by default, with test override support.

- [ ] **Step 4: Implement system prompt generation**

Generate a concise prompt that lists available tool schemas.

- [ ] **Step 5: Run core tests and typecheck**

Run `npm test -- tests/core.test.js` after build, then `npm run typecheck`.

### Task 4: LLM, Agent, CLI, Docs

**Files:**
- Create: `corecoder-ts/src/llm.ts`
- Create: `corecoder-ts/src/agent.ts`
- Create: `corecoder-ts/src/cli.ts`
- Create: `corecoder-ts/README.md`
- Create: `corecoder-ts/tests/agent.test.ts`

- [ ] **Step 1: Write tests for Agent tool execution with a fake LLM**

Use a fake LLM client that first requests a tool call and then returns final text.

- [ ] **Step 2: Implement LLM HTTP wrapper**

Use `fetch` against an OpenAI-compatible `/chat/completions` endpoint. Keep streaming optional and small.

- [ ] **Step 3: Implement Agent loop**

Mirror Python `Agent.chat`: append user message, call LLM, execute tool calls, append tool results, loop until final text.

- [ ] **Step 4: Implement minimal CLI**

Support `-p/--prompt`, `-m/--model`, `--api-key`, `--base-url`, `/help`, `/reset`, `/tokens`, `/save`, and `quit`.

- [ ] **Step 5: Add README with Python-to-TypeScript reading guide**

Explain the mirror-file reading method and the strict type features to notice.

- [ ] **Step 6: Run full verification**

Run `npm run build`, `npm test`, and `npm run typecheck` from `corecoder-ts/`.

## Self-Review

- Spec coverage: The plan creates the mirrored TypeScript project, strict type settings, minimal runnable behavior, tests, and README described in the design.
- Placeholder scan: No placeholder tasks are left; each task names files and verification commands.
- Type consistency: The shared names `ChatMessage`, `ToolCall`, `LLMResponse`, `Tool<TArgs>`, `Agent`, and `Config` are used consistently across tasks.
