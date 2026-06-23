# CoreCoder TS Learning Design

## Goal

Create `corecoder-ts/` as a TypeScript learning companion to the existing Python CoreCoder implementation. The TypeScript version should mirror the Python structure closely so a beginner can compare files side by side and see how stricter types make the Agent runtime easier to reason about.

This is a learning project, not a product rewrite. Keep the code small, readable, and directly tied to the Python version.

## Scope

The first version should include a minimal runnable TypeScript project with these modules:

```text
corecoder-ts/
├── src/
│   ├── index.ts
│   ├── cli.ts
│   ├── agent.ts
│   ├── llm.ts
│   ├── context.ts
│   ├── session.ts
│   ├── prompt.ts
│   ├── config.ts
│   ├── types.ts
│   └── tools/
│       ├── index.ts
│       ├── base.ts
│       ├── read.ts
│       ├── write.ts
│       ├── edit.ts
│       ├── grep.ts
│       ├── glob.ts
│       ├── bash.ts
│       └── agent.ts
├── tests/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

Each TypeScript file should map to the closest Python file, even when a more abstract TypeScript design would be possible. The point is readable comparison.

## TypeScript Learning Focus

Use strict TypeScript settings:

- `strict`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`

The implementation should highlight:

- Union types for chat messages.
- Generic tool interfaces such as `Tool<TArgs>`.
- `unknown` for untrusted tool arguments before validation.
- Explicit LLM response and tool-call shapes.
- Small helper functions for runtime narrowing.

Avoid heavy abstractions, decorators, dependency injection containers, or framework-specific patterns.

## Behavior

The TypeScript version should support the same core learning flow as Python:

1. Load config from environment variables.
2. Create an LLM client.
3. Build an Agent with tools.
4. Accept a one-shot prompt or interactive input.
5. Send messages to an OpenAI-compatible chat API.
6. Execute requested tools.
7. Append tool results to message history.
8. Save and load simple sessions.

The CLI can be simpler than the Python version, but it should be runnable enough for experimentation.

## Testing

Add focused tests for:

- Public exports.
- Config defaults and environment overrides.
- Token estimation and context trimming.
- Tool lookup and tool schemas.
- Read, write, and edit tools using temporary files.
- Session save and load using a temporary directory when practical.

Tests should teach the module boundaries rather than chase full production coverage.

## Out Of Scope

- Full npm package publishing.
- Plugin, MCP, hook, or skill systems.
- Complex streaming UI polish.
- A web interface.
- Feature expansion beyond the current Python CoreCoder core.
- Rewriting or replacing the Python implementation.

## Success Criteria

- A learner can open `corecoder/agent.py` and `corecoder-ts/src/agent.ts` side by side and understand the same runtime loop.
- The TypeScript project passes type checking and tests.
- The type definitions make message, tool, and LLM boundaries more explicit than the Python version.
- The total implementation stays small enough to read in one sitting.
