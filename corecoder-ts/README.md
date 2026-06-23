# CoreCoder TS

This directory is a TypeScript learning mirror of the Python CoreCoder project.
It is intentionally small and file-for-file comparable with the Python version.

## How To Read It

Open the Python file and the TypeScript file side by side:

```text
corecoder/agent.py        -> corecoder-ts/src/agent.ts
corecoder/llm.py          -> corecoder-ts/src/llm.ts
corecoder/context.py      -> corecoder-ts/src/context.ts
corecoder/session.py      -> corecoder-ts/src/session.ts
corecoder/tools/base.py   -> corecoder-ts/src/tools/base.ts
```

The TypeScript version makes several shapes explicit:

- `ChatMessage` is a discriminated union.
- `ToolCall` has a typed `id`, `name`, and argument map.
- `Tool<TArgs>` shows how each tool owns its parameter type.
- Tool arguments start as `unknown`-like maps and are narrowed at runtime.
- The Agent loop mirrors Python: user message, LLM response, tool calls, tool results, repeat.

## Commands

```bash
npm install
npm run typecheck
npm test
npm run build
node dist/src/cli.js -p "read README.md"
```

Set `OPENAI_API_KEY` and optionally `OPENAI_BASE_URL` before calling a real model.

## Design Boundary

This is not a replacement for the Python package. It is an entry-level TypeScript
version for learning stricter types around an Agent runtime.
