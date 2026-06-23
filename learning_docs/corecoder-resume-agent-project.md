# CoreCoder Agent 开发项目简历描述

## 项目概述

主导实现一个轻量级 AI Coding Agent，用约 1,400 行 Python 代码复现 Claude Code 类编程 Agent 的核心架构。项目支持多轮对话、函数调用工具、并行工具执行、上下文压缩、会话保存与恢复、子 Agent 隔离执行，以及 OpenAI-compatible / LiteLLM 多模型接入，可作为可运行的 Agent 框架原型和源码学习项目。

## 技术栈

- 语言与框架：Python 3.10+、OpenAI SDK、LiteLLM
- Agent 架构：ReAct-style agent loop、function calling、JSON Schema 工具定义、ThreadPoolExecutor 并行执行
- CLI 与交互：Rich、prompt_toolkit、流式输出、REPL 命令系统
- 记忆与状态：messages 短期记忆、上下文压缩、JSON 会话持久化
- 工程化：pytest、pyproject.toml、GitHub Actions、PyPI package、跨平台测试

## 核心实现

### Agent Loop

在 `corecoder/agent.py` 中实现完整的 Agent 执行闭环：用户输入先写入 `messages`，再携带系统提示词和工具 schema 请求 LLM；如果模型返回 tool calls，则执行工具并把 tool result 追加回上下文，继续进入下一轮推理；如果模型返回纯文本，则结束本次任务并返回给用户。该 loop 支持最大轮数限制，避免工具调用死循环。

### 工具系统

在 `corecoder/tools/base.py` 中抽象统一 `Tool` 基类，每个工具声明 `name`、`description` 和 JSON Schema 参数，并通过 `schema()` 转换为 OpenAI function-calling 格式。项目内置 bash、read、write、edit、glob、grep、agent 七类工具，由 `corecoder/tools/__init__.py` 注册和查找，方便扩展自定义工具。

### 并行工具执行

当模型一次返回多个 tool calls 时，`Agent._exec_tools_parallel()` 使用 `ThreadPoolExecutor` 并发执行独立工具调用，再按原始 tool call 顺序写回结果。这个设计降低多文件读取、搜索等 I/O 型任务的等待时间，也复现了现代 Coding Agent 中 streaming executor 的核心思想。

### Memory 与上下文压缩

项目使用 `messages` 作为会话内短期记忆，并在 `corecoder/context.py` 中实现三层上下文压缩策略：第一层裁剪过长工具输出，保留头尾关键信息；第二层使用 LLM 总结旧轮次，保留最近消息；第三层在接近上下文上限时执行 hard collapse，只保留摘要和最近交互。该机制让 Agent 能在长任务中持续工作，同时控制 token 成本和上下文长度。

### Session 管理

在 `corecoder/session.py` 中实现会话持久化：将消息历史、模型名、保存时间写入 `~/.corecoder/sessions/*.json`，并支持通过 CLI 参数恢复历史会话。保存前会对 session id 做路径安全化处理，避免目录穿越和非法文件名；默认 session id 加入时间戳和随机后缀，避免同秒保存冲突。

### LLM 接入与流式响应

`corecoder/llm.py` 封装 OpenAI-compatible Chat Completions API，支持流式 token 输出、流式 tool call 参数拼接、token 统计、费用估算和瞬时错误重试。对于 Bedrock、Vertex、Cohere 等非 OpenAI-compatible 服务，项目通过 `LiteLLM` 后端统一模型调用接口。

### 子 Agent 隔离执行

`corecoder/tools/agent.py` 实现子 Agent 工具。主 Agent 可为复杂子任务创建独立 `Agent` 实例，子 Agent 拥有独立上下文和工具集合，执行完成后只把摘要结果返回主 Agent。这样可以减少主上下文污染，也便于把代码调研、局部实现等任务隔离处理。

### CLI 与开发者体验

`corecoder/cli.py` 提供交互式 REPL 和一次性 prompt 模式，支持 `/model` 切换模型、`/compact` 手动压缩上下文、`/tokens` 查看 token 与费用、`/diff` 查看本轮修改文件、`/save` 和 `/sessions` 管理会话。CLI 侧使用 Rich 渲染 Markdown 和面板，用 prompt_toolkit 支持历史记录、多行输入和快捷键。

### 安全与可靠性

Shell 工具在 `corecoder/tools/bash.py` 中加入危险命令拦截、超时控制、输出截断和 cwd 追踪，降低 Agent 执行命令时的风险。LLM 调用层对限流、超时、连接错误和 5xx 服务端错误做指数退避重试。测试覆盖工具 schema、bash 安全策略、文件读写编辑、上下文压缩、会话保存恢复和公开 API 导出。

## 项目亮点

- 以极小代码量实现 Coding Agent 的完整核心链路：LLM 推理、工具调用、上下文管理、会话持久化和 CLI 交互。
- 把复杂 Agent 系统拆解为可读、可测试、可扩展的模块，适合二次开发自定义工具、模型后端和记忆策略。
- 支持 OpenAI-compatible 与 LiteLLM 两套模型接入方式，可快速切换 OpenAI、Kimi、DeepSeek、Qwen、Claude、Ollama 等模型。
- 通过并行工具执行、上下文压缩、危险命令拦截和会话恢复，覆盖真实编程 Agent 在长任务执行中的关键工程问题。

## 简历项目写法

**CoreCoder：轻量级 AI Coding Agent 框架**

主导设计并实现一个 Python AI Coding Agent，复现 Claude Code 类工具调用架构，支持多轮 Agent Loop、OpenAI function calling、并行工具执行、上下文压缩、会话持久化、子 Agent 隔离执行和多模型接入。项目内置 bash/read/write/edit/glob/grep 等编程工具，提供 REPL、流式输出、模型切换、token 统计、手动 compact、save/resume 等 CLI 能力，并通过 pytest 覆盖工具系统、上下文管理和会话恢复等核心模块。
