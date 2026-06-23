# CoreCoder 项目 TypeScript 基础补全：读 TS 版本源码时会遇到的语法和写法

这份文档写给“能看懂一点 JavaScript，或者已经看过 Python 版 CoreCoder，但读 TypeScript 版时会被语法卡住”的学习者。

它不是 TypeScript 入门大全，也不是前端教程。它只围绕一个目标：让你能顺利读懂 [corecoder-ts/src](../corecoder-ts/src/) 里的代码。

建议你把它当作查词典用：

- 看到 `type`、`interface` 不懂，查第 4、5 节。
- 看到 `string | undefined`、`as const` 不懂，查第 6、7 节。
- 看到 `async`、`await`、`Promise<string>` 不懂，查第 10 节。
- 看到 `Record<string, unknown>`、泛型 `<TArgs extends ...>` 不懂，查第 8、9 节。
- 看到 `import type`、文件结尾的 `.js` 不懂，查第 2 节。
- 看到 `public`、`private`、构造函数参数前的 `public llm` 不懂，查第 12 节。
- 看到 `?.`、`??`、`...` 不懂，查第 15 节。
- 看到 `node:fs/promises`、`node:readline/promises` 不懂，查第 18 节。

相关配套文档：

- [CoreCoder 速成学习路线](corecoder-learning-roadmap.md)
- [CoreCoder 新手源码讲解](corecoder-code-walkthrough-for-beginners.md)
- [CoreCoder 项目 Python 基础补全](corecoder-python-basics.md)

## 0. 先知道：这份文档覆盖哪些项目文件

本文主要覆盖 TypeScript 版本里的这些文件：

- [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts)：命令行入口、`async main()`、REPL、参数解析、Node 内置模块。
- [corecoder-ts/src/config.ts](../corecoder-ts/src/config.ts)：类、构造函数默认值、静态方法、环境变量。
- [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts)：Agent 主循环、类字段、回调函数、`Promise.all`、工具调用。
- [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts)：接口、类型别名、HTTP 请求、JSON、类型断言、可选字段。
- [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts)：联合类型、字面量类型、类型守卫、`unknown` 参数校验。
- [corecoder-ts/src/context.ts](../corecoder-ts/src/context.ts)：数组、字符串、压缩逻辑、就地修改。
- [corecoder-ts/src/tools/base.ts](../corecoder-ts/src/tools/base.ts)：泛型接口、工具 schema、参数检查。
- [corecoder-ts/src/tools/*.ts](../corecoder-ts/src/tools/)：对象形式的工具、文件读写、子进程、路径搜索。
- [corecoder-ts/tests/](../corecoder-ts/tests/)：Node 自带测试、断言、临时文件、mock。

## 1. TypeScript 和 JavaScript 的关系

### 1.1 TypeScript 是带类型的 JavaScript

TypeScript 可以理解为：

```text
JavaScript + 类型标注 + 编译检查
```

例如 JavaScript 可以写：

```js
function add(a, b) {
  return a + b;
}
```

TypeScript 可以写：

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

区别是：

- `a: number` 表示参数 `a` 必须是数字。
- `b: number` 表示参数 `b` 必须是数字。
- `): number` 表示返回值必须是数字。

这些类型主要给开发阶段使用。TypeScript 最后会编译成 JavaScript，真正运行的是编译后的 `.js` 文件。

### 1.2 项目里的源码和编译产物

TypeScript 源码在：

```text
corecoder-ts/src/*.ts
```

编译后的 JavaScript 在：

```text
corecoder-ts/dist/src/*.js
```

声明文件在：

```text
corecoder-ts/dist/src/*.d.ts
```

读项目逻辑时优先看 `src/*.ts`。`dist/` 是编译输出，一般不用先读。

### 1.3 `.ts`、`.js`、`.d.ts` 分别是什么

```text
.ts    TypeScript 源码，给人读和给编译器检查。
.js    JavaScript 运行文件，给 Node.js 执行。
.d.ts  类型声明文件，告诉别的代码这个模块导出了哪些类型和函数。
```

这个项目是教学项目，所以源码很短。你主要看 `.ts` 就够了。

## 2. 模块、导入、导出：代码为什么能互相找到

### 2.1 一个 `.ts` 文件就是一个模块

例如：

```text
corecoder-ts/src/agent.ts
corecoder-ts/src/llm.ts
corecoder-ts/src/config.ts
```

分别是三个模块。模块之间通过 `import` 和 `export` 连接。

### 2.2 导入普通值

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
import { ContextManager } from "./context.js";
import { systemPrompt } from "./prompt.js";
```

意思是从其他模块导入运行时真正会用到的值：

- `ContextManager` 是类，运行时要创建对象。
- `systemPrompt` 是函数，运行时要调用。

注意路径写的是 `./context.js`，不是 `./context.ts`。这是 Node ESM 项目的常见写法：TypeScript 源码里写最终运行时的 `.js` 路径，编译后刚好能被 Node 找到。

### 2.3 只导入类型：`import type`

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
import type { ChatMessage, ToolHandler, TokenHandler } from "./types.js";
import type { LLMClient } from "./llm.js";
import type { Tool } from "./tools/base.js";
```

`import type` 表示“这些名字只用于类型检查，编译成 JavaScript 后不需要真的导入”。

比如：

```ts
public messages: ChatMessage[] = [];
```

`ChatMessage` 只是告诉 TypeScript：`messages` 这个数组里应该放聊天消息。运行时并不存在一个叫 `ChatMessage` 的对象。

### 2.4 导出值：`export`

在 [corecoder-ts/src/config.ts](../corecoder-ts/src/config.ts) 里：

```ts
export class Config {
  ...
}
```

这表示其他文件可以导入：

```ts
import { Config } from "./config.js";
```

在 [corecoder-ts/src/tools/edit.ts](../corecoder-ts/src/tools/edit.ts) 里：

```ts
export const changedFiles = new Set<string>();
export const editFileTool: Tool = {
  ...
};
```

`export const` 导出常量，其他模块可以复用同一个对象。

### 2.5 默认导出和命名导出

这个项目基本使用“命名导出”：

```ts
export class Agent { ... }
export function estimateTokens(...) { ... }
export const readFileTool = { ... };
```

导入时必须写花括号：

```ts
import { Agent } from "./agent.js";
```

如果是默认导出，通常会是：

```ts
export default Agent;
```

导入时不需要花括号：

```ts
import Agent from "./agent.js";
```

CoreCoder TS 里主要不用默认导出，这样每个模块导出了什么更清楚。

## 3. 变量声明：`const`、`let`、不用 `var`

### 3.1 `const`：绑定不再改

在 [corecoder-ts/src/context.ts](../corecoder-ts/src/context.ts) 里：

```ts
const CHARS_PER_TOKEN = 4;
const TOOL_SNIP_LIMIT = 4_000;
```

`const` 表示这个变量名不会重新指向别的值。

注意：如果 `const` 指向的是对象或数组，对象内部仍然可以改。

```ts
const messages: string[] = [];
messages.push("hello"); // 可以
// messages = [];       // 不可以
```

### 3.2 `let`：后面还会改

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 里：

```ts
for (let i = 0; i < argv.length; i += 1) {
  ...
}
```

`i` 每轮循环都会变化，所以用 `let`。

### 3.3 为什么不用 `var`

现代 TypeScript 基本不用 `var`，因为 `var` 的作用域规则容易造成误解。你读这个项目时记住：

- 默认用 `const`。
- 确实需要重新赋值时用 `let`。
- 基本不用 `var`。

## 4. 基础类型标注：冒号后面是什么

### 4.1 参数类型

在 [corecoder-ts/src/config.ts](../corecoder-ts/src/config.ts) 里：

```ts
function parseNumber(value: string | undefined, fallback: number): number {
  ...
}
```

这里有三个类型信息：

- `value: string | undefined`：`value` 可以是字符串，也可以是 `undefined`。
- `fallback: number`：`fallback` 必须是数字。
- `): number`：函数返回数字。

### 4.2 变量类型

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
public messages: ChatMessage[] = [];
```

意思是：

```text
messages 是一个数组，数组里的每个元素都必须符合 ChatMessage 类型。
```

`ChatMessage[]` 等价于：

```ts
Array<ChatMessage>
```

项目里两种写法都能遇到：

```ts
ChatMessage[]
Array<{ id: string; type: "function"; ... }>
```

### 4.3 返回值类型

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
reset(): void {
  this.messages = [];
}
```

`void` 表示这个函数不返回有意义的值。

在同一个文件里：

```ts
async chat(...): Promise<string> {
  ...
}
```

`Promise<string>` 表示这是一个异步函数，最终会得到一个字符串。

### 4.4 TypeScript 会自动推断类型

不是每个变量都需要手写类型：

```ts
const first = content.indexOf(oldString);
```

TypeScript 能根据 `indexOf()` 推断出 `first` 是 `number`。

一般规律：

- 函数参数和对外导出的 API 常写类型。
- 局部变量能推断就不用写。
- 复杂对象或公共结构用 `type` / `interface` 定义。

## 5. `type` 类型别名：给复杂类型起名字

### 5.1 最简单的 `type`

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
export type JsonPrimitive = string | number | boolean | null;
```

意思是：

```text
JsonPrimitive 可以是 string、number、boolean 或 null。
```

`type` 不会生成运行时代码，只是给类型系统看的。

### 5.2 对象类型

```ts
export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};
```

意思是 `ToolCall` 对象必须有三个字段：

- `id`：字符串。
- `name`：字符串。
- `arguments`：一个字符串键的对象，值暂时不知道类型。

一个合法的 `ToolCall` 类似：

```ts
const call: ToolCall = {
  id: "call_1",
  name: "read_file",
  arguments: { file_path: "README.md" }
};
```

### 5.3 可选字段：`?`

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
export type AssistantMessage = {
  role: "assistant";
  content: string | null;
  toolCalls?: ToolCall[];
};
```

`toolCalls?` 表示这个字段可以不存在。

所以这两个对象都合法：

```ts
const a: AssistantMessage = {
  role: "assistant",
  content: "hello"
};

const b: AssistantMessage = {
  role: "assistant",
  content: null,
  toolCalls: []
};
```

`?` 可以理解为：

```text
这个字段的类型是 ToolCall[] | undefined，并且对象里可以没有这个字段。
```

### 5.4 递归类型

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
```

这是递归类型：`JsonValue` 的定义里又出现了 `JsonValue`。

它表达 JSON 的结构：

- 可以是基本值：字符串、数字、布尔、null。
- 可以是数组，数组里还是 JSON 值。
- 可以是对象，对象的值还是 JSON 值。

例如：

```ts
const data: JsonValue = {
  name: "CoreCoder",
  enabled: true,
  tools: ["read", "edit"],
  config: {
    maxRounds: 50
  }
};
```

## 6. 联合类型、字面量类型、判别联合

### 6.1 联合类型：`A | B`

`string | undefined` 表示“字符串或 undefined”：

```ts
function parseNumber(value: string | undefined, fallback: number): number {
  ...
}
```

`string | null` 表示“字符串或 null”：

```ts
content: string | null;
```

联合类型的重点是：使用之前经常要先判断。

```ts
if (value === undefined) {
  return fallback;
}
```

判断之后，TypeScript 就知道 `value` 不是 `undefined` 了。

### 6.2 字面量类型

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
export type Role = "system" | "user" | "assistant" | "tool";
```

这不是普通字符串，而是限定只能取这四个字符串之一。

所以：

```ts
const role1: Role = "user";    // 可以
const role2: Role = "random";  // 不可以
```

字面量类型可以让消息结构更安全。

### 6.3 判别联合：用 `role` 判断消息类型

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
export type SystemMessage = {
  role: "system";
  content: string;
};

export type ToolMessage = {
  role: "tool";
  toolCallId: string;
  content: string;
};

export type ChatMessage = SystemMessage | UserMessage | AssistantMessage | ToolMessage;
```

`ChatMessage` 可以是四种消息之一。它们都有 `role` 字段，而且 `role` 是固定字面量。

所以在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里可以写：

```ts
if (message.role === "tool") {
  return {
    role: "tool",
    tool_call_id: message.toolCallId,
    content: message.content
  };
}
```

一旦判断 `message.role === "tool"`，TypeScript 就知道此时 `message` 是 `ToolMessage`，因此可以访问 `message.toolCallId`。

这叫“类型收窄”。读 TS 代码时很重要。

## 7. `undefined`、`null`、可选参数和默认值

### 7.1 `undefined` 和 `null` 的区别

在 JavaScript / TypeScript 里：

- `undefined` 通常表示“没传、没有这个值、对象上没有这个字段”。
- `null` 通常表示“明确为空”。

项目里的例子：

```ts
baseUrl?: string;
```

`baseUrl` 是可选配置，没传就是 `undefined`。

```ts
content: string | null;
```

Assistant 消息的内容可以明确为 `null`，因为模型有时只发工具调用，不发文本内容。

### 7.2 可选参数：参数名后面的 `?`

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
async chat(userInput: string, onToken?: TokenHandler, onTool?: ToolHandler): Promise<string> {
  ...
}
```

`onToken?` 表示调用 `chat()` 时可以不传这个参数。

所以这两种调用都可以：

```ts
await agent.chat("hello");
await agent.chat("hello", (token) => process.stdout.write(token));
```

### 7.3 默认参数

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
async chat(messages: ChatMessage[], tools: ToolSchema[] = [], onToken?: TokenHandler): Promise<LLMResponse> {
  ...
}
```

`tools: ToolSchema[] = []` 表示：

```text
如果调用时没传 tools，就默认使用空数组。
```

### 7.4 空值合并：`??`

在 [corecoder-ts/src/config.ts](../corecoder-ts/src/config.ts) 里：

```ts
env.CORECODER_MODEL ?? "gpt-4o"
```

`??` 表示：

```text
左边如果是 null 或 undefined，就用右边。
否则用左边。
```

它和 `||` 不完全一样。`||` 会把空字符串、0、false 也当成“没有值”，而 `??` 只关心 `null` 和 `undefined`。

### 7.5 可选链：`?.`

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
const choice = data.choices?.[0]?.message;
const content = choice?.content ?? "";
```

`?.` 表示安全访问：

```text
如果左边是 null 或 undefined，就直接返回 undefined，不继续访问后面的属性。
```

等价于更啰嗦的：

```ts
const choice = data.choices === undefined
  ? undefined
  : data.choices[0] === undefined
    ? undefined
    : data.choices[0].message;
```

读 API 返回值解析代码时，`?.` 很常见。

## 8. `Record<string, unknown>`、索引签名和 `unknown`

### 8.1 `Record<K, V>` 是对象字典

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
arguments: Record<string, unknown>;
```

`Record<string, unknown>` 可以理解为：

```ts
{
  [key: string]: unknown
}
```

也就是：

```text
键是字符串，值的类型暂时不知道。
```

工具调用参数来自模型，运行前不能完全相信，所以先用 `unknown`。

### 8.2 为什么不用 `any`

`unknown` 和 `any` 都表示“不确定类型”，但安全性不同：

```ts
const a: any = 123;
a.toUpperCase(); // TypeScript 不拦你，运行时会炸

const b: unknown = 123;
b.toUpperCase(); // TypeScript 直接报错
```

`unknown` 逼你先检查类型：

```ts
if (typeof b === "string") {
  b.toUpperCase();
}
```

这就是 [corecoder-ts/src/tools/base.ts](../corecoder-ts/src/tools/base.ts) 里要写参数校验函数的原因：

```ts
export function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new TypeError(`${key} must be a string`);
  }
  return value;
}
```

模型传来的参数先是 `unknown`，通过 `typeof value !== "string"` 检查后，才能安全当成字符串使用。

### 8.3 索引签名

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
export type JsonObject = { [key: string]: JsonValue };
```

`[key: string]: JsonValue` 表示：

```text
这个对象可以有任意字符串 key，但每个 value 都必须是 JsonValue。
```

例如：

```ts
const obj: JsonObject = {
  model: "gpt-4o",
  maxTokens: 4096,
  enabled: true
};
```

## 9. 泛型：类型里的“参数”

### 9.1 泛型是什么

泛型可以理解为“类型函数”，它接收一个类型作为参数。

例如：

```ts
Array<string>
```

意思是“字符串数组”。

```ts
Promise<string>
```

意思是“未来会得到字符串的异步结果”。

```ts
Record<string, unknown>
```

意思是“key 是 string，value 是 unknown 的对象”。

### 9.2 项目里的工具泛型

在 [corecoder-ts/src/tools/base.ts](../corecoder-ts/src/tools/base.ts) 里：

```ts
export interface Tool<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute(args: TArgs): Promise<string> | string;
}
```

拆开看：

```ts
Tool<TArgs>
```

表示 Tool 接收一个类型参数 `TArgs`，用来描述工具参数。

```ts
TArgs extends Record<string, unknown>
```

表示 `TArgs` 必须是一个对象字典。

```ts
= Record<string, unknown>
```

表示如果没传 `TArgs`，默认就是 `Record<string, unknown>`。

所以：

```ts
const tool: Tool = { ... };
```

等价于：

```ts
const tool: Tool<Record<string, unknown>> = { ... };
```

### 9.3 为什么需要泛型

泛型让“工具接口”可以保持通用：

```ts
execute(args: TArgs): Promise<string> | string;
```

不同工具的参数可以不同，但它们都符合同一个 Tool 结构。

在当前项目里，工具大多直接使用默认的 `Record<string, unknown>`，然后用 `stringArg()` 做运行时检查。这种写法简单，适合教学项目。

## 10. 函数、箭头函数、回调函数

### 10.1 普通函数

在 [corecoder-ts/src/config.ts](../corecoder-ts/src/config.ts) 里：

```ts
function parseNumber(value: string | undefined, fallback: number): number {
  ...
}
```

普通函数会被提升，也就是可以在定义之前调用。项目里很多辅助函数都用普通函数。

### 10.2 箭头函数

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 里：

```ts
(token) => process.stdout.write(token)
```

这是箭头函数，等价于：

```ts
function (token) {
  return process.stdout.write(token);
}
```

如果函数体只有一个表达式，可以省略 `{}` 和 `return`。

### 10.3 回调函数类型

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
export type TokenHandler = (token: string) => void;
export type ToolHandler = (name: string, args: Record<string, unknown>) => void;
```

这两个类型描述的是函数：

- `TokenHandler`：接收一个字符串 token，不返回有意义的值。
- `ToolHandler`：接收工具名和参数，不返回有意义的值。

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
async chat(userInput: string, onToken?: TokenHandler, onTool?: ToolHandler): Promise<string> {
  ...
}
```

这表示调用 `chat()` 的人可以传两个回调：

```ts
await agent.chat(
  "读 README",
  (token) => process.stdout.write(token),
  (name, args) => console.log(name, args)
);
```

### 10.4 可选回调调用：`onTool?.(...)`

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
onTool?.(call.name, call.arguments);
```

意思是：

```text
如果 onTool 存在，就调用它。
如果 onTool 是 undefined，就什么也不做。
```

等价于：

```ts
if (onTool) {
  onTool(call.name, call.arguments);
}
```

## 11. 异步：`async`、`await`、`Promise`

### 11.1 为什么需要异步

CoreCoder TS 里很多操作都需要等待：

- 调 LLM API。
- 读文件。
- 写文件。
- 执行 shell 命令。
- 读取用户输入。

这些操作不能立刻得到结果，所以用异步。

### 11.2 `Promise<T>` 是“未来的 T”

```ts
Promise<string>
```

可以理解为：

```text
现在还没有字符串，但未来会得到一个字符串，或者失败抛错。
```

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
async chat(...): Promise<string> {
  ...
}
```

`chat()` 是异步函数，调用时要：

```ts
const response = await agent.chat("hello");
```

### 11.3 `async` 函数总是返回 Promise

即使函数里写的是：

```ts
return response.content;
```

因为函数声明了 `async`，外面拿到的也是 `Promise<string>`。

`await` 会等 Promise 完成，并取出里面的结果。

### 11.4 `await` 等待异步结果

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
const response = await fetch(`${this.baseUrl}/chat/completions`, {
  method: "POST",
  ...
});
```

`fetch()` 返回 Promise，`await` 等它完成后，`response` 才是真正的响应对象。

### 11.5 `Promise.all` 并发执行

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
const results = await Promise.all(response.toolCalls.map(async (call) => {
  onTool?.(call.name, call.arguments);
  const result = await this.execTool(call.name, call.arguments);
  return {
    role: "tool" as const,
    toolCallId: call.id,
    content: result
  };
}));
```

这段的意思是：

1. `response.toolCalls.map(...)` 把每个工具调用变成一个异步任务。
2. `Promise.all(...)` 同时等待所有任务完成。
3. 所有工具结果都返回后，得到 `results` 数组。

这就是 TS 版 CoreCoder 的并行工具执行。

### 11.6 顶层 `await`

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 最后：

```ts
await main();
```

这叫 top-level await，也就是在模块最外层直接使用 `await`。

它要求项目使用支持 ESM 的 Node 环境。你可以把它理解为：

```ts
main().catch(...);
```

只是写法更直接。

## 12. 类、对象、构造函数、访问修饰符

### 12.1 类是模板，对象是实例

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
export class Agent {
  ...
}
```

`Agent` 是类，代表 Agent 应该有哪些状态和方法。运行时创建对象：

```ts
const agent = new Agent(llm, undefined, config.maxContextTokens);
```

这里的 `agent` 才是真正保存消息历史、LLM、工具列表的对象。

### 12.2 类字段

```ts
public messages: ChatMessage[] = [];
public context: ContextManager;
private system: string;
```

这些是类字段：

- `messages`：公开字段，保存聊天历史。
- `context`：公开字段，保存上下文管理器。
- `system`：私有字段，只能在 `Agent` 类内部使用。

### 12.3 `public` 和 `private`

```ts
public messages: ChatMessage[] = [];
private system: string;
```

`public` 表示外部可以访问：

```ts
agent.messages = [];
```

`private` 表示只能类内部访问：

```ts
this.system = systemPrompt(this.tools);
```

外部如果写：

```ts
agent.system
```

TypeScript 会报错。

### 12.4 构造函数

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
constructor(
  public llm: LLMClient,
  public tools: Tool[] = ALL_TOOLS,
  maxContextTokens = 128_000,
  private maxRounds = 50
) {
  this.context = new ContextManager(maxContextTokens);
  this.system = systemPrompt(this.tools);
}
```

`constructor` 是创建对象时自动调用的方法。

调用：

```ts
new Agent(llm, undefined, config.maxContextTokens)
```

会执行构造函数。

### 12.5 构造函数参数属性

这段里最容易卡住的是：

```ts
constructor(public llm: LLMClient, private maxRounds = 50) { ... }
```

TypeScript 有一个简写：构造函数参数前面加 `public` 或 `private`，会自动变成类字段。

所以下面这段：

```ts
constructor(public llm: LLMClient) {}
```

等价于更啰嗦的：

```ts
public llm: LLMClient;

constructor(llm: LLMClient) {
  this.llm = llm;
}
```

所以 `Agent` 的构造函数同时做了两件事：

1. 接收参数。
2. 自动把部分参数保存到对象上。

### 12.6 静态方法：`static`

在 [corecoder-ts/src/config.ts](../corecoder-ts/src/config.ts) 里：

```ts
static fromEnv(env: NodeJS.ProcessEnv = process.env): Config {
  return new Config(...);
}
```

`static` 表示这个方法属于类本身，而不是某个对象。

调用方式：

```ts
const config = Config.fromEnv();
```

不是：

```ts
const config = new Config();
config.fromEnv(); // 不是这种
```

静态方法常用来做“工厂方法”，也就是从环境变量、配置文件等创建对象。

### 12.7 getter：像属性一样访问的方法

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
get estimatedCost(): number | undefined {
  const pricing = PRICING[this.model];
  if (!pricing) {
    return undefined;
  }
  ...
}
```

`get` 定义的是 getter。外部访问时像属性：

```ts
const cost = agent.llm.estimatedCost;
```

而不是：

```ts
const cost = agent.llm.estimatedCost();
```

getter 适合用于“根据当前状态临时计算出来的值”。

## 13. `interface`：描述对象必须长什么样

### 13.1 接口定义

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
export interface LLMClient {
  model: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedCost: number | undefined;
  chat(messages: ChatMessage[], tools?: ToolSchema[], onToken?: TokenHandler): Promise<LLMResponse>;
}
```

这表示一个 `LLMClient` 必须有：

- `model` 字符串。
- token 统计字段。
- `estimatedCost` 属性。
- `chat()` 方法。

### 13.2 类实现接口：`implements`

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
export class LLM implements LLMClient {
  ...
}
```

`implements LLMClient` 表示：

```text
LLM 这个类承诺满足 LLMClient 接口。
```

如果 `LLM` 少了 `chat()` 方法，或者 `chat()` 返回类型不对，TypeScript 会报错。

### 13.3 `type` 和 `interface` 的区别

这个项目里两者都用：

```ts
export type ToolCall = { ... };
export interface LLMClient { ... }
```

你可以先这样理解：

- `type` 更适合联合类型、字面量类型、复杂组合类型。
- `interface` 更适合描述“某个对象或类应该具备哪些字段和方法”。

比如：

```ts
type Role = "system" | "user" | "assistant" | "tool";
interface LLMClient { chat(...): Promise<LLMResponse>; }
```

这就是本项目的使用风格。

## 14. 对象、数组、展开语法和解构

### 14.1 对象字面量

在 [corecoder-ts/src/tools/edit.ts](../corecoder-ts/src/tools/edit.ts) 里：

```ts
export const editFileTool: Tool = {
  name: "edit_file",
  description: "Replace one exact string in a file. The old string must appear exactly once.",
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Path to edit." },
      old_string: { type: "string", description: "Exact text to replace." },
      new_string: { type: "string", description: "Replacement text." }
    },
    required: ["file_path", "old_string", "new_string"]
  },
  async execute(args) {
    ...
  }
};
```

这是一个对象。它符合 `Tool` 接口，所以可以被 Agent 当成工具使用。

### 14.2 数组

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
public messages: ChatMessage[] = [];
```

常见数组操作：

```ts
this.messages.push({ role: "user", content: userInput });
this.messages.push(...results);
messages.slice(-keep);
messages.splice(0, messages.length, newMessage, ...tail);
```

逐个解释：

- `push(x)`：往数组末尾加一个元素。
- `push(...results)`：把 `results` 数组里的元素逐个加入。
- `slice(-keep)`：取数组最后 `keep` 个元素，不修改原数组。
- `splice(...)`：修改原数组。

### 14.3 展开语法：`...`

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
return [{ role: "system", content: this.system }, ...this.messages];
```

`...this.messages` 表示把数组里的元素展开到新数组里。

如果：

```ts
this.messages = [
  { role: "user", content: "hi" }
];
```

那么：

```ts
[{ role: "system", content: "..." }, ...this.messages]
```

结果是：

```ts
[
  { role: "system", content: "..." },
  { role: "user", content: "hi" }
]
```

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 里还有对象展开：

```ts
const llm = new LLM(config.baseUrl ? { ...llmOptions, baseUrl: config.baseUrl } : llmOptions);
```

`{ ...llmOptions, baseUrl: config.baseUrl }` 表示复制 `llmOptions` 的字段，再额外加上或覆盖 `baseUrl`。

### 14.4 解构数组

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
const [inputRate, outputRate] = pricing;
```

如果：

```ts
pricing = [2.5, 15];
```

那么：

```ts
inputRate = 2.5;
outputRate = 15;
```

### 14.5 解构对象条目

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 里：

```ts
return Object.entries(args)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  .join(", ")
  .slice(0, 80);
```

`Object.entries(args)` 会得到：

```ts
[
  ["file_path", "README.md"],
  ["limit", 20]
]
```

`([key, value]) => ...` 是数组解构，把每个二元数组拆成 `key` 和 `value`。

## 15. 判断、循环、短路写法

### 15.1 `if` 判断和早返回

在 [corecoder-ts/src/config.ts](../corecoder-ts/src/config.ts) 里：

```ts
if (value === undefined || value.trim() === "") {
  return fallback;
}
```

这叫“早返回”：遇到无效输入就直接返回默认值，后面的代码只处理正常情况。

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
if (response.toolCalls.length === 0) {
  this.messages.push(response.message);
  return response.content;
}
```

如果模型没有工具调用，就保存回复并结束；否则继续执行工具。

### 15.2 `for` 循环

```ts
for (let round = 0; round < this.maxRounds; round += 1) {
  ...
}
```

这是普通计数循环。Agent 最多执行 `maxRounds` 轮，避免模型无限调用工具。

### 15.3 `for ... of`

在 [corecoder-ts/src/context.ts](../corecoder-ts/src/context.ts) 里：

```ts
for (const message of messages) {
  ...
}
```

`for ... of` 用来遍历数组里的元素。

### 15.4 `while (true)`

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 里：

```ts
while (true) {
  const line = (await rl.question("You > ")).trim();
  ...
  if (["quit", "exit", "/quit", "/exit"].includes(line.toLowerCase())) break;
}
```

这是 REPL 主循环：

1. 一直等待用户输入。
2. 遇到退出命令就 `break`。
3. 否则继续处理下一轮。

### 15.5 三元表达式

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
  ? parsed as Record<string, unknown>
  : {};
```

格式是：

```ts
条件 ? 条件为真时的值 : 条件为假时的值
```

这段意思是：

- 如果解析结果是非数组对象，就返回它。
- 否则返回空对象。

### 15.6 `&&` 和 `||` 的短路

```ts
if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
  ...
}
```

`&&` 从左到右判断，只要有一个为假，就不继续判断后面。

这很重要：先判断 `parsed !== null`，后面才能安全地把它当对象处理。

## 16. 类型收窄、类型守卫、类型断言

### 16.1 `typeof` 收窄

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
export function asString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  return value;
}
```

函数参数一开始是 `unknown`。经过：

```ts
typeof value !== "string"
```

这个检查后，TypeScript 知道如果没抛错，`value` 就是 `string`。

### 16.2 `instanceof` 收窄

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
} catch (error) {
  if (error instanceof Error) {
    return `Error executing ${name}: ${error.message}`;
  }
  return `Error executing ${name}`;
}
```

`catch` 里的 `error` 不一定是 `Error` 对象。有人可能抛字符串、数字、任意值。

所以要先判断：

```ts
error instanceof Error
```

判断通过后，才能安全访问：

```ts
error.message
```

### 16.3 自定义类型守卫：`value is ...`

在 [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts) 里：

```ts
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

返回类型：

```ts
value is Record<string, unknown>
```

意思是：

```text
如果这个函数返回 true，TypeScript 就可以把 value 当成 Record<string, unknown>。
```

用法类似：

```ts
const parsed = JSON.parse(raw) as unknown;
if (isRecord(parsed)) {
  parsed.file_path;
}
```

### 16.4 类型断言：`as`

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
const data = await response.json() as ChatCompletionResponse;
```

`as ChatCompletionResponse` 表示：

```text
告诉 TypeScript：我认为这个 JSON 符合 ChatCompletionResponse 类型。
```

类型断言不会做运行时校验。它只是让编译器相信你。

所以读到 `as` 时要留心：这通常是作者在某个边界上手动声明类型。

### 16.5 `as const`

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
return {
  role: "tool" as const,
  toolCallId: call.id,
  content: result
};
```

如果不写 `as const`，TypeScript 可能把 `role` 推断成普通 `string`。

但 `ToolMessage` 要求：

```ts
role: "tool";
```

也就是必须是字面量类型 `"tool"`，不是任意字符串。

所以 `as const` 的意思是：

```text
把 "tool" 固定为字面量类型 "tool"。
```

## 17. 字符串、模板字符串、数字分隔符

### 17.1 模板字符串

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
return `Error: unknown tool '${name}'`;
```

反引号包起来的是模板字符串，可以用 `${...}` 插入变量。

在 [corecoder-ts/src/context.ts](../corecoder-ts/src/context.ts) 里：

```ts
content: `[context compressed: ${removed} older messages omitted]`
```

`${removed}` 会被替换成变量值。

### 17.2 多行字符串

模板字符串可以跨多行：

```ts
const text = `line 1
line 2`;
```

项目里主要用它做错误信息和 prompt 片段。

### 17.3 数字分隔符 `_`

在多个文件里能看到：

```ts
128_000
4_000
1_000_000
```

下划线只是为了可读性，和下面这些数字完全一样：

```ts
128000
4000
1000000
```

运行时没有区别。

## 18. Node.js 内置模块和文件 API

### 18.1 `node:` 前缀

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 里：

```ts
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
```

`node:` 表示这是 Node.js 内置模块，不是 npm 包，也不是项目文件。

常见例子：

```ts
node:fs/promises
node:process
node:path
node:readline/promises
node:child_process
```

### 18.2 导入时重命名：`as`

```ts
import { stdin as input, stdout as output } from "node:process";
```

意思是：

```text
从 node:process 导入 stdin，但在当前文件里叫 input。
从 node:process 导入 stdout，但在当前文件里叫 output。
```

这样写是为了配合：

```ts
const rl = createInterface({ input, output });
```

### 18.3 Promise 版文件 API

在 [corecoder-ts/src/tools/edit.ts](../corecoder-ts/src/tools/edit.ts) 里：

```ts
import { readFile, writeFile } from "node:fs/promises";
```

`node:fs/promises` 里的函数都返回 Promise，所以要 `await`：

```ts
const content = await readFile(filePath, "utf8");
await writeFile(filePath, content.replace(oldString, newString), "utf8");
```

### 18.4 `process`

在 [corecoder-ts/src/config.ts](../corecoder-ts/src/config.ts) 里：

```ts
static fromEnv(env: NodeJS.ProcessEnv = process.env): Config {
  ...
}
```

`process.env` 是 Node.js 里的环境变量对象。

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 里：

```ts
process.exitCode = 1;
```

这表示程序退出时返回错误码 1，但不会立刻强制退出。相比 `process.exit(1)`，这种写法更温和，能让异步清理逻辑有机会执行。

## 19. HTTP、JSON 和 API 响应解析

### 19.1 `fetch`

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
const response = await fetch(`${this.baseUrl}/chat/completions`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${this.apiKey}`
  },
  body: JSON.stringify(body)
});
```

`fetch()` 发送 HTTP 请求。这里调用的是 OpenAI-compatible 的 chat completions API。

重点字段：

- `method: "POST"`：发送 POST 请求。
- `headers`：请求头，声明 JSON 和鉴权。
- `body`：请求体，必须是字符串，所以用 `JSON.stringify(body)`。

### 19.2 `response.ok`

```ts
if (!response.ok) {
  throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
}
```

`response.ok` 表示 HTTP 状态码是否在 200 到 299 之间。

如果请求失败，代码抛错，让上层知道 LLM 请求没有成功。

### 19.3 解析 JSON

```ts
const data = await response.json() as ChatCompletionResponse;
```

`response.json()` 把响应体解析成 JavaScript 对象。因为外部 API 返回值是动态的，所以这里用了类型断言。

### 19.4 `JSON.stringify` 和 `JSON.parse`

发送请求时：

```ts
body: JSON.stringify(body)
```

把对象转成 JSON 字符串。

解析工具参数时：

```ts
const parsed = JSON.parse(raw) as unknown;
```

把模型返回的字符串解析成对象。

注意：`JSON.parse()` 可能失败，所以项目里用 `try/catch`：

```ts
try {
  const parsed = JSON.parse(raw) as unknown;
  ...
} catch {
  return {};
}
```

`catch { ... }` 没有写 error 参数，因为这里不关心错误详情，只想失败时返回空对象。

## 20. Map、Set 和常见内置对象

### 20.1 `Set`

在 [corecoder-ts/src/tools/edit.ts](../corecoder-ts/src/tools/edit.ts) 里：

```ts
export const changedFiles = new Set<string>();
```

`Set` 是不重复集合。`Set<string>` 表示里面放字符串。

加入元素：

```ts
changedFiles.add(filePath);
```

转成数组：

```ts
[...changedFiles]
```

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 里：

```ts
console.log([...changedFiles].sort().join("\n") || "No files modified this session.");
```

意思是：

1. 把 Set 展开成数组。
2. 排序。
3. 用换行拼接成字符串。
4. 如果结果是空字符串，就显示提示。

### 20.2 `Array.map`

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
messages.map(toOpenAIMessage)
```

`map` 会把数组里的每个元素转换成新元素，返回新数组。

在工具调用里：

```ts
response.toolCalls.map(async (call) => {
  ...
})
```

每个 `call` 都变成一个 Promise，最后交给 `Promise.all()`。

### 20.3 `Array.includes`

在 [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts) 里：

```ts
if (["quit", "exit", "/quit", "/exit"].includes(line.toLowerCase())) break;
```

`includes()` 判断数组里是否包含某个值。

### 20.4 `Object.entries`

```ts
Object.entries(args)
```

把对象变成键值对数组：

```ts
{ a: 1, b: 2 }
```

变成：

```ts
[["a", 1], ["b", 2]]
```

适合遍历对象。

## 21. 错误处理：`try/catch`、`throw`

### 21.1 抛出错误

在 [corecoder-ts/src/tools/base.ts](../corecoder-ts/src/tools/base.ts) 里：

```ts
if (typeof value !== "string") {
  throw new TypeError(`${key} must be a string`);
}
```

参数类型不对时，直接抛出 `TypeError`。

### 21.2 捕获错误

在 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 里：

```ts
try {
  return await tool.execute(args);
} catch (error) {
  if (error instanceof Error) {
    return `Error executing ${name}: ${error.message}`;
  }
  return `Error executing ${name}`;
}
```

工具执行失败时，Agent 不让整个程序崩掉，而是把错误转成工具结果返回给模型。

这符合 coding agent 的设计：工具失败也是上下文的一部分，模型可以根据错误继续修正。

### 21.3 `catch` 可以不接 error

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
} catch {
  return {};
}
```

如果不需要错误对象，可以省略参数。

## 22. 类型和运行时：TS 检查不等于真实安全

### 22.1 类型只在编译时工作

TypeScript 类型不会自动验证外部输入。

例如：

```ts
const data = await response.json() as ChatCompletionResponse;
```

这只是告诉编译器“我认为它是这个类型”。如果真实 API 返回结构不符合，运行时仍然可能出问题。

所以项目里对外部边界会做一些保护：

```ts
const choice = data.choices?.[0]?.message;
const content = choice?.content ?? "";
```

即使 `choices` 不存在，也不会立刻崩。

### 22.2 模型工具参数必须运行时检查

工具参数来自 LLM，不能只靠类型。

所以 [corecoder-ts/src/tools/edit.ts](../corecoder-ts/src/tools/edit.ts) 里会写：

```ts
const filePath = stringArg(args, "file_path");
const oldString = stringArg(args, "old_string");
const newString = stringArg(args, "new_string");
```

而不是直接：

```ts
const filePath = args.file_path;
```

这是一个重要工程习惯：凡是来自外部世界的数据，都要在运行时检查。

## 23. 从 TS 语法角度读懂 Agent 主循环

下面用 [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts) 串一下关键语法。

### 23.1 类字段和构造函数

```ts
export class Agent {
  public messages: ChatMessage[] = [];
  public context: ContextManager;
  private system: string;

  constructor(
    public llm: LLMClient,
    public tools: Tool[] = ALL_TOOLS,
    maxContextTokens = 128_000,
    private maxRounds = 50
  ) {
    this.context = new ContextManager(maxContextTokens);
    this.system = systemPrompt(this.tools);
  }
}
```

你现在应该能读出：

- `messages` 是聊天历史数组。
- `context` 是上下文管理器。
- `system` 是私有 system prompt。
- `llm` 和 `tools` 通过构造函数参数属性自动保存到对象上。
- `maxContextTokens` 只是构造函数内部参数，不自动成为字段。
- `maxRounds` 是私有字段，默认 50。

### 23.2 组装完整消息

```ts
fullMessages(): ChatMessage[] {
  return [{ role: "system", content: this.system }, ...this.messages];
}
```

语法点：

- `(): ChatMessage[]`：返回消息数组。
- `...this.messages`：展开历史消息。
- 返回的新数组第一条永远是 system 消息。

### 23.3 Agent 对话方法

```ts
async chat(userInput: string, onToken?: TokenHandler, onTool?: ToolHandler): Promise<string> {
  this.messages.push({ role: "user", content: userInput });
  this.context.maybeCompress(this.messages);
  ...
}
```

语法点：

- `async`：这是异步方法。
- `userInput: string`：用户输入必须是字符串。
- `onToken?`、`onTool?`：两个可选回调。
- `Promise<string>`：最终返回字符串。
- `push(...)`：把用户消息加入历史。

### 23.4 调 LLM

```ts
const response = await this.llm.chat(this.fullMessages(), toolSchemas(this.tools), onToken);
```

语法点：

- `await` 等 LLM 异步返回。
- `this.fullMessages()` 调当前对象的方法。
- `toolSchemas(this.tools)` 把工具对象转换成模型需要的 schema。
- `onToken` 原样传给 LLM，支持边生成边输出。

### 23.5 没有工具调用就结束

```ts
if (response.toolCalls.length === 0) {
  this.messages.push(response.message);
  return response.content;
}
```

语法点：

- `length === 0` 判断数组为空。
- `return` 直接结束函数。
- 返回值是最终文本。

### 23.6 有工具调用就并发执行

```ts
const results = await Promise.all(response.toolCalls.map(async (call) => {
  onTool?.(call.name, call.arguments);
  const result = await this.execTool(call.name, call.arguments);
  return {
    role: "tool" as const,
    toolCallId: call.id,
    content: result
  };
}));
```

语法点：

- `map(async (call) => ...)`：每个工具调用变成一个异步任务。
- `Promise.all(...)`：等待所有任务完成。
- `onTool?.(...)`：如果有回调就通知外部。
- `await this.execTool(...)`：执行工具。
- `role: "tool" as const`：让 `role` 被识别为字面量类型 `"tool"`。

### 23.7 私有工具执行方法

```ts
private async execTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = getTool(name, this.tools);
  if (!tool) {
    return `Error: unknown tool '${name}'`;
  }
  try {
    return await tool.execute(args);
  } catch (error) {
    ...
  }
}
```

语法点：

- `private`：外部不能直接调用。
- `args: Record<string, unknown>`：工具参数是未知值对象。
- `if (!tool)`：没找到工具时返回错误字符串。
- `try/catch`：工具异常会被捕获。

读完这一节，你应该能从 TypeScript 语法层面读懂 Agent 主循环。

## 24. 从 TS 语法角度读懂 LLM 层

### 24.1 内部 API 类型

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 里：

```ts
type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
};
```

这里的语法点：

- `type` 定义类型别名。
- `role` 是字面量联合类型。
- `tool_call_id?` 是可选字段。
- `Array<{ ... }>` 是对象数组。
- 内层对象继续描述 tool call 的结构。

### 24.2 价格表类型

```ts
const PRICING: Record<string, [input: number, output: number]> = {
  "gpt-4o": [2.5, 10],
  "gpt-4o-mini": [0.15, 0.6]
};
```

`Record<string, ...>` 表示 key 是模型名字符串。

`[input: number, output: number]` 是元组类型，表示数组固定有两个数字。`input` 和 `output` 是标签，帮助阅读。

### 24.3 组装请求体

```ts
const body: Record<string, unknown> = {
  model: this.model,
  messages: messages.map(toOpenAIMessage),
  temperature: this.temperature,
  max_tokens: this.maxTokens
};
if (tools.length > 0) {
  body.tools = tools;
}
```

为什么 `body` 用 `Record<string, unknown>`？

因为请求体字段有字符串、数字、数组、对象等多种值。用 `Record<string, unknown>` 可以灵活追加 `tools` 字段。

### 24.4 解析返回值

```ts
const choice = data.choices?.[0]?.message;
const content = choice?.content ?? "";
const toolCalls = parseToolCalls(choice?.tool_calls ?? []);
```

语法点：

- `?.[0]`：安全访问数组第 0 项。
- `?.message`：安全访问对象字段。
- `?? ""`：如果内容为空值，就用空字符串。
- `?? []`：如果没有工具调用，就用空数组。

这几行体现了 API 边界的防御式写法。

## 25. 从 TS 语法角度读懂工具系统

### 25.1 工具接口

在 [corecoder-ts/src/tools/base.ts](../corecoder-ts/src/tools/base.ts) 里：

```ts
export interface Tool<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute(args: TArgs): Promise<string> | string;
}
```

一个工具必须有：

- `name`：工具名。
- `description`：给模型看的描述。
- `parameters`：JSON Schema 参数说明。
- `execute()`：真正执行工具逻辑。

`execute()` 可以同步返回字符串，也可以异步返回 `Promise<string>`。

### 25.2 工具对象

在 [corecoder-ts/src/tools/edit.ts](../corecoder-ts/src/tools/edit.ts) 里：

```ts
export const editFileTool: Tool = {
  name: "edit_file",
  description: "...",
  parameters: { ... },
  async execute(args) {
    ...
  }
};
```

这里没有写 `class EditFileTool`，而是直接用对象实现接口。

这种写法适合小工具：结构清楚，代码短。

### 25.3 工具 schema 转换

在 [corecoder-ts/src/tools/base.ts](../corecoder-ts/src/tools/base.ts) 里：

```ts
export function schemaFor(tool: Tool): ToolSchema {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  };
}
```

这个函数把内部 Tool 对象转换成 LLM API 能理解的工具 schema。

语法点：

- 参数 `tool: Tool`。
- 返回值 `ToolSchema`。
- 返回对象字面量。
- 从 `tool` 上读取字段。

### 25.4 参数校验

```ts
const filePath = stringArg(args, "file_path");
```

比直接写下面这样安全：

```ts
const filePath = args.file_path as string;
```

因为 `stringArg()` 会在运行时检查参数真的是字符串。

## 26. 从 Python 版迁移理解 TS 版

如果你已经看过 Python 版，可以这样对照：

| Python 写法 | TypeScript 写法 | 含义 |
|---|---|---|
| `class Agent:` | `class Agent {}` | 定义类 |
| `self.messages` | `this.messages` | 当前对象字段 |
| `def chat(...) -> str` | `chat(...): Promise<string>` | 方法返回值 |
| `async def` | `async function` / `async method` | 异步函数 |
| `await llm.chat(...)` | `await this.llm.chat(...)` | 等待异步调用 |
| `dict[str, Any]` | `Record<string, unknown>` | 字符串 key 的对象 |
| `list[ChatMessage]` | `ChatMessage[]` | 消息数组 |
| `Optional[str]` / `str | None` | `string | undefined` / `string | null` | 可能为空 |
| `@classmethod` | `static fromEnv(...)` | 类级方法 |
| `@property` | `get estimatedCost()` | 像属性一样访问的计算值 |
| `try/except` | `try/catch` | 错误处理 |
| `json.loads` | `JSON.parse` | JSON 字符串转对象 |
| `json.dumps` | `JSON.stringify` | 对象转 JSON 字符串 |

两个版本的核心思想类似：

```text
用户输入 -> Agent 保存消息 -> LLM 返回文本或工具调用 -> 工具执行 -> 工具结果回到消息 -> 再问 LLM
```

TypeScript 版主要多了更显式的类型系统。

## 27. 阅读顺序建议

如果目标是“尽快看懂 TS 版本代码”，建议按这个顺序读：

1. [corecoder-ts/src/types.ts](../corecoder-ts/src/types.ts)
   先看清楚消息、工具调用、LLM 返回值这些核心数据结构。

2. [corecoder-ts/src/tools/base.ts](../corecoder-ts/src/tools/base.ts)
   理解工具接口、schema、参数校验。

3. [corecoder-ts/src/tools/read.ts](../corecoder-ts/src/tools/read.ts)、[corecoder-ts/src/tools/edit.ts](../corecoder-ts/src/tools/edit.ts)
   从最简单的工具开始读。

4. [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts)
   理解请求体、API 返回值、工具调用解析。

5. [corecoder-ts/src/agent.ts](../corecoder-ts/src/agent.ts)
   读 Agent 主循环。

6. [corecoder-ts/src/context.ts](../corecoder-ts/src/context.ts)
   理解上下文压缩。

7. [corecoder-ts/src/session.ts](../corecoder-ts/src/session.ts)
   理解会话保存和恢复。

8. [corecoder-ts/src/cli.ts](../corecoder-ts/src/cli.ts)
   最后读入口和 REPL，把整条执行链串起来。

## 28. 读源码时的常见卡点速查

### 28.1 `import type` 为什么不能删

它告诉 TypeScript 这是类型导入。删了可能仍能编译，但语义不清晰，也可能影响某些编译配置。

### 28.2 为什么源码里导入 `./agent.js`，文件却是 `agent.ts`

因为 TypeScript 编译后会生成 `agent.js`。Node ESM 运行时需要真实 `.js` 文件路径。

### 28.3 `ChatMessage[]` 是什么意思

`ChatMessage` 类型的数组。

### 28.4 `string | undefined` 是什么意思

这个值可能是字符串，也可能不存在。

### 28.5 `toolCalls?: ToolCall[]` 是什么意思

`toolCalls` 字段可以没有；如果有，它必须是 `ToolCall` 数组。

### 28.6 `Record<string, unknown>` 是什么意思

字符串 key 的对象，但 value 类型未知。通常用于外部输入或动态对象。

### 28.7 `as ChatCompletionResponse` 是什么意思

类型断言。告诉 TypeScript “我认为它是这个类型”，但不做运行时校验。

### 28.8 `as const` 是什么意思

让某个值保持最精确的字面量类型，比如让 `"tool"` 被认为就是 `"tool"`，不是普通 `string`。

### 28.9 `onTool?.(...)` 是什么意思

如果 `onTool` 存在就调用；不存在就跳过。

### 28.10 `Promise<string> | string` 是什么意思

函数可以异步返回字符串，也可以同步返回字符串。调用方如果用 `await`，两种都能处理。

### 28.11 `private async execTool(...)` 是什么意思

这是类内部使用的异步私有方法。外部不能调用，内部调用时要 `await`。

### 28.12 `readonly` 为什么没怎么出现

这个项目为了教学简洁，很多字段没有加 `readonly`。在大型 TS 项目里，不希望被修改的字段常会标成 `readonly`。

### 28.13 `NodeJS.ProcessEnv` 是什么意思

这是 Node.js 类型定义里的环境变量类型。它描述 `process.env` 这种对象。

### 28.14 `Array<{ ... }>` 是什么意思

对象数组。数组里的每个元素都必须符合 `{ ... }` 里描述的对象结构。

### 28.15 `NonNullable<...>` 是什么意思

`NonNullable<T>` 是 TypeScript 内置工具类型，用来从 `T` 里去掉 `null` 和 `undefined`。

在 [corecoder-ts/src/llm.ts](../corecoder-ts/src/llm.ts) 的 `parseToolCalls` 参数类型里，它用来从复杂 API 类型里提取“非空的 tool_calls 数组类型”。这段类型比较高级，第一次读不必死磕；你可以先把它理解为：

```text
parseToolCalls 接收的是 OpenAI 响应里的 tool_calls 数组。
```

## 29. 最小练习：用 TS 语法读一遍工具

以 [corecoder-ts/src/tools/edit.ts](../corecoder-ts/src/tools/edit.ts) 为例：

```ts
export const editFileTool: Tool = {
  name: "edit_file",
  description: "Replace one exact string in a file. The old string must appear exactly once.",
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Path to edit." },
      old_string: { type: "string", description: "Exact text to replace." },
      new_string: { type: "string", description: "Replacement text." }
    },
    required: ["file_path", "old_string", "new_string"]
  },
  async execute(args) {
    ...
  }
};
```

你应该能读出：

1. `editFileTool` 是一个导出的常量。
2. 它的类型是 `Tool`。
3. 它的工具名是 `edit_file`。
4. `parameters` 是给模型看的 JSON Schema。
5. `execute(args)` 是真正执行编辑的函数。
6. `async execute` 表示里面可以用 `await`。

继续看执行逻辑：

```ts
const filePath = stringArg(args, "file_path");
const oldString = stringArg(args, "old_string");
const newString = stringArg(args, "new_string");
const content = await readFile(filePath, "utf8");
```

你应该能读出：

1. 从未知参数里安全提取三个字符串。
2. 异步读取文件内容。
3. 读取结果是字符串。

继续看：

```ts
const first = content.indexOf(oldString);
if (first === -1) {
  return `Error: old_string not found in ${filePath}`;
}
if (content.indexOf(oldString, first + oldString.length) !== -1) {
  return `Error: old_string appears multiple times in ${filePath}`;
}
```

你应该能读出：

1. `indexOf` 查找旧字符串第一次出现的位置。
2. `-1` 表示没找到。
3. 第二个 `indexOf` 从第一次出现之后继续找。
4. 如果还能找到，说明旧字符串出现多次，工具拒绝编辑。

最后：

```ts
await writeFile(filePath, content.replace(oldString, newString), "utf8");
trackChangedFile(filePath);
return `Edited ${filePath}`;
```

你应该能读出：

1. 写回替换后的内容。
2. 记录这个文件被改过。
3. 返回工具执行结果。

这就是阅读 TS 源码的基本节奏：先看类型，再看数据从哪里来，再看控制流怎么走。

## 30. 一句话总结

读 CoreCoder TS 版本时，最重要的不是背所有 TypeScript 语法，而是抓住四条线：

1. **类型线**：`type`、`interface`、联合类型、`Record<string, unknown>` 描述数据结构。
2. **对象线**：`class`、`constructor`、`this`、`public/private` 保存运行状态。
3. **异步线**：`async`、`await`、`Promise` 串起 LLM、文件和命令执行。
4. **边界线**：`unknown`、类型守卫、`try/catch` 处理外部输入和错误。

把这四条线看懂，`corecoder-ts/src` 里的大部分代码就不会再陌生。
