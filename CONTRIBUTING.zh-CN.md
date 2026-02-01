# RelayCraft 插件开发指南

[🇺🇸 English](./CONTRIBUTING.md) | [🇨🇳 中文](./CONTRIBUTING.zh-CN.md)

RelayCraft 插件允许你通过自定义 UI、流量处理逻辑和本地化来扩展应用程序的功能。

## 1. 目录结构

一个标准插件包含一个文件夹，其中包含：
- `plugin.yaml`: 清单文件（必需）。
- `index.js`: 主 UI 入口点（可选）。
- `locales/`: 本地化文件（可选）。

```text
my-plugin/
├── plugin.yaml
├── index.js
├── locales/
│   ├── en.json
│   └── zh.json
└── icon.svg
```

## 2. 清单文件 (`plugin.yaml`)

清单定义了插件的元数据、功能和权限。

```yaml
schema_version: "v2"
id: com.example.my-plugin
name: "My Awesome Plugin"
version: "1.0.0"
description: "A brief description of what this plugin does."
author: "Author Name"
icon: "Sparkles" # Lucide 图标名称或本地 SVG 文件名

capabilities:
  ui:
    entry: "index.js"
    settings_schema: "settings.json" # 可选的自动生成设置 UI
  logic:
    entry: "process.py" # 用于基于 Python 的流量拦截
  i18n:
    namespace: my_plugin_namespace
    locales:
      en: locales/en.json
      zh: locales/zh.json

permissions:
  - "ai:chat"
  - "proxy:write"
```

## 3. 完整 API 参考 (`RelayCraft`)

RelayCraft 提供了一个全局 `RelayCraft` 对象，包含两个主要部分：`api`（函数）和 `components`（UI 元素）。

### `RelayCraft.components` (标准 UI)

这些是提供的基本构建块，用于保持一致的外观和感觉：
- **`Button`**: 标准交互按钮。
- **`Input`**: 单行文本输入。
- **`Textarea`**: 多行文本区域。
- **`Select`**: 下拉选择。
- **`Switch`**: 切换开关。
- **`Skeleton`**: 加载占位符。
- **`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`**: 灵活的选项卡界面。

### `RelayCraft.api.ui.components` (复杂 UI)

用于技术任务的专用组件：
- **`Editor`**: 基于 CodeMirror 6 的代码编辑器。
- **`DiffEditor`**: 并排比较编辑器。
- **`Markdown`**: 强大的 Markdown 渲染器。

### `RelayCraft.api` (功能)

#### UI 扩展
- **`registerPage(page)`**: 向主导航添加整页视图。
- **`registerSlot(slotId, options)`**: 将组件注入预定义的插槽（例如 `status-bar-left`, `flow-detail-tabs`）。
- **`registerTheme(theme)`**: 注册自定义调色板。
- **`registerLocale(lang, resources)`**: 手动注册 i18n 包。
- **`t(key, options)`**: 使用插件的命名空间翻译键。
- **`toast(message, type)`**: 显示通知 (`info`, `success`, `error`)。
- **`onLanguageChange(callback)`**: 监听系统语言更改。返回取消订阅函数。

#### AI 与系统
- **`ai.chat(messages)`**: 与配置的 AI 提供商接口。
  - `messages`: `[{ role: 'user' | 'assistant' | 'system', content: string }]`.
- **`stats.getProcessStats()`**: CPU、内存和运行时间指标。
- **`settings.get(key)`**: 访问插件特定设置。
- **`log`**: 作用域日志记录 (`info`, `warn`, `error`)。

## 4. 流量逻辑 (Python)

如果你的插件具有 `logic` 能力，它可以使用标准的 mitmproxy 钩子拦截流量。

```python
from relaycraft import ctx

def request(flow):
    if "example.com" in flow.request.pretty_url:
        ctx.log.info("Intercepting example.com")
        flow.request.headers["X-Plugin-Status"] = "Processed"
```

## 5. 最佳实践与命名

- **图标**: 虽然核心应用程序使用 `lucide-react`，但为了稳定性，建议插件捆绑或定义自己的图标集。
- **ID**: 使用反向域名表示法（例如 `com.user.plugin-name`）。目录名称必须与最后一段匹配。
- **样式**: 使用提供的 CSS 变量（例如 `var(--color-primary)`, `var(--color-border)`）以匹配系统主题。
