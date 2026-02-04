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

## 3. 核心 API 参考 (`RelayCraft`)

RelayCraft 为插件提供了两个核心全局对象：`RelayCraft.api`（功能）和 `RelayCraft.components`（标准 UI）。

### 3.1 `RelayCraft.components` (标准 UI 库)
为了保证插件与主应用的一致性，请优先使用以下内置组件：

- **基础控件**: `Button`, `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Label`.
- **布局容器**: `Card`, `ScrollArea`, `Separator`, `Badge`, `Skeleton`.
- **交互反馈**: `Tooltip`, `Popover`, `Dialog` (Modal), `Accordion`.
- **高级导航**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.

### 3.2 `RelayCraft.api.ui.components` (复杂专用组件)
- **`Editor`**: 基于 CodeMirror 6 的全功能代码编辑器，支持语法高亮（JSON, JavaScript, Python 等）。
- **`DiffEditor`**: 差异对比编辑器。
- **`Markdown`**: 深度优化的 Markdown 渲染组件。

### 3.3 注入点 (Slots)
插件可以通过 `api.ui.registerSlot(slotId, options)` 将 UI 注入以下位置：

| 插槽 ID | 说明 |
| :--- | :--- |
| `status-bar-left` | 状态栏左侧，适合展示全局运行状态。 |
| `status-bar-right` | 状态栏右侧（系统时钟旁），适合展示监控指标。 |
| `sidebar-bottom` | 侧边栏底部。 |
| `flow-detail-tabs` | 请求详情面板的选项卡，适合展示解析后的自定义数据。 |
| `tools-box` | 工具箱内的快捷图标。 |

---

## 4. 权限系统与后端交互

RelayCraft 采用“先声明，后审计”的权限模型。

### 4.1 权限清单 (`permissions`)
在 `plugin.yaml` 中声明以下权限以启用受限 API：

- `stats:read`: 允许调用 `api.stats.getProcessStats()` 获取系统指标。
- `ai:chat`: 允许调用 `api.ai.chat()` 使用内置 AI 能力。
- `proxy:read`: 允许读取实时截获的流量摘要。
- `proxy:write`: 允许修改请求或响应数据（需配合 `logic` 能力）。
- `network:outbound`: 允许插件发起外部网络请求（即将开放）。

### 4.2 后端 API 调用
```javascript
// 核心内置功能
const stats = await api.stats.getProcessStats();
const response = await api.ai.chat([{ role: 'user', content: '分析这段 JSON' }]);

// 通用后端调用 (受到 permissions 白名单审计)
const result = await api.invoke('some_backend_command', { arg1: 'val' });
```

---

## 5. 路线图 (Roadmap) & 陆续开放的功能

RelayCraft 的插件系统正在快速进化，以下功能将陆续开放：

- [ ] **自定义设置 UI (v2)**: 基于 JSON Schema 的高级设置界面生成。
- [ ] **拦截器 API**: 允许 JavaScript 插件直接定义轻量级过滤规则，无需 Python 侧边栏。 
- [ ] **存储 API**: 提供加密的本地键值对存储，用于持久化插件配置。

---

## 6. 最佳实践与样式原则

- **等阶样式**: 使用 Tailwind CSS 并配合应用内置变量：
  - 背景：`bg-background`, `bg-muted/20`
  - 文字：`text-foreground`, `text-muted-foreground`
  - 边框：`border-border/40`
- **生命周期**: 记得处理 `api.ui.onLanguageChange` 释放的资源。
- **ID 规范**: 使用反向域名命名空间，如 `com.yourname.tools`。
