# CoreCoder 项目 Python 基础补全：读源码时会遇到的语法和写法

这份文档写给“能看懂一点 Python，但读 CoreCoder 时会被一些陌生写法卡住”的学习者。它不是 Python 入门大全，不讲 `while`、普通 `if`、普通 `try/except` 这类基础控制流，而是集中解释这个项目里真实出现、并且新手容易不认识的 Python 知识。

建议你把它当作查词典用：

- 看到 `@dataclass` 不懂，查第 3 节。
- 看到 `list[dict] | None` 不懂，查第 4 节。
- 看到 `@property`、`@classmethod`、`@staticmethod` 不懂，查第 5 节。
- 看到 `ABC`、`abstractmethod` 不懂，查第 6 节。
- 看到 `Path(...) / "file"` 不懂，查第 7 节。
- 看到 `ThreadPoolExecutor` 不懂，查第 12 节。

相关配套文档：

- [CoreCoder 速成学习路线](corecoder-learning-roadmap.md)
- [CoreCoder 新手源码讲解](corecoder-code-walkthrough-for-beginners.md)

## 0. 先知道：这份文档覆盖哪些项目文件

本文主要覆盖这些文件里反复出现的 Python 写法：

- [corecoder/config.py](../corecoder/config.py)：`dataclass`、环境变量、`Path`、`classmethod`
- [corecoder/llm.py](../corecoder/llm.py)：`dataclass`、`field(default_factory=...)`、类型标注、`@property`、流式迭代、JSON
- [corecoder/agent.py](../corecoder/agent.py)：类、对象状态、回调函数、并发执行
- [corecoder/tools/base.py](../corecoder/tools/base.py)：抽象基类、继承、抽象方法
- [corecoder/tools/*.py](../corecoder/tools/)：文件路径、读写文件、正则、子进程、模块级变量
- [corecoder/context.py](../corecoder/context.py)：静态方法、类型检查、切片、压缩逻辑
- [corecoder/session.py](../corecoder/session.py)：JSON 文件、路径安全、元组返回值
- [tests/](../tests/)：pytest 测试、断言、临时目录、mock

## 1. 模块、包、导入：代码为什么能互相找到

### 1.1 一个 `.py` 文件就是一个模块

例如：

```text
corecoder/agent.py
corecoder/llm.py
corecoder/config.py
```

分别可以理解为：

```text
corecoder.agent
corecoder.llm
corecoder.config
```

模块的作用是把相关代码放在一个文件里，方便导入和复用。

### 1.2 一个目录为什么能成为包

`corecoder/` 目录里有：

```text
corecoder/__init__.py
```

这说明 `corecoder` 是一个 Python 包。包可以包含很多模块，也可以继续包含子包，比如：

```text
corecoder/tools/
```

`tools` 目录里也有 `__init__.py`，所以它也是包。

### 1.3 普通导入

在 [corecoder/llm.py](../corecoder/llm.py) 里：

```python
import json
import time
```

意思是导入 Python 标准库模块。之后可以写：

```python
json.loads(...)
time.sleep(...)
```

### 1.4 从模块里导入某个对象

在 [corecoder/config.py](../corecoder/config.py) 里：

```python
from dataclasses import dataclass
from pathlib import Path
```

意思是只从模块中导入需要的名字。之后可以直接写：

```python
@dataclass
Path(".env")
```

而不需要写成：

```python
dataclasses.dataclass
pathlib.Path
```

### 1.5 相对导入：前面的点是什么意思

在 [corecoder/agent.py](../corecoder/agent.py) 里：

```python
from .llm import LLM
from .tools import ALL_TOOLS, get_tool
from .tools.base import Tool
```

前面的 `.` 表示“从当前包 `corecoder` 里找”。

所以：

```python
from .llm import LLM
```

等价于概念上的：

```python
from corecoder.llm import LLM
```

项目内部通常用相对导入，这样包改名或安装后更稳定。

### 1.6 `__main__.py` 是什么

如果一个包里有 `__main__.py`，就可以这样运行：

```bash
python -m corecoder
```

Python 会自动执行：

```text
corecoder/__main__.py
```

这个项目里，`__main__.py` 只是把执行转交给 CLI：

```python
from .cli import main

if __name__ == "__main__":
    main()
```

### 1.7 `__init__.py` 是什么

`__init__.py` 有两个常见作用：

1. 告诉 Python：这个目录是包。
2. 决定包对外暴露什么名字。

例如外部用户希望这样写：

```python
from corecoder import Agent, LLM, Config
```

那通常就需要在 `corecoder/__init__.py` 里导出这些对象。

## 2. 类、对象、`self`：CoreCoder 为什么大量用类

### 2.1 类是模板，对象是实例

在 [corecoder/agent.py](../corecoder/agent.py) 里：

```python
class Agent:
    ...
```

`Agent` 是类。类像一个模板，规定“Agent 应该有哪些数据、能做哪些事”。

真正运行时会创建对象：

```python
agent = Agent(llm=llm, max_context_tokens=config.max_context_tokens)
```

这里：

- `Agent` 是类。
- `agent` 是对象。
- 对象会保存自己的状态，比如消息历史、工具列表、上下文管理器。

### 2.2 `__init__` 是对象初始化方法

在 [corecoder/agent.py](../corecoder/agent.py) 里：

```python
def __init__(self, llm: LLM, tools: list[Tool] | None = None, ...):
    self.llm = llm
    self.tools = tools if tools is not None else ALL_TOOLS
    self.messages: list[dict] = []
```

当你写：

```python
agent = Agent(llm=llm)
```

Python 会自动调用：

```python
Agent.__init__(agent, llm=llm)
```

你不需要手动调用 `__init__`。

### 2.3 `self` 是当前对象自己

`self.llm = llm` 的意思是：

```text
把传进来的 llm 保存到当前 Agent 对象身上
```

之后同一个对象的其他方法就可以使用：

```python
self.llm.chat(...)
```

如果没有 `self`，这个值只会是初始化函数里的局部变量，函数结束后就不方便继续使用。

### 2.4 方法和函数的区别

普通函数：

```python
def estimate_tokens(messages: list[dict]) -> int:
    ...
```

调用时：

```python
estimate_tokens(messages)
```

对象方法：

```python
def chat(self, user_input: str, on_token=None, on_tool=None) -> str:
    ...
```

调用时：

```python
agent.chat("帮我读 README")
```

方法会自动收到 `self`，所以你调用时不用把 `agent` 再传一遍。

### 2.5 类属性和实例属性

在 [corecoder/tools/read.py](../corecoder/tools/read.py) 里：

```python
class ReadFileTool(Tool):
    name = "read_file"
    description = "Read a file's contents with line numbers. ..."
    parameters = {...}
```

这些是类属性。它们属于这个工具类本身，所有 `ReadFileTool` 对象通常共享同一份定义。

在 [corecoder/agent.py](../corecoder/agent.py) 里：

```python
self.messages: list[dict] = []
```

这是实例属性。每个 `Agent` 对象有自己的 `messages`，不会和别的 `Agent` 混在一起。

判断方法很简单：

- 写在类里面、方法外面：通常是类属性。
- 写成 `self.xxx = ...`：通常是实例属性。

## 3. `@dataclass`：为什么它适合做轻量数据容器

### 3.1 你在项目里看到的写法

在 [corecoder/llm.py](../corecoder/llm.py) 里：

```python
@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict
```

在 [corecoder/config.py](../corecoder/config.py) 里：

```python
@dataclass
class Config:
    model: str = "gpt-4o"
    api_key: str = ""
    base_url: str | None = None
```

### 3.2 `@dataclass` 到底做了什么

`@dataclass` 是一个装饰器。它会读取类里的字段定义，然后自动帮你生成一些常用方法，最重要的是 `__init__`。

这个：

```python
@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict
```

大致等价于你手写：

```python
class ToolCall:
    def __init__(self, id: str, name: str, arguments: dict):
        self.id = id
        self.name = name
        self.arguments = arguments
```

所以你可以直接创建：

```python
tc = ToolCall(id="call_1", name="read_file", arguments={"file_path": "README.md"})
```

然后访问：

```python
tc.id
tc.name
tc.arguments
```

### 3.3 为什么不用普通字典

不用 `dataclass` 时，工具调用也可以写成字典：

```python
tc = {
    "id": "call_1",
    "name": "read_file",
    "arguments": {"file_path": "README.md"},
}
```

但字典有几个缺点：

- 字段名容易写错，比如 `"argments"` 少写一个 `u`。
- 编辑器不容易提示字段。
- 读代码时看不出这个字典应该有哪些固定字段。

`dataclass` 的好处是让“这个对象有哪些字段”变得明确：

```python
class ToolCall:
    id: str
    name: str
    arguments: dict
```

你一眼就知道它保存工具调用的三个核心信息。

### 3.4 字段默认值

在 [corecoder/config.py](../corecoder/config.py) 里：

```python
@dataclass
class Config:
    model: str = "gpt-4o"
    api_key: str = ""
    base_url: str | None = None
    max_tokens: int = 4096
```

这里每个字段都有默认值。所以可以这样创建：

```python
config = Config()
```

得到的结果大致是：

```python
config.model == "gpt-4o"
config.api_key == ""
config.base_url is None
config.max_tokens == 4096
```

也可以覆盖其中一部分：

```python
config = Config(model="deepseek-chat", max_tokens=8192)
```

没传的字段继续使用默认值。

### 3.5 `field(default_factory=list)` 是什么

在 [corecoder/llm.py](../corecoder/llm.py) 里：

```python
@dataclass
class LLMResponse:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
```

这里为什么不直接写：

```python
tool_calls: list[ToolCall] = []
```

因为列表是可变对象。如果直接把空列表放在类字段默认值里，多个对象可能意外共享同一个列表。

正确写法是：

```python
field(default_factory=list)
```

意思是：每次创建新的 `LLMResponse`，都调用一次 `list()`，生成一个全新的空列表。

你可以把它理解为：

```text
不要共用同一个默认列表；每个响应对象都拿自己的工具调用列表。
```

## 4. 类型标注：`str | None`、`list[dict]`、`-> int` 怎么读

类型标注不会自动改变程序运行逻辑。它主要帮助人和编辑器理解代码。

### 4.1 参数类型

在 [corecoder/session.py](../corecoder/session.py) 里：

```python
def save_session(messages: list[dict], model: str, session_id: str | None = None) -> str:
    ...
```

逐段读：

```text
messages: list[dict]
```

表示 `messages` 应该是一个列表，列表里的元素通常是字典。

```text
model: str
```

表示 `model` 应该是字符串。

```text
session_id: str | None = None
```

表示 `session_id` 可以是字符串，也可以是 `None`，默认值是 `None`。

### 4.2 返回值类型

同一个函数末尾的：

```python
-> str
```

表示这个函数应该返回字符串。

例如：

```python
def _approx_tokens(text: str) -> int:
    return len(text) // 3
```

表示：

- 输入 `text` 是字符串。
- 返回值是整数。

### 4.3 `| None` 是什么意思

项目里大量出现：

```python
str | None
list[dict] | None
float | None
```

`A | B` 表示“可以是 A，也可以是 B”。

所以：

```python
base_url: str | None = None
```

意思是：

```text
base_url 可以是字符串，也可以没有值。
```

在旧版本 Python 里，常见写法是：

```python
Optional[str]
```

现在项目使用的是更简洁的：

```python
str | None
```

### 4.4 `list[ToolCall]` 怎么读

在 [corecoder/llm.py](../corecoder/llm.py) 里：

```python
parsed: list[ToolCall] = []
```

意思是：

```text
parsed 是一个列表，列表里的每一项应该是 ToolCall 对象。
```

类似地：

```python
tc_map: dict[int, dict] = {}
```

意思是：

```text
tc_map 是一个字典，key 是 int，value 是 dict。
```

### 4.5 `tuple[list[dict], str] | None` 怎么读

在 [corecoder/session.py](../corecoder/session.py) 里：

```python
def load_session(session_id: str) -> tuple[list[dict], str] | None:
    ...
```

这个返回值有两种可能：

1. 找到了 session，返回一个二元组：

   ```python
   (messages, model)
   ```

   其中 `messages` 是 `list[dict]`，`model` 是 `str`。

2. 没找到 session，返回 `None`。

所以调用它时通常要判断：

```python
loaded = load_session(session_id)
if loaded is None:
    ...
else:
    messages, model = loaded
```

### 4.6 `from __future__ import annotations`

在 [corecoder/context.py](../corecoder/context.py) 里：

```python
from __future__ import annotations
```

这行的作用是推迟解析类型标注。简单说，它让类型标注更灵活，尤其是某些类型还没真正导入、或者类还没定义完时。

在这个项目里，它配合 `TYPE_CHECKING` 使用，避免运行时产生不必要的导入。

### 4.7 `TYPE_CHECKING`

在 [corecoder/context.py](../corecoder/context.py) 里：

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .llm import LLM
```

`TYPE_CHECKING` 在类型检查工具眼里是 `True`，但程序真正运行时是 `False`。

这表示：

```text
只有类型检查器需要知道 LLM 是什么；运行时不用真的导入 LLM。
```

这样可以减少循环导入风险，也能让运行时更轻。

## 5. 装饰器：`@property`、`@classmethod`、`@staticmethod`

装饰器就是写在函数或类上方、以 `@` 开头的东西。它会改变下面那个函数或类的行为。

### 5.1 `@property`：把方法伪装成属性

在 [corecoder/llm.py](../corecoder/llm.py) 里：

```python
@property
def message(self) -> dict:
    ...
```

普通方法调用是：

```python
resp.message()
```

但加了 `@property` 后，调用方式变成：

```python
resp.message
```

看起来像访问属性，实际上背后会运行 `message()` 这段逻辑。

CoreCoder 用它把 `LLMResponse` 转成 OpenAI 消息格式：

```python
self.messages.append(resp.message)
```

这样读起来像“拿到响应消息”，而不是“手动调用一个转换函数”。

### 5.2 `@classmethod`：这个方法属于类，不属于某个对象

在 [corecoder/config.py](../corecoder/config.py) 里：

```python
@classmethod
def from_env(cls) -> "Config":
    ...
```

调用方式是：

```python
config = Config.from_env()
```

这里还没有先创建 `Config()` 对象。`from_env()` 自己读取环境变量，然后返回一个新的 `Config` 对象。

`cls` 表示当前类。对 `Config` 来说，`cls` 就是 `Config`。

所以函数里：

```python
return cls(...)
```

大致等价于：

```python
return Config(...)
```

用 `cls` 的好处是：如果将来有子类继承 `Config`，这个方法仍然能返回子类对象。

### 5.3 `@staticmethod`：放在类里的普通函数

在 [corecoder/context.py](../corecoder/context.py) 里：

```python
@staticmethod
def _snip_tool_outputs(messages: list[dict]) -> bool:
    ...
```

静态方法不需要 `self`，也不需要 `cls`。它只是逻辑上归属于这个类。

调用方式可以是：

```python
ContextManager._snip_tool_outputs(messages)
```

也可以在对象内部写：

```python
self._snip_tool_outputs(messages)
```

为什么放进类里？因为这个函数是上下文压缩逻辑的一部分，放在 `ContextManager` 里更好组织。

## 6. 继承、抽象类、抽象方法：工具系统如何统一接口

### 6.1 继承是什么

在 [corecoder/tools/read.py](../corecoder/tools/read.py) 里：

```python
class ReadFileTool(Tool):
    ...
```

括号里的 `Tool` 表示 `ReadFileTool` 继承自 `Tool`。

你可以理解为：

```text
ReadFileTool 是一种 Tool。
```

所以所有工具都可以被当作 `Tool` 处理。Agent 不需要知道它具体是读文件工具、写文件工具还是 grep 工具，只要它有统一的接口即可。

### 6.2 抽象基类 `ABC`

在 [corecoder/tools/base.py](../corecoder/tools/base.py) 里：

```python
from abc import ABC, abstractmethod

class Tool(ABC):
    ...
```

`ABC` 是 Abstract Base Class，抽象基类。

抽象基类一般不是拿来直接创建对象的，而是拿来规定“子类必须实现什么”。

### 6.3 `@abstractmethod`

同一个文件里：

```python
@abstractmethod
def execute(self, **kwargs) -> str:
    ...
```

这表示：

```text
每个具体工具都必须实现 execute 方法。
```

例如：

```python
class ReadFileTool(Tool):
    def execute(self, file_path: str, offset: int = 1, limit: int = 2000) -> str:
        ...
```

```python
class BashTool(Tool):
    def execute(self, command: str, timeout: int = 120) -> str:
        ...
```

它们参数不同，但都叫 `execute`，都返回字符串。Agent 就可以统一调用：

```python
tool.execute(**tc.arguments)
```

### 6.4 `**kwargs` 是什么

在抽象方法里：

```python
def execute(self, **kwargs) -> str:
    ...
```

`**kwargs` 表示“接收任意关键字参数”。

例如模型返回工具调用参数：

```python
{"file_path": "README.md", "offset": 1, "limit": 100}
```

代码可以写：

```python
tool.execute(**tc.arguments)
```

这大致等价于：

```python
tool.execute(file_path="README.md", offset=1, limit=100)
```

`**` 的作用是把字典展开成关键字参数。

## 7. `Path`：现代 Python 里处理文件路径的方式

### 7.1 `Path` 来自哪里

项目里很多文件都有：

```python
from pathlib import Path
```

`Path` 是 Python 标准库 `pathlib` 提供的路径对象。它比传统字符串路径更清晰。

### 7.2 创建路径对象

在 [corecoder/tools/read.py](../corecoder/tools/read.py) 里：

```python
p = Path(file_path).expanduser().resolve()
```

逐段看：

```python
Path(file_path)
```

把字符串转成路径对象。

```python
.expanduser()
```

把 `~` 展开成用户 home 目录。

```python
.resolve()
```

转成绝对路径，并解析 `..`、符号链接等。

### 7.3 路径拼接用 `/`

在 [corecoder/session.py](../corecoder/session.py) 里：

```python
SESSIONS_DIR = Path.home() / ".corecoder" / "sessions"
```

`Path` 对象重载了 `/` 运算符，所以可以这样拼路径。

它比字符串拼接更安全：

```python
Path.home() / ".corecoder" / "sessions"
```

比下面这种更推荐：

```python
str(Path.home()) + "/.corecoder/sessions"
```

### 7.4 常见路径方法

项目里出现的常见方法：

```python
p.exists()       # 路径是否存在
p.is_file()      # 是否是文件
p.read_text()    # 读取文本
p.write_text(s)  # 写入文本
p.mkdir(...)     # 创建目录
p.glob("*.json") # 按模式查找文件
p.parent         # 父目录
p.stem           # 不带后缀的文件名
```

例如：

```python
if not p.exists():
    return f"Error: {file_path} not found"
```

意思是如果文件不存在，就返回错误字符串。

### 7.5 `mkdir(parents=True, exist_ok=True)`

在 [corecoder/session.py](../corecoder/session.py) 里：

```python
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
```

意思是：

- `parents=True`：父目录不存在也一起创建。
- `exist_ok=True`：目录已经存在也不要报错。

这是保存 session 前确保目录存在的常见写法。

## 8. 字符串、f-string、切片：项目里的高频小语法

### 8.1 f-string

项目里大量出现：

```python
return f"Error: {file_path} not found"
```

前面的 `f` 表示这是格式化字符串。花括号里的表达式会被替换成真实值。

例如：

```python
file_path = "README.md"
f"Error: {file_path} not found"
```

结果是：

```text
Error: README.md not found
```

### 8.2 数字里的下划线

在 [corecoder/config.py](../corecoder/config.py) 里：

```python
max_context_tokens: int = 128_000
```

`128_000` 和 `128000` 是同一个数字。下划线只是为了更容易读。

类似地：

```python
1_000_000
```

就是一百万。

### 8.3 字符串切片

在 [corecoder/tools/read.py](../corecoder/tools/read.py) 里：

```python
chunk = lines[start : start + limit]
```

这是列表切片，意思是取：

```text
从 start 开始，到 start + limit 之前结束
```

注意右边不包含。

在 [corecoder/tools/bash.py](../corecoder/tools/bash.py) 里：

```python
out[:6000]
out[-3000:]
```

分别表示：

- 前 6000 个字符。
- 后 3000 个字符。

这用于截断很长的命令输出。

### 8.4 `splitlines()` 和 `join()`

在读文件工具里：

```python
lines = text.splitlines()
numbered = [f"{start + i + 1}\t{ln}" for i, ln in enumerate(chunk)]
result = "\n".join(numbered)
```

含义是：

1. `splitlines()` 把文本拆成一行一行。
2. 列表推导式给每行加行号。
3. `"\n".join(...)` 再把多行拼回一个字符串。

## 9. 列表、字典、推导式：消息和工具 schema 的基础

### 9.1 CoreCoder 的消息是列表套字典

Agent 的消息历史大致长这样：

```python
[
    {"role": "user", "content": "帮我读 README"},
    {"role": "assistant", "content": None, "tool_calls": [...]},
    {"role": "tool", "tool_call_id": "call_1", "content": "..."},
]
```

外层是列表，因为消息有顺序。

内层是字典，因为每条消息有多个字段：

- `role`
- `content`
- `tool_calls`
- `tool_call_id`

### 9.2 字典的 `.get()`

在 [corecoder/context.py](../corecoder/context.py) 里：

```python
if m.get("content"):
    total += _approx_tokens(m["content"])
```

`m.get("content")` 表示尝试获取 `content` 字段。

如果字段不存在，`get()` 默认返回 `None`，不会报错。

如果写：

```python
m["content"]
```

字段不存在时会抛出 `KeyError`。

所以 `.get()` 更适合处理“某个字段可能不存在”的字典。

### 9.3 列表推导式

在 [corecoder/agent.py](../corecoder/agent.py) 里：

```python
return [t.schema() for t in self.tools]
```

这叫列表推导式，等价于：

```python
schemas = []
for t in self.tools:
    schemas.append(t.schema())
return schemas
```

项目里还出现：

```python
futures = [pool.submit(self._exec_tool, tc) for tc in tool_calls]
```

意思是给每个 tool call 都提交一个并发任务。

### 9.4 `enumerate`

在 [corecoder/tools/read.py](../corecoder/tools/read.py) 里：

```python
numbered = [f"{start + i + 1}\t{ln}" for i, ln in enumerate(chunk)]
```

`enumerate(chunk)` 会同时给你：

- `i`：当前下标，从 0 开始。
- `ln`：当前行内容。

所以可以一边遍历每行，一边计算真实行号。

### 9.5 `zip`

在 [corecoder/agent.py](../corecoder/agent.py) 里：

```python
for tc, result in zip(resp.tool_calls, results):
    ...
```

`zip(a, b)` 会把两个列表按位置配对。

例如：

```python
tool_calls = ["read", "grep"]
results = ["read result", "grep result"]
```

`zip(tool_calls, results)` 会产生：

```python
("read", "read result")
("grep", "grep result")
```

这保证每个工具调用和对应结果能一起处理。

## 10. JSON：模型工具调用和 session 保存都靠它

### 10.1 JSON 是什么

JSON 是一种通用的数据文本格式，长得很像 Python 字典和列表：

```json
{
  "role": "user",
  "content": "hello"
}
```

但 JSON 是字符串格式，适合网络传输和保存到文件。

### 10.2 `json.loads`

在 [corecoder/llm.py](../corecoder/llm.py) 里：

```python
args = json.loads(raw["args"])
```

`json.loads()` 把 JSON 字符串转成 Python 对象。

例如：

```python
json.loads('{"file_path": "README.md"}')
```

得到：

```python
{"file_path": "README.md"}
```

### 10.3 `json.dumps`

在 [corecoder/session.py](../corecoder/session.py) 里：

```python
path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
```

`json.dumps()` 把 Python 对象转成 JSON 字符串。

这里两个参数也很重要：

- `ensure_ascii=False`：中文不要被转成 `\u4e2d\u6587` 这种形式。
- `indent=2`：保存成带缩进的漂亮格式，方便人读。

### 10.4 为什么工具参数需要 JSON

LLM 返回工具调用时，函数参数通常是一段 JSON 字符串。CoreCoder 要先把它解析成 Python 字典：

```python
args = json.loads(raw["args"])
parsed.append(ToolCall(id=raw["id"], name=raw["name"], arguments=args))
```

然后 Agent 才能执行：

```python
tool.execute(**tc.arguments)
```

所以工具调用链路可以理解成：

```text
模型输出 JSON 字符串
  -> json.loads 转成 Python dict
  -> **dict 展开成函数参数
  -> 工具 execute 真正执行
```

## 11. 回调函数：为什么 `on_token` 和 `on_tool` 能实时打印

### 11.1 函数也可以作为参数传递

在 [corecoder/agent.py](../corecoder/agent.py) 里：

```python
def chat(self, user_input: str, on_token=None, on_tool=None) -> str:
    ...
```

`on_token` 和 `on_tool` 默认是 `None`，但 CLI 可以传函数进来。

在 [corecoder/cli.py](../corecoder/cli.py) 里有类似逻辑：

```python
def on_token(tok):
    print(tok, end="", flush=True)

def on_tool(name, kwargs):
    print(...)

agent.chat(prompt, on_token=on_token, on_tool=on_tool)
```

这就是回调函数：你把函数交给别人，别人会在合适的时候调用。

### 11.2 `on_token` 用在哪里

在 [corecoder/llm.py](../corecoder/llm.py) 里：

```python
if delta.content:
    content_parts.append(delta.content)
    if on_token:
        on_token(delta.content)
```

模型流式返回一小段文本时，LLM 层会：

1. 把这段文本存进 `content_parts`。
2. 如果有 `on_token`，就立刻调用它。

所以 CLI 才能边生成边打印，而不是等完整答案结束后才显示。

### 11.3 `on_tool` 用在哪里

在 [corecoder/agent.py](../corecoder/agent.py) 里：

```python
if on_tool:
    on_tool(tc.name, tc.arguments)
```

模型准备调用工具时，Agent 会通知 CLI。CLI 就能显示类似：

```text
-> read_file {'file_path': 'README.md'}
```

这不是工具执行本身，而是“把工具调用事件告诉界面”。

## 12. 流式响应、迭代、并发：Agent 为什么能边跑边处理

### 12.1 `for chunk in stream`

在 [corecoder/llm.py](../corecoder/llm.py) 里：

```python
for chunk in stream:
    ...
```

`stream` 不是一个普通的一次性结果，而是一个可迭代对象。模型会一段一段返回内容，代码就一段一段处理。

这就是流式响应的核心：

```text
不是等模型说完整段话
而是模型每吐出一小块，程序就处理一小块
```

### 12.2 为什么工具调用要累积

工具调用参数可能被模型拆成多个 chunk 返回。项目用：

```python
tc_map: dict[int, dict] = {}
```

按工具调用的 index 累积：

```python
tc_map[idx]["args"] += tc_delta.function.arguments
```

最后再统一：

```python
args = json.loads(raw["args"])
```

所以这里不是“模型一次返回完整 JSON”，而是“多段字符串拼成完整 JSON”。

### 12.3 `ThreadPoolExecutor`

在 [corecoder/agent.py](../corecoder/agent.py) 里：

```python
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    futures = [pool.submit(self._exec_tool, tc) for tc in tool_calls]
    return [f.result() for f in futures]
```

这是并发执行多个工具调用。

逐段看：

```python
ThreadPoolExecutor(max_workers=8)
```

创建一个最多 8 个工作线程的线程池。

```python
pool.submit(self._exec_tool, tc)
```

把一个工具执行任务提交给线程池。

```python
f.result()
```

等待这个任务完成，并取回结果。

### 12.4 为什么这里适合用线程

CoreCoder 的工具很多是 I/O 型任务，例如：

- 读文件
- 搜索文件
- 执行 shell 命令

这些任务经常是在等磁盘、等进程、等系统返回，不是一直占用 CPU。线程池适合这种场景。

### 12.5 `with` 是上下文管理器

在同一段代码里：

```python
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    ...
```

`with` 会负责进入和退出资源上下文。对线程池来说，它能在代码块结束后自动清理线程池资源。

类似地，很多文件操作也可以写成：

```python
with open("a.txt") as f:
    text = f.read()
```

本项目多用 `Path.read_text()`，所以文件读写里没有大量出现 `with open(...)`。

## 13. 正则表达式：搜索和 session id 清洗

### 13.1 `re` 是什么

`re` 是 Python 标准库里的正则表达式模块。

项目里主要用于两类事情：

1. 检查危险 shell 命令。
2. 清理 session id。
3. 从文本中提取文件路径。

### 13.2 `re.compile`

在 [corecoder/session.py](../corecoder/session.py) 里：

```python
_SAFE_SESSION_RE = re.compile(r"[^A-Za-z0-9._-]+")
```

这会提前编译一个正则对象，后面可以重复使用。

正则含义是：

```text
匹配所有不是字母、数字、点、下划线、横线的字符
```

### 13.3 `sub`

同一个文件里：

```python
name = _SAFE_SESSION_RE.sub("-", name).strip(".-_")
```

`.sub("-", name)` 的意思是：把匹配到的不安全字符都替换成 `-`。

所以：

```text
"../Research Notes!"
```

会被清理成更安全的文件名。

### 13.4 `re.search`

在 [corecoder/tools/bash.py](../corecoder/tools/bash.py) 里：

```python
if re.search(pattern, cmd):
    return reason
```

意思是：只要命令字符串里出现危险模式，就返回对应原因。

例如检测：

```text
rm -rf
curl ... | bash
```

这属于工具安全保护。

## 14. `subprocess.run`：Python 如何执行 shell 命令

在 [corecoder/tools/bash.py](../corecoder/tools/bash.py) 里：

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

逐个参数看：

- `command`：要执行的命令字符串。
- `shell=True`：通过 shell 执行，支持 `cd`、`&&` 等 shell 语法。
- `capture_output=True`：捕获标准输出和标准错误。
- `text=True`：把输出当文本处理，而不是 bytes。
- `timeout=timeout`：超过指定秒数就终止。
- `cwd=cwd`：指定命令在哪个目录运行。

执行完后：

```python
proc.stdout
proc.stderr
proc.returncode
```

分别表示：

- 标准输出
- 标准错误
- 退出码

退出码为 `0` 通常表示成功，非 `0` 通常表示失败。

## 15. 环境变量和 `.env`：配置从哪里来

### 15.1 `os.getenv`

在 [corecoder/config.py](../corecoder/config.py) 里：

```python
os.getenv("CORECODER_MODEL", "gpt-4o")
```

意思是：

- 如果环境变量 `CORECODER_MODEL` 存在，就用它。
- 如果不存在，就用默认值 `"gpt-4o"`。

API key 的读取是多个变量兜底：

```python
api_key = (
    os.getenv("CORECODER_API_KEY")
    or os.getenv("OPENAI_API_KEY")
    or os.getenv("DEEPSEEK_API_KEY")
    or ""
)
```

这表示按顺序找：

1. `CORECODER_API_KEY`
2. `OPENAI_API_KEY`
3. `DEEPSEEK_API_KEY`
4. 都没有就用空字符串

### 15.2 `or` 链式兜底

这段：

```python
os.getenv("OPENAI_BASE_URL") or os.getenv("CORECODER_BASE_URL")
```

意思是：

```text
优先使用 OPENAI_BASE_URL；
如果没有，再使用 CORECODER_BASE_URL。
```

这在配置读取里很常见。

### 15.3 `.env` 加载

项目里的 `_load_dotenv()` 会尝试：

```python
from dotenv import load_dotenv
```

如果安装了 `python-dotenv`，就加载 `.env` 文件。

如果没安装：

```python
except ImportError:
    pass
```

它会静默跳过，不影响主程序运行。

## 16. 模块级变量、下划线命名、`global`

### 16.1 模块级变量

在 [corecoder/tools/edit.py](../corecoder/tools/edit.py) 里：

```python
_changed_files: set[str] = set()
```

这个变量定义在函数和类外面，所以是模块级变量。

它用于记录本次运行中哪些文件被编辑过，CLI 的 `/diff` 可以用它展示改动。

### 16.2 单下划线开头

项目里有很多名字以 `_` 开头：

```python
_changed_files
_load_dotenv
_session_path
_exec_tool
```

Python 不会禁止外部访问这些名字，但约定上它们表示：

```text
这是内部实现细节，不建议外部直接调用。
```

### 16.3 `global`

在 [corecoder/tools/bash.py](../corecoder/tools/bash.py) 里：

```python
_cwd: str | None = None

def execute(...):
    global _cwd
    ...
```

`global _cwd` 表示函数里要修改模块级变量 `_cwd`，而不是创建一个新的局部变量。

为什么需要它？因为 Bash 工具要记住上一次 `cd` 后的工作目录，让下一条命令继续在那个目录运行。

## 17. 返回多个值、解包、`None`

### 17.1 返回元组

在 [corecoder/session.py](../corecoder/session.py) 里：

```python
return data["messages"], data["model"]
```

这是返回一个元组，等价于：

```python
return (data["messages"], data["model"])
```

调用时可以解包：

```python
messages, model = load_session(session_id)
```

### 17.2 为什么有时返回 `None`

同一个函数：

```python
if not path.exists():
    return None
```

表示“没有找到对应 session”。这种函数的返回类型通常写成：

```python
tuple[list[dict], str] | None
```

读代码时看到 `| None`，就要意识到调用方应该处理“没有结果”的情况。

### 17.3 `is None` 和 `is not None`

项目里常见：

```python
if tools is not None:
    ...
```

判断 `None` 推荐用 `is None` 或 `is not None`，不要用 `== None`。

因为 `None` 是 Python 里的单例对象，用身份判断最清晰。

## 18. 测试里的 Python：pytest、assert、fixture、mock

### 18.1 测试函数

在 [tests/test_core.py](../tests/test_core.py) 里：

```python
def test_version():
    assert __version__ == "0.3.0"
```

pytest 会自动发现名字以 `test_` 开头的函数并运行。

### 18.2 `assert`

```python
assert len(ALL_TOOLS) == 7
```

意思是断言这个条件必须为真。

如果为假，测试失败。

### 18.3 `tmp_path`

在 [tests/test_tools.py](../tests/test_tools.py) 里：

```python
def test_read_file(tmp_path):
    p = tmp_path / "x.txt"
```

`tmp_path` 是 pytest 提供的 fixture。它会给测试一个临时目录，测试结束后可以清理。

这比直接在项目目录里创建测试文件更安全。

### 18.4 `monkeypatch`

在测试里，`monkeypatch` 通常用于临时修改环境变量、路径或对象属性，测试结束后自动恢复。

例如测试配置读取时，可能会临时设置：

```python
monkeypatch.setenv("CORECODER_MODEL", "test-model")
```

这样不会污染你真实终端环境。

### 18.5 `mock.patch.dict`

在 [tests/test_litellm.py](../tests/test_litellm.py) 里可以看到：

```python
with mock.patch.dict("os.environ", {"CORECODER_PROVIDER": "litellm"}, clear=False):
    ...
```

这表示在 `with` 代码块内部临时修改 `os.environ`。代码块结束后恢复。

这适合测试“环境变量改变后配置是否正确”。

## 19. 新手读 CoreCoder 时最容易卡住的 10 个点

### 19.1 `@dataclass` 不是继承

```python
@dataclass
class Config:
    ...
```

`@dataclass` 是装饰器，不是父类。它只是帮类自动生成初始化等方法。

继承是：

```python
class ReadFileTool(Tool):
    ...
```

括号里的 `Tool` 才是父类。

### 19.2 类型标注不是强制校验

```python
def chat(messages: list[dict]) -> LLMResponse:
    ...
```

这不会在运行时自动检查 `messages` 一定是 `list[dict]`。它主要给人、编辑器、类型检查工具看。

### 19.3 `resp.message` 看起来是属性，实际会运行代码

因为它是：

```python
@property
def message(self) -> dict:
    ...
```

所以访问 `resp.message` 时，会执行转换逻辑。

### 19.4 `tool.execute(**tc.arguments)` 是字典展开

如果：

```python
tc.arguments == {"file_path": "README.md", "offset": 1}
```

那么：

```python
tool.execute(**tc.arguments)
```

等价于：

```python
tool.execute(file_path="README.md", offset=1)
```

### 19.5 `Path.home() / ".corecoder"` 是路径拼接

这里的 `/` 不是除法，而是 `Path` 对象定义的路径拼接。

### 19.6 `content_parts.append(...)` 最后再 `"".join(...)`

流式输出一段一段来，所以先把片段放进列表：

```python
content_parts.append(delta.content)
```

最后合并：

```python
"".join(content_parts)
```

这种写法比循环里不断 `text += part` 更常见、更清晰。

### 19.7 `tc_map[idx]["args"] += ...` 是在拼工具参数

模型返回的工具参数可能是碎片，所以要按 index 拼起来。

不要误以为每个 chunk 都是完整工具调用。

### 19.8 `if TYPE_CHECKING:` 里的导入运行时不会执行

它只给类型检查器看，避免运行时导入依赖或循环导入。

### 19.9 `_xxx` 通常是内部函数或内部变量

例如：

```python
_exec_tool
_session_path
_changed_files
```

这些不是绝对私有，但表示“项目内部使用”。

### 19.10 测试里的小类通常是假对象

[tests/test_litellm.py](../tests/test_litellm.py) 里有一些 `_Chunk`、`_Delta` 之类的小类。它们不是产品代码，而是测试中模拟 LLM 流式返回的数据结构。

## 20. 建议阅读顺序

如果你是第一次补 Python 基础，建议这样走：

1. 先读第 3 节：`dataclass`
2. 再读第 4 节：类型标注
3. 再读第 5 节：装饰器
4. 再读第 6 节：继承和抽象类
5. 再读第 7 节：`Path`
6. 再读第 10 节：JSON
7. 再读第 11 节：回调函数
8. 再读第 12 节：流式响应和并发

读完之后再回到 [CoreCoder 新手源码讲解](corecoder-code-walkthrough-for-beginners.md)，你会明显更容易读懂每段代码为什么这样写。

