# CoreCoder 新手源码讲解：从零读懂完整代码逻辑

这份文档写给“完全看不懂代码，但想读懂 CoreCoder”的学习者。它不会假设你已经熟悉 Agent、OpenAI tool calling、Python 包结构或异步流式输出。目标是把这个项目的每个关键文件、关键对象、关键数据流都解释清楚。

你可以把前一份 [速成学习路线](corecoder-learning-roadmap.md) 当作阅读顺序，把本文当作逐步讲义。路线告诉你先看什么，本文告诉你每段代码是什么意思。

## 0. 先建立一个最小心智模型

CoreCoder 本质上是一个命令行里的 AI 编程助手。它做的事情可以压缩成一句话：

```text
用户输入一句话
  -> 程序把这句话发给大模型
  -> 大模型如果要读文件/改文件/跑命令，就返回 tool call
  -> 程序执行 tool call
  -> 把工具结果再发回大模型
  -> 大模型继续判断是否还要工具
  -> 最后返回一段文字给用户
```

这个循环就是 Agent 的核心。CoreCoder 的代码很短，但它覆盖了一个 coding agent 最关键的骨架：

- 命令行入口：[corecoder/cli.py](../corecoder/cli.py)
- 配置读取：[corecoder/config.py](../corecoder/config.py)
- LLM 调用和流式解析：[corecoder/llm.py](../corecoder/llm.py)
- Agent 主循环：[corecoder/agent.py](../corecoder/agent.py)
- 工具系统：[corecoder/tools/](../corecoder/tools/)
- 上下文压缩：[corecoder/context.py](../corecoder/context.py)
- 会话保存：[corecoder/session.py](../corecoder/session.py)
- 测试：[tests/](../tests/)

如果你是新手，不要先追求“每一行都背下来”。你应该先理解两个问题：

1. 数据怎么流动？
2. 每个文件在这条数据流里负责什么？

## 1. 读代码前必须懂的 Python 基础词

这一节不是 Python 教程，只解释读 CoreCoder 时会反复出现的概念。

### 1.1 模块和包

一个 `.py` 文件通常叫一个模块。一个包含 `__init__.py` 的目录通常可以作为包导入。

这个项目里：

```text
corecoder/
  __init__.py
  cli.py
  agent.py
  llm.py
  ...
```

`corecoder` 是包，`corecoder.cli` 是模块，`corecoder.agent` 也是模块。

当代码写：

```python
from .agent import Agent
```

意思是：从当前包 `corecoder` 里的 `agent.py` 文件导入 `Agent`。

### 1.2 类和对象

类是模板，对象是模板创建出来的实例。

例如 [corecoder/agent.py](../corecoder/agent.py) 里定义了：

```python
class Agent:
    ...
```

CLI 里会创建它：

```python
agent = Agent(llm=llm, max_context_tokens=config.max_context_tokens)
```

这里 `Agent` 是类，`agent` 是对象。对象会保存自己的状态，比如：

- `agent.messages`
- `agent.llm`
- `agent.context`

### 1.3 函数和方法

普通函数可以直接调用：

```python
Config.from_env()
```

对象里的函数叫方法：

```python
agent.chat(user_input)
```

`chat()` 是 `Agent` 对象的方法。它能访问 `self.messages`、`self.llm` 这些对象内部状态。

### 1.4 字典和列表

CoreCoder 的消息历史是一个列表，列表里每一项是字典。

大致长这样：

```python
[
    {"role": "user", "content": "帮我读 README"},
    {"role": "assistant", "content": None, "tool_calls": [...]},
    {"role": "tool", "tool_call_id": "abc", "content": "README 内容..."},
    {"role": "assistant", "content": "README 主要讲..."},
]
```

理解这个结构很重要，因为 Agent 的状态主要就是 `messages`。

### 1.5 dataclass

[corecoder/llm.py](../corecoder/llm.py) 里有：

```python
@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict
```

`@dataclass` 是 Python 帮你自动生成初始化方法的语法。你可以把它理解为“轻量数据容器”。

创建时大概等价于：

```python
ToolCall(id="call_1", name="read_file", arguments={"file_path": "README.md"})
```

### 1.6 回调函数 callback

CLI 调 Agent 时会传两个回调：

```python
agent.chat(prompt, on_token=on_token, on_tool=on_tool)
```

回调就是“把一个函数传给另一个函数，让对方在合适的时候调用它”。

在 CoreCoder 里：

- `on_token`：模型每吐出一小段文本，就打印到终端。
- `on_tool`：模型准备调用工具时，在终端显示工具名和参数。

### 1.7 try/except

很多代码长这样：

```python
try:
    ...
except Exception as e:
    return f"Error: {e}"
```

意思是：如果中间出错，不让程序崩溃，而是把错误变成字符串返回。

这对 Agent 很重要。工具失败后，错误字符串会被送回 LLM，LLM 可以自己调整策略。

## 2. 项目结构怎么读

先看项目文件：

```text
corecoder/
  __main__.py       python -m corecoder 的入口
  __init__.py       包对外暴露哪些对象
  cli.py            命令行界面和 REPL
  config.py         环境变量配置
  llm.py            LLM 调用、流式解析、tool call 解析
  agent.py          Agent 主循环
  prompt.py         system prompt 生成
  context.py        上下文压缩
  session.py        会话保存和恢复
  tools/
    base.py         所有工具的基类
    __init__.py     工具注册表
    read.py         读文件
    write.py        写文件
    edit.py         搜索替换编辑
    bash.py         执行命令
    glob_tool.py    文件名搜索
    grep.py         内容搜索
    agent.py        子代理
```

这个项目的核心不是“文件很多”，而是“分层清楚”：

```text
CLI 层：接收用户输入
  -> Agent 层：维护消息历史和循环
  -> LLM 层：调用模型，解析模型响应
  -> Tools 层：实际读文件、改文件、跑命令
  -> Context/Session 层：处理长对话和保存恢复
```

你读源码时，要不断问自己：当前文件属于哪一层？

## 3. 程序从哪里启动

相关文件：

- [pyproject.toml](../pyproject.toml)
- [corecoder/__main__.py](../corecoder/__main__.py)
- [corecoder/__init__.py](../corecoder/__init__.py)
- [corecoder/cli.py](../corecoder/cli.py)

### 3.1 `corecoder` 命令为什么能运行

[pyproject.toml](../pyproject.toml) 里有：

```toml
[project.scripts]
corecoder = "corecoder.cli:main"
```

这句话告诉 Python 打包系统：安装这个包后，创建一个命令叫 `corecoder`，它执行 `corecoder.cli` 模块里的 `main()` 函数。

所以当你在终端输入：

```bash
corecoder
```

真实入口是：

```python
corecoder.cli.main()
```

### 3.2 `python -m corecoder` 为什么能运行

[corecoder/__main__.py](../corecoder/__main__.py) 只有两行：

```python
from corecoder.cli import main

main()
```

当你执行：

```bash
python -m corecoder
```

Python 会寻找 `corecoder/__main__.py` 并运行它。这个文件又去调用 `corecoder.cli.main()`。

所以两种启动方式最终都会进入同一个函数。

### 3.3 `__init__.py` 有什么用

[corecoder/__init__.py](../corecoder/__init__.py) 里有：

```python
__version__ = "0.3.0"

from corecoder.agent import Agent
from corecoder.llm import LLM
from corecoder.config import Config
from corecoder.tools import ALL_TOOLS

__all__ = ["Agent", "LLM", "Config", "ALL_TOOLS", "__version__"]
```

这让别人可以这样导入：

```python
from corecoder import Agent, LLM, Config
```

而不需要写：

```python
from corecoder.agent import Agent
from corecoder.llm import LLM
from corecoder.config import Config
```

这叫“包的公共 API”。测试里也会检查这些对象能不能从顶层包导入。

## 4. CLI：用户输入如何变成 Agent 调用

核心文件：[corecoder/cli.py](../corecoder/cli.py)

这个文件比较长，但可以分成四块：

1. 解析启动参数。
2. 初始化配置、LLM、Agent。
3. 单次模式。
4. 交互式 REPL。

### 4.1 解析启动参数

`_parse_args()` 使用 Python 标准库 `argparse`：

```python
def _parse_args():
    p = argparse.ArgumentParser(...)
    p.add_argument("-m", "--model", ...)
    p.add_argument("--base-url", ...)
    p.add_argument("--api-key", ...)
    p.add_argument("-p", "--prompt", ...)
    p.add_argument("-r", "--resume", ...)
    p.add_argument("-v", "--version", ...)
    return p.parse_args()
```

你可以把它理解成：把终端命令里的参数变成一个 Python 对象 `args`。

例如：

```bash
corecoder -m gpt-5 -p "解释 README"
```

会得到类似：

```python
args.model == "gpt-5"
args.prompt == "解释 README"
```

### 4.2 `main()` 的初始化流程

`main()` 的主要逻辑是：

```python
args = _parse_args()
config = Config.from_env()
```

先解析 CLI 参数，再读环境变量配置。

然后 CLI 参数覆盖环境变量：

```python
if args.model:
    config.model = args.model
if args.base_url:
    config.base_url = args.base_url
if args.api_key:
    config.api_key = args.api_key
```

新手要注意：这就是“优先级”。如果环境变量里是 `gpt-4o`，但你命令行传了 `-m kimi-k2.5`，最终用命令行里的模型。

### 4.3 没有 API key 就退出

代码：

```python
if not config.api_key:
    console.print("[red bold]No API key found.[/]")
    ...
    sys.exit(1)
```

意思是：没有 API key 就无法调用模型，所以直接打印提示并退出。

`sys.exit(1)` 的 `1` 通常表示异常退出。

### 4.4 选择 LLM 后端

代码：

```python
llm_cls = LiteLLM if config.provider == "litellm" else LLM
llm = llm_cls(...)
```

这是一种常见写法：先选择类，再创建对象。

如果：

```bash
CORECODER_PROVIDER=litellm
```

就用 `LiteLLM`。否则默认用 `LLM`。

### 4.5 创建 Agent

代码：

```python
agent = Agent(llm=llm, max_context_tokens=config.max_context_tokens)
```

这一步把 LLM 交给 Agent。之后用户输入不会直接发给 `llm.chat()`，而是先进入 `agent.chat()`。

为什么要多一层 Agent？

因为 LLM 只会“生成回复或工具调用”，但 Agent 要负责：

- 保存消息历史。
- 组装 system prompt。
- 提供工具 schema。
- 执行工具。
- 把工具结果送回 LLM。
- 控制最大循环轮数。
- 压缩上下文。

### 4.6 resume 恢复会话

代码：

```python
if args.resume:
    loaded = load_session(args.resume)
    if loaded:
        agent.messages, loaded_model = loaded
```

`load_session()` 返回两样东西：

1. 之前保存的消息列表。
2. 当时使用的模型名。

恢复会话本质上就是恢复 `agent.messages`。

### 4.7 单次模式和 REPL 模式

代码：

```python
if args.prompt:
    _run_once(agent, args.prompt)
    return

_repl(agent, config)
```

如果用户传了 `-p`，就只运行一次：

```bash
corecoder -p "解释 README"
```

如果没有传 `-p`，就进入交互式循环：

```text
You >
```

### 4.8 `_run_once()` 做什么

```python
def _run_once(agent: Agent, prompt: str):
    def on_token(tok):
        print(tok, end="", flush=True)

    def on_tool(name, kwargs):
        console.print(f"\n[dim]> {name}({_brief(kwargs)})[/dim]")

    agent.chat(prompt, on_token=on_token, on_tool=on_tool)
    print()
```

它定义了两个回调：

- 模型吐字时直接打印。
- 模型调用工具时打印工具调用信息。

然后调用：

```python
agent.chat(...)
```

这里就是 CLI 层进入 Agent 层的地方。

### 4.9 REPL 的本地命令

`_repl()` 里有一个无限循环：

```python
while True:
    user_input = pt_prompt(...).strip()
```

每次读取用户输入后，先判断是不是本地命令：

```python
if user_input == "/help":
    _show_help()
    continue
if user_input == "/reset":
    agent.reset()
    continue
...
```

这里的 `continue` 很重要。它表示这次循环到此结束，回到下一轮输入。

也就是说：

- `/help` 不会发给 LLM。
- `/reset` 不会发给 LLM。
- `/tokens` 不会发给 LLM。
- `/save` 不会发给 LLM。

只有不是本地命令的普通输入，才会执行：

```python
response = agent.chat(user_input, on_token=on_token, on_tool=on_tool)
```

### 4.10 CLI 层小结

CLI 层不负责“智能”。它负责：

- 读命令行参数。
- 读用户输入。
- 打印输出。
- 处理 `/` 开头的本地命令。
- 把普通用户请求交给 Agent。

## 5. Config：环境变量如何变成配置对象

核心文件：[corecoder/config.py](../corecoder/config.py)

### 5.1 `Config` 是一个数据容器

代码：

```python
@dataclass
class Config:
    model: str = "gpt-4o"
    api_key: str = ""
    base_url: str | None = None
    max_tokens: int = 4096
    temperature: float = 0.0
    max_context_tokens: int = 128_000
    provider: str = "openai"
```

这表示配置对象有这些字段。

如果什么环境变量都不设置，默认：

- 模型：`gpt-4o`
- 输出 token 上限：`4096`
- 温度：`0.0`
- 上下文 token 上限：`128000`
- provider：`openai`

### 5.2 `.env` 如何加载

`_load_dotenv()` 的作用是尝试读取 `.env` 文件：

```python
from dotenv import load_dotenv
...
load_dotenv(env_path, override=False)
```

`override=False` 表示：如果系统环境变量已经有值，`.env` 不覆盖它。

这也是一种优先级设计：

```text
真实环境变量 > .env 文件 > 默认值
```

### 5.3 API key 的读取顺序

代码：

```python
api_key = (
    os.getenv("CORECODER_API_KEY")
    or os.getenv("OPENAI_API_KEY")
    or os.getenv("DEEPSEEK_API_KEY")
    or ""
)
```

`or` 在这里的含义是“从左到右找第一个非空值”。

所以 API key 优先级是：

```text
CORECODER_API_KEY
  -> OPENAI_API_KEY
  -> DEEPSEEK_API_KEY
  -> 空字符串
```

### 5.4 Config 层小结

Config 不知道 Agent，也不调用模型。它只负责一件事：

```text
把外部配置来源变成一个 Config 对象
```

这是很好的工程边界。以后如果你要加配置项，也应该先放在这里，再由 CLI 传给真正需要它的模块。

## 6. Prompt：模型为什么知道自己是什么

核心文件：[corecoder/prompt.py](../corecoder/prompt.py)

### 6.1 system prompt 是什么

大模型每次对话一般有几类消息：

- system：系统指令，告诉模型角色和规则。
- user：用户输入。
- assistant：模型回复。
- tool：工具结果。

CoreCoder 的 system prompt 由 `system_prompt(tools)` 生成。

### 6.2 prompt 里放了什么

代码：

```python
cwd = os.getcwd()
tool_list = "\n".join(f"- **{t.name}**: {t.description}" for t in tools)
uname = platform.uname()
```

它收集：

- 当前工作目录。
- 操作系统信息。
- Python 版本。
- 工具名字和描述。

然后拼成一段长字符串：

```python
return f"""\
You are CoreCoder, an AI coding assistant running in the user's terminal.
...
# Tools
{tool_list}
...
"""
```

### 6.3 prompt 规则是约束，不是强制

里面有这些规则：

```text
Read before edit.
edit_file for small changes.
Verify your work.
Be concise.
One step at a time.
```

新手容易误解：这些规则不是 Python 强制执行的逻辑，而是写给模型看的指令。

例如“Read before edit”并没有在 `edit_file` 里检查“你是否读过文件”。它依赖模型遵守 system prompt。

### 6.4 Prompt 层小结

Prompt 层负责把程序环境和行为规则告诉模型。它不执行工具，也不保存消息。

## 7. LLM：如何调用模型并解析流式响应

核心文件：[corecoder/llm.py](../corecoder/llm.py)

这是新手最容易害怕的文件。你可以把它分成四块：

1. 数据结构。
2. 价格估算。
3. OpenAI-compatible 后端。
4. LiteLLM 后端。

### 7.1 `ToolCall` 表示一次工具调用

代码：

```python
@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict
```

如果模型想读文件，它可能产生：

```python
ToolCall(
    id="call_abc",
    name="read_file",
    arguments={"file_path": "README.md"}
)
```

这里：

- `id`：模型给这次工具调用的编号。
- `name`：工具名。
- `arguments`：工具参数。

### 7.2 `LLMResponse` 表示一次模型返回

代码：

```python
@dataclass
class LLMResponse:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
```

一次模型响应可能有两种情况：

纯文本：

```python
LLMResponse(content="这个项目是...", tool_calls=[])
```

工具调用：

```python
LLMResponse(
    content="",
    tool_calls=[ToolCall(...)]
)
```

### 7.3 `LLMResponse.message` 为什么存在

代码：

```python
@property
def message(self) -> dict:
    msg: dict = {"role": "assistant", "content": self.content or None}
    if self.tool_calls:
        msg["tool_calls"] = [...]
    return msg
```

Agent 需要把模型的响应追加到 `self.messages` 里。但 `self.messages` 要用 OpenAI 的 message 格式。

所以 `LLMResponse.message` 的作用是：

```text
把内部对象 LLMResponse
转换成 OpenAI message 字典
```

### 7.4 费用估算

`_PRICING` 保存不同模型的输入/输出价格。

`estimated_cost` 逻辑：

```python
pricing = _PRICING.get(self.model)
if not pricing:
    return None
...
return prompt_cost + completion_cost
```

如果模型不在价格表里，就返回 `None`。所以 `/tokens` 可能只显示 token，不显示美元估算。

### 7.5 `LLM.__init__()`

代码：

```python
self.model = model
self.client = OpenAI(api_key=api_key, base_url=base_url)
self.extra = kwargs
self.total_prompt_tokens = 0
self.total_completion_tokens = 0
```

这里创建了 OpenAI SDK 客户端。`base_url` 可以让它连接 DeepSeek、Kimi、Qwen、Ollama 等 OpenAI-compatible 服务。

`self.extra` 保存额外参数，例如：

- `temperature`
- `max_tokens`

### 7.6 `LLM.chat()` 的输入

签名：

```python
def chat(self, messages: list[dict], tools: list[dict] | None = None, on_token=None) -> LLMResponse:
```

它接收：

- `messages`：完整对话历史，包含 system/user/assistant/tool。
- `tools`：工具 schema，告诉模型可以调用哪些工具。
- `on_token`：流式输出回调。

### 7.7 组装请求参数

代码：

```python
params: dict = {
    "model": self.model,
    "messages": messages,
    "stream": True,
    **self.extra,
}
if tools:
    params["tools"] = tools
```

`stream=True` 表示模型不是一次性返回完整文本，而是像打字一样一段一段返回。

如果 `tools` 不为空，就把工具 schema 发给模型。

### 7.8 为什么要尝试 `stream_options`

代码：

```python
try:
    params["stream_options"] = {"include_usage": True}
    stream = self._call_with_retry(params)
except Exception:
    params.pop("stream_options", None)
    stream = self._call_with_retry(params)
```

有些 provider 支持在流式响应里返回 token usage，有些不支持。

这里的策略是：

1. 先带 `stream_options` 试一次。
2. 如果失败，删掉这个参数再试。

这让 CoreCoder 兼容更多 provider。

### 7.9 流式文本如何累积

代码：

```python
content_parts: list[str] = []
...
if delta.content:
    content_parts.append(delta.content)
    if on_token:
        on_token(delta.content)
```

每来一段文本，就追加到 `content_parts`。

最后：

```python
content="".join(content_parts)
```

### 7.10 tool call 参数为什么要拼接

流式响应里，工具参数 JSON 可能被拆成很多片段。

例如模型要调用：

```json
{"file_path": "README.md"}
```

流式返回可能是：

```text
{"file_
path": "
README.md
"}
```

所以代码用 `tc_map` 累积：

```python
tc_map: dict[int, dict] = {}
...
idx = tc_delta.index
if idx not in tc_map:
    tc_map[idx] = {"id": "", "name": "", "args": ""}
...
tc_map[idx]["args"] += tc_delta.function.arguments
```

最后再：

```python
args = json.loads(raw["args"])
```

这就是 LLM 层最核心的技术细节。

### 7.11 `_call_with_retry()` 如何重试

代码：

```python
for attempt in range(max_retries):
    try:
        return self.client.chat.completions.create(**params)
    except (RateLimitError, APITimeoutError, APIConnectionError):
        ...
```

它会对限流、超时、连接错误重试。等待时间是：

```python
2 ** attempt
```

也就是第 0 次失败等 1 秒，第 1 次失败等 2 秒，第 2 次失败等 4 秒。

### 7.12 LiteLLM 后端

`LiteLLM` 继承 `LLM`，但覆盖了初始化和调用逻辑。

它的价值是支持更多 provider。大体结构和 `LLM.chat()` 一样：

- 组装参数。
- 调 `litellm.completion()`。
- 流式读取 content。
- 流式读取 tool_calls。
- 返回 `LLMResponse`。

区别是它用 `getattr()` 更谨慎地读属性，因为不同 provider 返回对象的结构可能有细微差异。

### 7.13 LLM 层小结

LLM 层不理解“任务”。它只做：

```text
messages + tools schema
  -> 调 provider
  -> 收集 stream
  -> 解析文本和 tool_calls
  -> 返回 LLMResponse
```

真正决定“有工具就执行，没工具就结束”的，是 Agent 层。

## 8. Agent：最重要的主循环

核心文件：[corecoder/agent.py](../corecoder/agent.py)

这是全项目最应该精读的文件。

### 8.1 Agent 初始化保存了什么

代码：

```python
class Agent:
    def __init__(self, llm, tools=None, max_context_tokens=128_000, max_rounds=50):
        self.llm = llm
        self.tools = tools if tools is not None else ALL_TOOLS
        self.messages: list[dict] = []
        self.context = ContextManager(max_tokens=max_context_tokens)
        self.max_rounds = max_rounds
        self._system = system_prompt(self.tools)
```

逐项解释：

- `self.llm`：模型调用对象。
- `self.tools`：可用工具列表。
- `self.messages`：当前会话历史。
- `self.context`：上下文压缩管理器。
- `self.max_rounds`：最多允许多少轮工具循环。
- `self._system`：system prompt。

### 8.2 为什么给 AgentTool 注入父 Agent

代码：

```python
for t in self.tools:
    if isinstance(t, AgentTool):
        t._parent_agent = self
```

`AgentTool` 是“子代理工具”。它需要知道父 Agent 的 LLM、工具列表、上下文配置。

但如果在工具创建时就 import Agent，容易形成循环导入。所以这里在 Agent 初始化后，把自己注入给工具。

### 8.3 `_full_messages()`

代码：

```python
def _full_messages(self) -> list[dict]:
    return [{"role": "system", "content": self._system}] + self.messages
```

注意：system prompt 不保存在 `self.messages` 里。每次调用 LLM 前临时拼在最前面。

这样做的好处：

- 用户历史只保存真实对话。
- system prompt 可以单独管理。
- session 保存时不会重复保存 system prompt。

### 8.4 `_tool_schemas()`

代码：

```python
def _tool_schemas(self) -> list[dict]:
    return [t.schema() for t in self.tools]
```

每个工具都有 `schema()` 方法。Agent 把所有工具 schema 收集起来，传给 LLM。

### 8.5 `chat()` 的第一步：保存用户消息

代码：

```python
self.messages.append({"role": "user", "content": user_input})
self.context.maybe_compress(self.messages, self.llm)
```

用户输入进入消息历史。然后立刻检查是否需要压缩。

为什么用户刚说完就压缩？

因为如果历史已经很长，新的一句话可能让上下文超过阈值。先压缩再调用模型更安全。

### 8.6 主循环开始

代码：

```python
for _ in range(self.max_rounds):
    resp = self.llm.chat(
        messages=self._full_messages(),
        tools=self._tool_schemas(),
        on_token=on_token,
    )
```

这表示最多循环 `max_rounds` 次。每次都把完整消息和工具 schema 发给 LLM。

注意这里的“完整消息”包括：

```text
system prompt + self.messages
```

### 8.7 没有工具调用：结束

代码：

```python
if not resp.tool_calls:
    self.messages.append(resp.message)
    return resp.content
```

这是 Agent 的结束条件。

如果模型返回的是纯文本，说明它不需要再读文件、改文件、跑命令。Agent 保存这条 assistant 消息，然后把文本返回给 CLI。

### 8.8 有工具调用：继续

如果模型返回了 tool calls：

```python
self.messages.append(resp.message)
```

先把 assistant 的工具调用消息保存进历史。

然后执行工具。

### 8.9 单个工具如何执行

代码：

```python
tc = resp.tool_calls[0]
if on_tool:
    on_tool(tc.name, tc.arguments)
result = self._exec_tool(tc)
self.messages.append({
    "role": "tool",
    "tool_call_id": tc.id,
    "content": result,
})
```

这一步的意思是：

1. 取出工具调用。
2. 通知 CLI “我要调用工具了”。
3. 真正执行工具。
4. 把工具结果作为 `role: tool` 消息追加进历史。

### 8.10 多个工具如何并行执行

代码：

```python
results = self._exec_tools_parallel(resp.tool_calls, on_tool)
for tc, result in zip(resp.tool_calls, results):
    self.messages.append({...})
```

`_exec_tools_parallel()` 内部用：

```python
ThreadPoolExecutor(max_workers=8)
```

这意味着如果模型一次要求读多个文件，可以同时读，而不是一个一个读。

`zip(resp.tool_calls, results)` 保证结果按原工具调用顺序写回消息历史。

### 8.11 工具执行后再压缩

代码：

```python
self.context.maybe_compress(self.messages, self.llm)
```

工具输出可能很长，比如测试日志、文件内容、grep 结果。执行完工具后再次压缩，防止下一轮 LLM 调用上下文过大。

### 8.12 `_exec_tool()` 如何处理错误

代码：

```python
tool = get_tool(tc.name)
if tool is None:
    return f"Error: unknown tool '{tc.name}'"
try:
    return tool.execute(**tc.arguments)
except TypeError as e:
    return f"Error: bad arguments for {tc.name}: {e}"
except Exception as e:
    return f"Error executing {tc.name}: {e}"
```

重点：这里不抛异常，而是返回错误字符串。

为什么？

因为工具失败也是信息。Agent 会把错误字符串放进 `role: tool` 消息里，让模型看到。模型可能会换参数重试，或者告诉用户失败原因。

### 8.13 Agent 循环完整例子

假设用户输入：

```text
读一下 README_CN.md，总结这个项目
```

消息变化大概是：

第一步：

```python
self.messages = [
    {"role": "user", "content": "读一下 README_CN.md，总结这个项目"}
]
```

第一次调 LLM，模型返回工具调用：

```python
ToolCall(name="read_file", arguments={"file_path": "README_CN.md"})
```

Agent 保存 assistant 工具调用消息，再执行工具，加入：

```python
{"role": "tool", "tool_call_id": "...", "content": "1\t# CoreCoder..."}
```

第二次调 LLM，模型已经看到了 README 内容，于是返回纯文本总结。

Agent 保存：

```python
{"role": "assistant", "content": "这个项目是..."}
```

然后结束。

### 8.14 Agent 层小结

Agent 是 CoreCoder 的心脏。它不负责具体读文件，也不负责 provider 细节。它负责把所有部件串起来：

```text
保存消息
  -> 调 LLM
  -> 判断是否有工具
  -> 执行工具
  -> 保存工具结果
  -> 再调 LLM
  -> 直到没有工具调用
```

## 9. Tool 基类和工具注册表

相关文件：

- [corecoder/tools/base.py](../corecoder/tools/base.py)
- [corecoder/tools/__init__.py](../corecoder/tools/__init__.py)

### 9.1 `Tool` 基类定义了统一接口

代码：

```python
class Tool(ABC):
    name: str
    description: str
    parameters: dict

    @abstractmethod
    def execute(self, **kwargs) -> str:
        ...
```

每个工具都必须有：

- `name`：工具名，模型调用时用。
- `description`：给模型看的说明。
- `parameters`：JSON Schema，告诉模型参数格式。
- `execute()`：真正执行工具逻辑。

### 9.2 `schema()` 如何生成 OpenAI 工具格式

代码：

```python
def schema(self) -> dict:
    return {
        "type": "function",
        "function": {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        },
    }
```

OpenAI tool calling 需要这样的结构。CoreCoder 把每个工具对象转换成这个格式，再传给 LLM。

### 9.3 工具注册表

[corecoder/tools/__init__.py](../corecoder/tools/__init__.py) 里：

```python
ALL_TOOLS = [
    BashTool(),
    ReadFileTool(),
    WriteFileTool(),
    EditFileTool(),
    GlobTool(),
    GrepTool(),
    AgentTool(),
]
```

这就是默认可用的工具列表。

Agent 初始化时：

```python
self.tools = tools if tools is not None else ALL_TOOLS
```

所以默认 Agent 拥有全部七个工具。

### 9.4 `get_tool(name)`

代码：

```python
def get_tool(name: str):
    for t in ALL_TOOLS:
        if t.name == name:
            return t
    return None
```

Agent 执行工具时，根据模型给出的工具名查找工具对象。

注意一个小边界：`get_tool()` 查的是全局 `ALL_TOOLS`，不是某个 Agent 自己的 `self.tools`。在默认场景没问题，但如果你以后想创建“只有部分工具的 Agent”，这里可能需要改成从当前 Agent 的工具列表查找。

## 10. read_file：为什么读文件要带行号

文件：[corecoder/tools/read.py](../corecoder/tools/read.py)

`ReadFileTool` 的参数 schema：

```python
parameters = {
    "type": "object",
    "properties": {
        "file_path": {"type": "string", ...},
        "offset": {"type": "integer", ...},
        "limit": {"type": "integer", ...},
    },
    "required": ["file_path"],
}
```

这告诉模型：

- 必须提供 `file_path`。
- 可以选择提供 `offset` 和 `limit`。

执行逻辑：

```python
p = Path(file_path).expanduser().resolve()
if not p.exists():
    return f"Error: {file_path} not found"
if not p.is_file():
    return f"Error: {file_path} is a directory, not a file"
```

这几行把路径标准化，并检查它是不是存在的文件。

然后：

```python
text = p.read_text(errors="replace")
lines = text.splitlines()
```

读取文件并按行拆开。

关键逻辑：

```python
start = max(0, offset - 1)
chunk = lines[start : start + limit]
numbered = [f"{start + i + 1}\t{ln}" for i, ln in enumerate(chunk)]
```

因为用户习惯说“第 1 行”，但 Python 列表从 0 开始，所以要 `offset - 1`。

返回带行号的内容可以帮助模型精确定位代码。

## 11. write_file：完整写入文件

文件：[corecoder/tools/write.py](../corecoder/tools/write.py)

`WriteFileTool` 做的是创建或覆盖整个文件。

核心逻辑：

```python
p = Path(file_path).expanduser().resolve()
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(content)
_changed_files.add(str(p))
```

逐句解释：

- `resolve()`：得到绝对路径。
- `mkdir(parents=True, exist_ok=True)`：如果父目录不存在，就创建。
- `write_text(content)`：把完整内容写进文件。
- `_changed_files.add(str(p))`：记录这个文件被改过，供 `/diff` 查看。

新手要注意：`write_file` 是完整覆盖，不适合小改动。小改动应该用 `edit_file`。

## 12. edit_file：最重要的安全编辑工具

文件：[corecoder/tools/edit.py](../corecoder/tools/edit.py)

这个工具是 CoreCoder 最有代表性的设计之一。

### 12.1 为什么不用行号编辑

大模型容易数错行号。文件被改动后，行号也会变化。

所以 CoreCoder 不让模型说“把第 42 行改掉”，而是让模型提供：

- `old_string`：文件里一段必须唯一出现的原文。
- `new_string`：替换后的文本。

### 12.2 唯一匹配检查

代码：

```python
content = p.read_text()
occurrences = content.count(old_string)

if occurrences == 0:
    return "Error: old_string not found..."
if occurrences > 1:
    return "Error: old_string appears ..."
```

只有 `old_string` 出现恰好一次，才允许修改。

这能避免两类错误：

- 模型要改的文本不存在。
- 模型给的文本太短，匹配到多个位置。

### 12.3 真正替换

代码：

```python
new_content = content.replace(old_string, new_string, 1)
p.write_text(new_content)
```

`replace(..., 1)` 表示只替换第一次出现。不过前面已经保证只有一次出现，所以这里是双重保险。

### 12.4 为什么要生成 diff

代码：

```python
diff = _unified_diff(content, new_content, str(p))
return f"Edited {file_path}\n{diff}"
```

diff 能告诉模型和用户到底改了什么。这样下一轮模型可以基于改动继续判断。

### 12.5 `_unified_diff()`

代码使用标准库：

```python
difflib.unified_diff(...)
```

它生成类似 Git diff 的文本：

```diff
--- a/file.py
+++ b/file.py
@@
-old line
+new line
```

如果 diff 太长：

```python
if len(result) > 3000:
    result = result[:2500] + "\n... (diff truncated)\n"
```

避免工具结果占满上下文。

### 12.6 edit_file 小结

`edit_file` 的核心思想：

```text
让模型提供唯一原文
  -> 程序验证唯一性
  -> 程序执行替换
  -> 程序返回 diff
```

这是比“整文件重写”更安全的编辑方式。

## 13. bash：执行命令但做基本安全拦截

文件：[corecoder/tools/bash.py](../corecoder/tools/bash.py)

### 13.1 BashTool 的职责

它负责运行 shell 命令，例如：

```bash
pytest
ls
python script.py
```

但它不是无脑执行。它做了：

- 危险命令检测。
- 超时控制。
- stdout/stderr 捕获。
- exit code 返回。
- 长输出截断。
- 工作目录追踪。

### 13.2 危险命令正则

代码：

```python
_DANGEROUS_PATTERNS = [
    (r"\brm\s+(-\w*)?-r\w*\s+(/|~|\$HOME)", ...),
    (r"\brm\s+(-\w*)?-rf\s", ...),
    ...
    (r"\bcurl\b.*\|\s*(sudo\s+)?bash", ...),
]
```

这些规则拦截明显危险的命令，例如：

- 删除根目录或 home。
- 格式化磁盘。
- fork bomb。
- `curl | bash`。

注意：这只是启发式保护，不是完整沙箱。

### 13.3 执行命令

代码：

```python
proc = subprocess.run(
    command,
    shell=True,
    capture_output=True,
    text=True,
    timeout=timeout,
    cwd=cwd,
)
```

解释：

- `shell=True`：用 shell 执行字符串命令。
- `capture_output=True`：捕获输出。
- `text=True`：输出作为字符串，而不是 bytes。
- `timeout=timeout`：超过时间就停止。
- `cwd=cwd`：在指定工作目录执行。

### 13.4 stdout、stderr、exit code 如何返回

代码：

```python
out = proc.stdout
if proc.stderr:
    out += f"\n[stderr]\n{proc.stderr}"
if proc.returncode != 0:
    out += f"\n[exit code: {proc.returncode}]"
```

如果命令失败，模型能看到 exit code。这样它可以判断下一步怎么修。

### 13.5 工作目录追踪

模块级变量：

```python
_cwd: str | None = None
```

每次命令执行时：

```python
cwd = _cwd or os.getcwd()
```

如果之前没有记录，就用当前进程工作目录。

执行成功后：

```python
if proc.returncode == 0:
    _update_cwd(command, cwd)
```

`_update_cwd()` 会解析 `cd xxx`，把 `_cwd` 改成新目录。

这个实现很简单，只处理 `&&` 分隔和以 `cd ` 开头的片段。它不是完整 shell 解析器。

## 14. glob 和 grep：Agent 如何找代码

相关文件：

- [corecoder/tools/glob_tool.py](../corecoder/tools/glob_tool.py)
- [corecoder/tools/grep.py](../corecoder/tools/grep.py)

### 14.1 glob 搜文件名

`GlobTool` 用于按路径模式找文件。

例如：

```python
glob(pattern="**/*.py")
```

核心逻辑：

```python
hits = list(base.glob(pattern))
hits.sort(key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)
shown = hits[:100]
```

它最多展示 100 个结果，按修改时间倒序。

### 14.2 grep 搜文件内容

`GrepTool` 用于按正则搜索文本。

先编译正则：

```python
regex = re.compile(pattern)
```

如果正则非法：

```python
return f"Invalid regex: {e}"
```

然后决定搜索文件：

```python
if base.is_file():
    files = [base]
else:
    files = self._walk(base, include)
```

搜索时跳过一些目录：

```python
_SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", ...}
```

最多返回 200 条匹配，避免结果太长。

### 14.3 glob、grep、read_file 的配合

一个常见流程：

```text
用户：找到处理 session 的代码
  -> grep("session")
  -> read_file("corecoder/session.py")
  -> 如果要改，再 edit_file(...)
```

这就是 coding agent 的基本定位能力。

## 15. AgentTool：子代理不是魔法

文件：[corecoder/tools/agent.py](../corecoder/tools/agent.py)

`AgentTool` 可以创建一个新的 Agent 来处理子任务。

### 15.1 它什么时候有用

例如主 Agent 可以让子 Agent 做：

```text
去研究 tests/ 目录，总结有哪些测试覆盖点
```

子 Agent 会有自己的 `messages`，不会把所有阅读过程塞进主 Agent 的上下文里。

### 15.2 子 Agent 如何创建

代码：

```python
sub = Agent(
    llm=parent.llm,
    tools=[t for t in parent.tools if t.name != "agent"],
    max_context_tokens=parent.context.max_tokens,
    max_rounds=20,
)
```

子 Agent：

- 共享父 Agent 的 LLM。
- 使用父 Agent 的工具列表，但移除 `agent` 工具。
- 有自己的消息历史。
- 最大轮数是 20。

为什么移除 `agent`？

避免子 Agent 再创建子 Agent，形成无限递归。

### 15.3 返回结果截断

代码：

```python
if len(result) > 5000:
    result = result[:4500] + "\n... (sub-agent output truncated)"
```

这是为了保护父 Agent 的上下文。子 Agent 的结果太长，会拖垮主对话。

## 16. ContextManager：长对话如何压缩

文件：[corecoder/context.py](../corecoder/context.py)

### 16.1 为什么需要压缩

LLM 有上下文窗口限制。消息历史、工具输出、文件内容都要放进窗口里。

如果不压缩，长任务会越来越慢，直到请求失败。

### 16.2 token 估算

代码：

```python
def _approx_tokens(text: str) -> int:
    return len(text) // 3
```

这是粗略估算。真实 token 计算很复杂，这里用字符数除以 3 近似。

`estimate_tokens(messages)` 会统计：

- message content。
- tool_calls 字符串。

### 16.3 三个阈值

```python
self._snip_at = int(max_tokens * 0.50)
self._summarize_at = int(max_tokens * 0.70)
self._collapse_at = int(max_tokens * 0.90)
```

当消息越来越长：

- 超过 50%：先裁剪长工具输出。
- 超过 70%：用 LLM 总结旧消息。
- 超过 90%：做硬折叠。

### 16.4 第一层：裁剪工具输出

`_snip_tool_outputs()` 只处理：

```python
if m.get("role") != "tool":
    continue
```

也就是只裁工具结果，不裁用户需求。

如果工具输出超过 1500 字符，且超过 6 行，就保留：

- 前 3 行。
- 后 3 行。
- 中间用提示文字替换。

为什么保留头尾？

命令输出的开头常有命令环境或文件开头，结尾常有错误或总结。中间往往最冗长。

### 16.5 第二层：总结旧消息

`_summarize_old()` 做：

```python
old = messages[:-keep_recent]
tail = messages[-keep_recent:]
summary = self._get_summary(old, llm)
```

它把旧消息总结成一段话，但保留最近的 `keep_recent` 条原始消息。

为什么保留最近消息？

因为最近消息通常和当前任务最相关。全部压缩成摘要会丢细节。

### 16.6 第三层：硬折叠

`_hard_collapse()` 是最后手段：

```python
tail = messages[-4:] if len(messages) > 4 else messages[-2:]
summary = self._get_summary(messages[:-len(tail)], llm)
```

它只保留最后几条消息和一段总结。

这会丢更多细节，但能让对话继续。

### 16.7 LLM 摘要失败怎么办

`_get_summary()` 先尝试调用 LLM：

```python
if llm:
    try:
        resp = llm.chat(...)
        return resp.content
    except Exception:
        pass
```

如果失败，就 fallback：

```python
return self._extract_key_info(messages)
```

fallback 会用正则提取：

- 文件路径。
- error 行。

它不聪明，但比完全没有摘要好。

## 17. Session：会话如何保存和恢复

文件：[corecoder/session.py](../corecoder/session.py)

### 17.1 保存位置

```python
SESSIONS_DIR = Path.home() / ".corecoder" / "sessions"
```

会话文件放在用户 home 目录下：

```text
~/.corecoder/sessions
```

### 17.2 session id 为什么要清洗

代码：

```python
name = session_id.strip().replace("\\", "/").split("/")[-1]
name = _SAFE_SESSION_RE.sub("-", name).strip(".-_")
```

如果用户传入：

```text
../Research Notes!
```

会变成：

```text
Research-Notes
```

这是为了防止路径穿越。程序不应该允许用户通过 session id 写到任意路径。

### 17.3 新 session id

```python
return f"session_{time.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
```

包含：

- 时间戳。
- UUID 前 8 位。

这样默认 session id 不容易冲突。

### 17.4 保存会话

```python
data = {
    "id": session_id,
    "model": model,
    "saved_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    "messages": messages,
}
path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
```

保存的是 JSON，不是数据库。

最重要的是 `messages`。恢复会话时，Agent 靠它知道之前聊过什么、调用过什么工具。

### 17.5 加载会话

```python
data = json.loads(path.read_text())
return data["messages"], data["model"]
```

返回消息历史和模型名。

CLI 收到后：

```python
agent.messages, loaded_model = loaded
```

这就是恢复上下文。

## 18. 测试：测试文件在保护什么

相关文件：

- [tests/test_core.py](../tests/test_core.py)
- [tests/test_tools.py](../tests/test_tools.py)
- [tests/test_litellm.py](../tests/test_litellm.py)
- [tests/test_session.py](../tests/test_session.py)

### 18.1 `test_core.py`

它测试核心模块：

- 版本号是否正确。
- 顶层包是否能导入 `Agent`、`LLM`、`Config`、`ALL_TOOLS`。
- 配置默认值和环境变量。
- 上下文压缩是否能减少 token。
- session 保存/加载。
- session id 是否安全化。
- 费用估算。
- 文件修改追踪。

这些测试说明项目关心的边界：

```text
公开 API 稳定
配置可控
上下文能压缩
会话能恢复
文件改动能追踪
```

### 18.2 `test_tools.py`

它测试工具系统：

- 工具数量是 7。
- 每个工具都有合法 schema。
- bash 能执行、能返回 exit code、能超时、能拦截危险命令、能截断长输出。
- read/write/edit/glob/grep 的正常和错误路径。
- agent tool 的 schema。

这些测试说明工具不是“随便写个函数”，而是要有稳定的协议。

### 18.3 `test_litellm.py`

它用 fake stream 模拟 LiteLLM 返回，不需要真实 API。

这很重要：测试不应该依赖外部模型服务。外部服务慢、不稳定、需要 key。用 fake 对象可以测试解析逻辑。

### 18.4 `test_session.py`

它专门验证默认 session id 不冲突。

这个测试对应之前的 bug 修复：如果默认 session id 只用时间戳，快速保存两次可能覆盖。加入 UUID 片段后就不容易冲突。

## 19. 把所有模块串成一条完整运行链

现在把整个项目串起来。

### 19.1 启动阶段

```text
用户输入 corecoder
  -> pyproject 脚本入口
  -> corecoder.cli:main
  -> _parse_args()
  -> Config.from_env()
  -> 创建 LLM / LiteLLM
  -> 创建 Agent
  -> 进入 _repl()
```

### 19.2 用户输入阶段

```text
用户在 REPL 输入一句话
  -> 如果是 /help /save /tokens 等本地命令，CLI 自己处理
  -> 否则调用 agent.chat(user_input)
```

### 19.3 Agent 第一轮

```text
agent.chat()
  -> 把用户输入 append 到 self.messages
  -> maybe_compress()
  -> _full_messages() 加上 system prompt
  -> _tool_schemas() 生成工具 schema
  -> llm.chat()
```

### 19.4 LLM 返回工具调用

```text
LLM.chat()
  -> provider stream
  -> 拼接文本
  -> 拼接 tool call JSON 参数
  -> 返回 LLMResponse(tool_calls=[...])
```

### 19.5 Agent 执行工具

```text
Agent 发现 resp.tool_calls 不为空
  -> 保存 assistant tool call message
  -> get_tool(name)
  -> tool.execute(**arguments)
  -> 保存 role=tool 的结果
  -> maybe_compress()
  -> 下一轮 llm.chat()
```

### 19.6 LLM 返回最终文本

```text
LLM 看到工具结果
  -> 生成最终回答
  -> Agent 发现没有 tool_calls
  -> 保存 assistant text
  -> return 给 CLI
  -> CLI 打印给用户
```

这就是完整闭环。

## 20. 新手最容易误解的点

### 20.1 Agent 不是模型

模型是 LLM。Agent 是控制循环。

LLM 会生成：

- 文本。
- 工具调用请求。

Agent 会：

- 保存历史。
- 执行工具。
- 再调用 LLM。

### 20.2 工具不是模型自动执行的

模型只会说“我要调用 read_file，参数是 xxx”。真正读文件的是 Python 程序。

所以工具调用分两步：

```text
模型生成 tool_call
Python 执行 tool.execute()
```

### 20.3 system prompt 不是代码级强制

Prompt 规则约束模型行为，但不是安全边界。

真正的安全边界要写在工具里，例如：

- `edit_file` 检查唯一匹配。
- `bash` 拦截危险命令。
- `session` 清洗 session id。

### 20.4 messages 是核心状态

CoreCoder 没有复杂数据库。大部分状态都在：

```python
agent.messages
```

保存会话就是保存它。恢复会话就是恢复它。

### 20.5 上下文压缩会改变 messages

`maybe_compress()` 会原地修改 `messages`。它不是返回一个新列表，而是直接改传入的列表。

所以你读代码时看到：

```python
self.context.maybe_compress(self.messages, self.llm)
```

要理解它可能已经改变了 `self.messages` 内容。

## 21. 如果你要手动调试，应该从哪里打断点

建议按这个顺序打断点或加 print：

1. [corecoder/cli.py](../corecoder/cli.py) 的 `main()`：确认配置和 Agent 创建。
2. [corecoder/cli.py](../corecoder/cli.py) 的 `_repl()`：确认用户输入走本地命令还是 Agent。
3. [corecoder/agent.py](../corecoder/agent.py) 的 `chat()`：观察 messages 如何变化。
4. [corecoder/llm.py](../corecoder/llm.py) 的 `chat()`：观察 provider 返回如何被解析。
5. [corecoder/agent.py](../corecoder/agent.py) 的 `_exec_tool()`：观察工具名和参数。
6. 具体工具的 `execute()`：观察文件读写或命令执行。
7. [corecoder/context.py](../corecoder/context.py) 的 `maybe_compress()`：观察何时压缩。

最有价值的调试变量：

- `agent.messages`
- `resp.content`
- `resp.tool_calls`
- `tc.name`
- `tc.arguments`
- `result`
- `estimate_tokens(agent.messages)`

## 22. 读完后你应该能复述的版本

如果你能用自己的话说出下面这段，说明你已经真正读懂了：

CoreCoder 启动后由 CLI 读取参数和环境变量，创建 LLM 和 Agent。Agent 保存对话历史，并在每次用户输入后调用 LLM。调用 LLM 时，它会把 system prompt、历史 messages 和工具 schema 一起发送给模型。模型如果返回普通文本，Agent 就结束本轮并把文本交给 CLI。模型如果返回 tool calls，Agent 就按工具名查找工具对象，执行工具，把工具结果作为 `role=tool` 的消息加入历史，然后再次调用 LLM。为了避免上下文无限变长，Agent 在用户输入后和工具执行后都会调用 ContextManager 压缩消息。CLI 的 `/save` 会把 messages 和模型名保存成 JSON，`--resume` 会把它们加载回来。

这就是整个 CoreCoder 的完整代码逻辑。
