# CoreCoder 速成学习路线：用最短时间掌握完整代码逻辑

这份文档的目标不是介绍 AI Agent 的所有概念，而是帮助你快速读懂这个仓库里 CoreCoder 的完整执行链。读完后，你应该能从一条终端命令一路追到 LLM 调用、工具执行、上下文压缩、会话保存和测试验证，并能解释每个模块为什么存在。

建议学习方式：先按主线通读，再按每个阶段的“动手验证”跑一次。不要一开始就逐行精读所有文件；CoreCoder 的代码很短，真正重要的是先建立调用链。

## 0. 全局地图

先记住这一条主线：

```text
python -m corecoder / corecoder
  -> corecoder.__main__:main()
  -> corecoder.cli:main()
  -> Config.from_env()
  -> LLM 或 LiteLLM
  -> Agent(llm)
  -> Agent.chat(user_input)
  -> llm.chat(messages, tools)
  -> tool_calls?
      -> execute tool(s)
      -> append tool result
      -> maybe_compress()
      -> next LLM round
  -> no tool_calls
      -> return assistant text
```

核心文件按优先级分成四层：

1. 主执行链：[corecoder/__main__.py](../corecoder/__main__.py)、[corecoder/cli.py](../corecoder/cli.py)、[corecoder/agent.py](../corecoder/agent.py)、[corecoder/llm.py](../corecoder/llm.py)
2. Agent 能力层：[corecoder/prompt.py](../corecoder/prompt.py)、[corecoder/tools/__init__.py](../corecoder/tools/__init__.py)、[corecoder/tools/base.py](../corecoder/tools/base.py)
3. 工具实现层：[corecoder/tools/read.py](../corecoder/tools/read.py)、[corecoder/tools/write.py](../corecoder/tools/write.py)、[corecoder/tools/edit.py](../corecoder/tools/edit.py)、[corecoder/tools/bash.py](../corecoder/tools/bash.py)、[corecoder/tools/glob_tool.py](../corecoder/tools/glob_tool.py)、[corecoder/tools/grep.py](../corecoder/tools/grep.py)、[corecoder/tools/agent.py](../corecoder/tools/agent.py)
4. 状态与验证层：[corecoder/context.py](../corecoder/context.py)、[corecoder/session.py](../corecoder/session.py)、[tests/](../tests/)

掌握标准：你能不看 README，自己画出“用户输入 -> LLM -> 工具 -> LLM -> 最终回复”的循环。

## 1. 入口：命令如何进入程序

必读文件：

- [corecoder/__main__.py](../corecoder/__main__.py)
- [corecoder/cli.py](../corecoder/cli.py)
- [pyproject.toml](../pyproject.toml)

先看 [pyproject.toml](../pyproject.toml) 里的脚本入口：

```toml
[project.scripts]
corecoder = "corecoder.cli:main"
```

这说明 `corecoder` 命令会调用 `corecoder.cli.main()`。[corecoder/__main__.py](../corecoder/__main__.py) 则支持 `python -m corecoder`，它也只是导入并调用同一个 `main()`。

[corecoder/cli.py](../corecoder/cli.py) 做四件事：

1. 解析命令行参数：模型、base URL、API key、单次 prompt、恢复 session。
2. 从环境变量加载配置。
3. 初始化 LLM 和 Agent。
4. 进入单次模式 `_run_once()` 或交互式 REPL `_repl()`。

读代码时要回答：

- `-p/--prompt` 和交互式 REPL 的执行路径有什么不同？
- `-r/--resume` 在 Agent 初始化前还是初始化后加载历史？
- `/model`、`/compact`、`/save` 这些命令有没有经过 LLM？

动手验证：

```bash
python -m corecoder --help
python -m corecoder -v
```

掌握标准：你能解释为什么 `/tokens`、`/compact`、`/save` 是 CLI 本地命令，而不是 agent 工具调用。

## 2. 配置：模型和 API 参数从哪里来

必读文件：

- [corecoder/config.py](../corecoder/config.py)
- [corecoder/cli.py](../corecoder/cli.py)

[corecoder/config.py](../corecoder/config.py) 只有一个核心对象：`Config`。它负责把环境变量转成运行时配置。

重点看 `Config.from_env()`：

- 先调用 `_load_dotenv()`，从当前目录或父目录寻找 `.env`。
- API key 依次读取 `CORECODER_API_KEY`、`OPENAI_API_KEY`、`DEEPSEEK_API_KEY`。
- 默认模型是 `gpt-4o`。
- `CORECODER_PROVIDER=litellm` 时，CLI 会选择 `LiteLLM` 后端。

这层的设计很薄：它不理解 agent，也不理解工具，只负责把用户环境变成结构化参数。

读代码时要回答：

- CLI 参数和环境变量谁优先？
- OpenAI-compatible provider 和 LiteLLM provider 的分流发生在哪里？
- `max_context_tokens` 传给了谁？

动手验证：

```bash
CORECODER_MODEL=test-model python -m pytest tests/test_core.py::test_config_from_env
python -m pytest tests/test_core.py::test_config_defaults
```

掌握标准：你能说清楚“模型名、API key、base URL、温度、最大输出 token、最大上下文 token”分别在哪里读取、在哪里使用。

## 3. LLM 层：流式响应和 tool_calls 如何被解析

必读文件：

- [corecoder/llm.py](../corecoder/llm.py)
- [tests/test_litellm.py](../tests/test_litellm.py)

[corecoder/llm.py](../corecoder/llm.py) 是 provider 适配层。它不决定 agent 怎么行动，只负责把消息发给模型，并把流式返回整理成 `LLMResponse`。

核心数据结构：

- `ToolCall`：保存工具调用的 `id`、`name`、`arguments`。
- `LLMResponse`：保存文本内容、工具调用列表、token 用量。
- `LLM`：OpenAI-compatible API 后端。
- `LiteLLM`：通过 LiteLLM 接入非 OpenAI-compatible provider。

最重要的方法是 `LLM.chat()`：

1. 组装 OpenAI Chat Completions 参数。
2. 如果有工具 schema，就传入 `tools`。
3. 开启流式请求。
4. 边读 chunk 边收集文本 token。
5. 边读 chunk 边拼接 `tool_calls` 的 JSON 参数。
6. 解析工具参数，返回 `LLMResponse`。

注意一个关键点：模型的工具调用参数不是一次性完整返回的，而是可能分散在多个流式 chunk 里。所以代码用 `tc_map` 按 index 累积 `id/name/args`，最后再 `json.loads()`。

读代码时要回答：

- `on_token` 是在哪里被调用的？
- token 用量为什么可能是 0？
- tool call 参数 JSON 解析失败时会发生什么？
- `LLMResponse.message` 为什么要转换回 OpenAI message 格式？

动手验证：

```bash
python -m pytest tests/test_litellm.py
python -m pytest tests/test_core.py::test_cost_estimation_known_model
```

掌握标准：你能解释“流式文本”和“流式工具调用参数”是如何分别累积的。

## 4. Agent 主循环：CoreCoder 的心脏

必读文件：

- [corecoder/agent.py](../corecoder/agent.py)
- [corecoder/prompt.py](../corecoder/prompt.py)
- [corecoder/tools/__init__.py](../corecoder/tools/__init__.py)

[corecoder/agent.py](../corecoder/agent.py) 是整个项目最重要的文件。它实现了 coding agent 的最小闭环：

```text
用户消息
  -> 加入 self.messages
  -> 可能压缩上下文
  -> 调 LLM
  -> 如果没有工具调用，保存回复并返回
  -> 如果有工具调用，执行工具
  -> 把工具结果加入 messages
  -> 再次调 LLM
```

`Agent.__init__()` 做三件关键事：

1. 保存 LLM、工具列表、上下文管理器、最大轮数。
2. 用 [corecoder/prompt.py](../corecoder/prompt.py) 生成动态 system prompt。
3. 给 `AgentTool` 注入父 agent，支持子代理。

`Agent.chat()` 是主循环。它的停止条件是：模型返回了纯文本，没有 `tool_calls`。只要模型继续要求工具，循环就继续，直到 `max_rounds`。

工具执行有两条路径：

- 单工具：直接 `_exec_tool()`。
- 多工具：`_exec_tools_parallel()` 用 `ThreadPoolExecutor` 并行执行。

读代码时要回答：

- system prompt 是否会进入 `self.messages`？
- 工具异常为什么不会直接抛出？
- 工具结果在 messages 里是什么 role？
- 多个工具并行执行后，结果顺序如何保持？
- 为什么需要 `max_rounds`？

动手验证：

```bash
python -m pytest tests/test_core.py::test_public_api_exports
python -m pytest tests/test_tools.py::test_tool_count
```

掌握标准：你能手写一个极简伪代码版 `Agent.chat()`，并准确说明每次循环向 `self.messages` 追加了什么。

## 5. Prompt 层：LLM 为什么知道自己能做什么

必读文件：

- [corecoder/prompt.py](../corecoder/prompt.py)
- [corecoder/tools/base.py](../corecoder/tools/base.py)
- [corecoder/tools/__init__.py](../corecoder/tools/__init__.py)

[corecoder/prompt.py](../corecoder/prompt.py) 负责生成 system prompt。它把当前工作目录、操作系统、Python 版本和工具描述拼到提示词里。

工具描述来自每个工具对象的 `name` 和 `description`。工具的机器可调用 schema 则来自 `Tool.schema()`。

这里要区分两件事：

- system prompt 里的工具列表：给模型看的自然语言说明。
- API 参数里的 tools schema：给模型生成 function call 用的 JSON Schema。

两者缺一不可：只有自然语言说明，模型无法结构化调用；只有 JSON Schema，模型缺少使用习惯和约束。

读代码时要回答：

- `Tool.schema()` 输出的格式和 OpenAI function calling 有什么关系？
- `prompt.py` 里有哪些行为约束？
- “Read before edit” 是强制机制还是 prompt 约束？

动手验证：

```bash
python -m pytest tests/test_tools.py::test_all_tools_have_valid_schema
```

掌握标准：你能解释 `description`、`parameters`、`system_prompt()` 三者分别影响模型行为的哪一部分。

## 6. 工具系统：七个工具如何被统一管理

必读文件：

- [corecoder/tools/base.py](../corecoder/tools/base.py)
- [corecoder/tools/__init__.py](../corecoder/tools/__init__.py)
- [tests/test_tools.py](../tests/test_tools.py)

工具系统的抽象非常小：每个工具继承 `Tool`，声明三个字段和一个方法：

```python
name: str
description: str
parameters: dict
execute(**kwargs) -> str
```

[corecoder/tools/__init__.py](../corecoder/tools/__init__.py) 维护全局工具注册表 `ALL_TOOLS`，并提供 `get_tool(name)`。Agent 执行工具时并不直接 import 某个工具文件，而是通过工具名查表。

七个内置工具：

1. `bash`：执行 shell 命令。
2. `read_file`：带行号读取文件。
3. `write_file`：创建或覆盖文件。
4. `edit_file`：唯一字符串搜索替换。
5. `glob`：按 glob 找文件。
6. `grep`：按正则搜内容。
7. `agent`：启动子代理。

读代码时要回答：

- 新增一个工具最少需要改哪些地方？
- 工具参数校验主要依赖谁？
- `get_tool()` 找不到工具时，Agent 如何处理？

动手验证：

```bash
python -m pytest tests/test_tools.py::test_all_tools_have_valid_schema
python -m pytest tests/test_tools.py::test_tool_count
```

掌握标准：你能新增一个只返回当前时间的 toy tool，并说出它如何进入 system prompt 和 API tools schema。

## 7. 文件工具：读、写、改的安全边界

必读文件：

- [corecoder/tools/read.py](../corecoder/tools/read.py)
- [corecoder/tools/write.py](../corecoder/tools/write.py)
- [corecoder/tools/edit.py](../corecoder/tools/edit.py)

这三个工具构成 coding agent 的文件操作核心。

`read_file`：

- 解析路径并确认文件存在。
- 带行号返回内容。
- 支持 `offset` 和 `limit`。
- 用 `errors="replace"` 避免非 UTF-8 内容直接崩溃。

`write_file`：

- 创建父目录。
- 写入完整内容。
- 把文件加入 `_changed_files`，供 `/diff` 命令查看。

`edit_file`：

- 要求 `old_string` 在文件里出现且只出现一次。
- 用 `str.replace(..., 1)` 做替换。
- 生成 unified diff。
- 记录改动文件。

`edit_file` 是最值得细读的工具，因为它体现了 coding agent 的安全编辑思想：不让模型按行号猜，也不让模型整文件重写，而是要求模型提供唯一匹配的上下文。

读代码时要回答：

- `edit_file` 为什么要求 old_string 唯一？
- `write_file` 为什么不生成 diff？
- `_changed_files` 放在 `edit.py`，为什么 `write.py` 也 import 它？
- `/diff` 实际展示的是完整 diff 还是文件列表？

动手验证：

```bash
python -m pytest tests/test_tools.py::test_read_file
python -m pytest tests/test_tools.py::test_write_file
python -m pytest tests/test_tools.py::test_edit_file_basic
python -m pytest tests/test_tools.py::test_edit_file_duplicate_string
```

掌握标准：你能解释 CoreCoder 为什么偏好 `edit_file` 而不是 `write_file`。

## 8. Bash 工具：执行命令但挡住危险操作

必读文件：

- [corecoder/tools/bash.py](../corecoder/tools/bash.py)
- [tests/test_tools.py](../tests/test_tools.py)

`BashTool` 做四件事：

1. 用正则拦截危险命令。
2. 用 `subprocess.run()` 执行 shell 命令。
3. 捕获 stdout、stderr、exit code。
4. 截断超长输出，保留头尾。

它还维护了一个模块级 `_cwd`，通过 `_update_cwd()` 追踪成功执行的 `cd` 命令。这样下一次 bash 工具调用可以沿用新的工作目录。

需要注意：危险命令拦截是启发式正则，不是完整沙箱。它能挡住明显的 `rm -rf /`、fork bomb、`curl | bash`，但不能替代真实权限隔离。

读代码时要回答：

- 哪些命令会被 `_check_dangerous()` 拦截？
- 命令超时会返回什么？
- `stderr` 如何拼进结果？
- `cd` 追踪在哪些情况下不会生效？

动手验证：

```bash
python -m pytest tests/test_tools.py::test_bash_basic
python -m pytest tests/test_tools.py::test_bash_blocks_rm_rf
python -m pytest tests/test_tools.py::test_bash_timeout
python -m pytest tests/test_tools.py::test_bash_truncates_long_output
```

掌握标准：你能说清楚 BashTool 的安全边界：它提供的是危险模式拦截和输出控制，不是强隔离执行环境。

## 9. 搜索工具：Agent 如何定位文件和代码

必读文件：

- [corecoder/tools/glob_tool.py](../corecoder/tools/glob_tool.py)
- [corecoder/tools/grep.py](../corecoder/tools/grep.py)

`glob` 负责按文件名或路径模式找文件。它使用 `Path.glob()`，支持 `**/*.py` 这类递归模式，并按修改时间倒序返回最多 100 个结果。

`grep` 负责搜文件内容。它支持正则，能在单文件或目录里搜索，并跳过 `.git`、`node_modules`、`__pycache__`、虚拟环境和构建目录。

这两个工具配合 `read_file` 使用：

```text
不知道文件在哪
  -> glob / grep
  -> read_file
  -> edit_file
```

读代码时要回答：

- `glob` 和 `grep` 的结果为什么都有限制？
- `grep` 的 include 参数在哪里生效？
- `grep` 遇到非法正则会抛异常还是返回错误字符串？

动手验证：

```bash
python -m pytest tests/test_tools.py::test_glob_finds_files
python -m pytest tests/test_tools.py::test_grep_finds_pattern
python -m pytest tests/test_tools.py::test_grep_invalid_regex
```

掌握标准：你能解释一个 coding agent 为什么需要“文件名搜索”和“内容搜索”两个不同工具。

## 10. 子代理：独立上下文的小型委托

必读文件：

- [corecoder/tools/agent.py](../corecoder/tools/agent.py)
- [corecoder/agent.py](../corecoder/agent.py)

`AgentTool` 的思想是：复杂子任务可以用一个新的 Agent 处理，避免污染主 Agent 的上下文。

执行过程：

1. `Agent.__init__()` 遍历工具列表，如果发现 `AgentTool`，就把父 agent 注入 `_parent_agent`。
2. `AgentTool.execute(task)` 新建一个子 `Agent`。
3. 子 Agent 复用父 Agent 的 LLM。
4. 子 Agent 拿到除 `agent` 以外的工具，避免递归创建子代理。
5. 子 Agent 独立运行 `sub.chat(task)`。
6. 返回结果太长时截断到约 5000 字符以内。

这不是多进程，也不是多线程后台任务，而是“在同一个进程里新建一个独立消息历史的 Agent”。

读代码时要回答：

- 子 Agent 和父 Agent 共享什么，不共享什么？
- 为什么子 Agent 的工具列表要移除 `agent`？
- 子 Agent 结果为什么要截断？

动手验证：

```bash
python -m pytest tests/test_tools.py::test_agent_tool_schema
```

掌握标准：你能解释 `AgentTool` 的核心价值是上下文隔离，而不是并发加速。

## 11. 上下文压缩：长任务为什么不会无限膨胀

必读文件：

- [corecoder/context.py](../corecoder/context.py)
- [corecoder/agent.py](../corecoder/agent.py)

[corecoder/context.py](../corecoder/context.py) 负责控制 `self.messages` 的长度。它有三层压缩：

1. `tool_snip`：工具输出太长时，保留前 3 行和后 3 行。
2. `summarize`：对旧消息做 LLM 摘要，只保留最近若干条原始消息。
3. `hard_collapse`：最后兜底，把更早历史压成一段总结。

触发阈值来自 `max_tokens`：

- 50%：裁剪工具输出。
- 70%：摘要旧对话。
- 90%：硬折叠。

Agent 在两个位置调用 `maybe_compress()`：

1. 用户消息刚加入后。
2. 工具结果加入后。

这样既能避免一开始就超上下文，也能处理工具输出突然变大的情况。

读代码时要回答：

- token 估算为什么只是近似？
- `_summarize_old()` 为什么保留 recent tail？
- LLM 摘要失败时 fallback 做了什么？
- hard collapse 会丢失哪些信息？

动手验证：

```bash
python -m pytest tests/test_core.py::test_estimate_tokens
python -m pytest tests/test_core.py::test_context_snip
python -m pytest tests/test_core.py::test_context_compress
```

掌握标准：你能说清楚 CoreCoder 的压缩不是简单截断，而是先裁工具噪声，再摘要历史，最后才强制折叠。

## 12. 会话保存恢复：消息历史如何落盘

必读文件：

- [corecoder/session.py](../corecoder/session.py)
- [corecoder/cli.py](../corecoder/cli.py)
- [tests/test_session.py](../tests/test_session.py)

[corecoder/session.py](../corecoder/session.py) 负责把对话历史保存为 JSON 文件。保存目录是：

```text
~/.corecoder/sessions
```

保存的数据包括：

- session id
- model
- saved_at
- messages

安全点在 `_normalize_session_id()` 和 `_session_path()`：

- 去掉路径分隔符，只保留文件名部分。
- 把非法字符替换成 `-`。
- resolve 后确认文件仍然在 sessions 目录下。

CLI 里的 `/save` 调用 `save_session()`，`-r/--resume` 调用 `load_session()` 并把 messages 放回 `agent.messages`。

读代码时要回答：

- 默认 session id 如何避免碰撞？
- 恢复 session 时，模型名来自 CLI 还是 session 文件？
- 为什么要防止 `../` 这种 session id？

动手验证：

```bash
python -m pytest tests/test_core.py::test_session_save_load
python -m pytest tests/test_core.py::test_session_name_is_sanitized
python -m pytest tests/test_session.py
```

掌握标准：你能解释“恢复会话”本质上就是恢复 messages 和 model，不涉及隐藏的数据库状态。

## 13. CLI 命令：哪些功能绕过 LLM

必读文件：

- [corecoder/cli.py](../corecoder/cli.py)
- [corecoder/tools/edit.py](../corecoder/tools/edit.py)
- [corecoder/context.py](../corecoder/context.py)
- [corecoder/session.py](../corecoder/session.py)

交互式 REPL 中，很多以 `/` 开头的命令不会进入 Agent：

- `/help`：打印帮助。
- `/reset`：清空 `agent.messages`。
- `/tokens`：读取 LLM token 计数。
- `/model`：查看或切换当前模型名。
- `/compact`：手动触发上下文压缩。
- `/diff`：列出本会话被工具修改过的文件。
- `/save`：保存会话。
- `/sessions`：列出历史会话。

这些命令是 CLI 控制面，和 agent 工具面不同。工具面由 LLM 发起，控制面由用户直接发起。

读代码时要回答：

- `/compact` 调用的是哪一个压缩方法？
- `/diff` 为什么只能列文件，不能展示完整 git diff？
- `/model` 改模型会不会重建 LLM client？
- `/reset` 会不会清空 token 计数？

动手验证：

```bash
python -m corecoder --help
```

如果你有 API key，可以进入 REPL 后手动试：

```text
/help
/tokens
/compact
/save
/sessions
```

掌握标准：你能区分 CoreCoder 的“用户控制命令”和“LLM 可调用工具”。

## 14. 测试：用测试反推设计边界

必读目录：

- [tests/test_core.py](../tests/test_core.py)
- [tests/test_tools.py](../tests/test_tools.py)
- [tests/test_litellm.py](../tests/test_litellm.py)
- [tests/test_session.py](../tests/test_session.py)

测试文件是理解边界的最快方式：

- `test_core.py` 覆盖公开 API、配置、上下文、会话、费用估算、改动文件追踪。
- `test_tools.py` 覆盖七个工具的 schema、正常路径、错误路径和安全拦截。
- `test_litellm.py` 用 fake streaming response 测 LiteLLM，不需要真实 API。
- `test_session.py` 专门验证默认 session id 不碰撞。

推荐最后跑全量测试：

```bash
python -m pytest
```

如果本机没有安装 dev 依赖：

```bash
python -m pip install -e '.[dev]'
python -m pytest
```

掌握标准：你能从测试说出项目最关心的稳定性边界：工具 schema、危险命令拦截、上下文压缩、session id 安全、LiteLLM provider 适配。

## 15. 半天速成学习安排

如果你只有 4-6 小时，按这个顺序读：

### 第 1 小时：跑起来并建立主线

读：

- [README_CN.md](../README_CN.md)
- [corecoder/__main__.py](../corecoder/__main__.py)
- [corecoder/cli.py](../corecoder/cli.py)
- [corecoder/config.py](../corecoder/config.py)

目标：知道命令如何进入程序，配置如何进入 LLM 和 Agent。

### 第 2 小时：读懂 Agent loop

读：

- [corecoder/agent.py](../corecoder/agent.py)
- [corecoder/llm.py](../corecoder/llm.py)
- [corecoder/prompt.py](../corecoder/prompt.py)

目标：能解释 `Agent.chat()` 的每一轮循环。

### 第 3 小时：读懂工具系统

读：

- [corecoder/tools/base.py](../corecoder/tools/base.py)
- [corecoder/tools/__init__.py](../corecoder/tools/__init__.py)
- [corecoder/tools/read.py](../corecoder/tools/read.py)
- [corecoder/tools/edit.py](../corecoder/tools/edit.py)
- [corecoder/tools/bash.py](../corecoder/tools/bash.py)

目标：能解释工具 schema、工具查找、工具执行、错误返回。

### 第 4 小时：读懂状态管理

读：

- [corecoder/context.py](../corecoder/context.py)
- [corecoder/session.py](../corecoder/session.py)
- [corecoder/cli.py](../corecoder/cli.py) 里的 `/compact`、`/save`、`/sessions`

目标：能解释长对话如何压缩，会话如何保存恢复。

### 第 5-6 小时：用测试查漏补缺

读并运行：

- [tests/test_core.py](../tests/test_core.py)
- [tests/test_tools.py](../tests/test_tools.py)
- [tests/test_litellm.py](../tests/test_litellm.py)
- [tests/test_session.py](../tests/test_session.py)

目标：把每个设计边界对应到一个测试。

## 16. 最终掌握检查清单

当你能回答下面这些问题，就基本掌握了 CoreCoder 的完整代码逻辑：

- `corecoder` 命令如何找到 `corecoder.cli:main`？
- CLI 参数、环境变量、`.env` 的优先级是什么？
- `Agent.chat()` 什么时候继续循环，什么时候返回？
- system prompt 和 tools schema 分别在哪里生成？
- LLM 流式返回的文本和 tool calls 如何被累积？
- 工具异常为什么变成字符串返回给 LLM？
- `edit_file` 如何保证编辑不歧义？
- `bash` 如何拦截危险命令和截断长输出？
- `glob`、`grep`、`read_file` 在定位代码时如何配合？
- 子 Agent 为什么能隔离上下文？
- 上下文压缩的三层策略分别处理什么问题？
- `/compact`、`/save`、`/tokens` 为什么不经过 LLM？
- session id 为什么要 sanitize？
- 全量测试分别覆盖了哪些设计边界？

## 17. 一句话总结源码逻辑

CoreCoder 是一个最小可运行 coding agent runtime：CLI 收集用户输入和本地命令，Agent 维护消息历史并循环调用 LLM，LLM 层把流式文本和工具调用解析成统一响应，工具系统把文件、搜索、命令和子代理封装成 JSON Schema 可调用能力，ContextManager 控制长对话成本，Session 模块把消息历史安全落盘。

真正要记住的是这条闭环：

```text
messages + system prompt + tool schemas
  -> LLM stream
  -> text or tool calls
  -> tool results become messages
  -> context may compress
  -> repeat until final text
```
