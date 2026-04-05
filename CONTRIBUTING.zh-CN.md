# RelayCraft 插件开发指南

[🇺🇸 English](./CONTRIBUTING.md) | [🇨🇳 中文](./CONTRIBUTING.zh-CN.md)

RelayCraft 插件允许你通过自定义 UI、流量处理逻辑和本地化来扩展应用程序的功能。

## 1. 目录结构

一个标准插件包含一个文件夹，其中包含：
- `plugin.yaml`: 清单文件（必需）。
- `index.js`: 主 UI 入口点（可选）。
- `locales/`: 本地化文件（可选）。

插件支持两种开发模式：
- **直写模式（无需编译）**：直接维护 `index.js`（适合简单插件）。
- **构建模式（可选）**：在 `src/` 使用 TypeScript/Vite/esbuild，构建产出 `index.js`。

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

### 2.1 可选构建配置（build）

对于复杂插件，可在 `plugin.yaml` 中声明按插件构建：

```yaml
capabilities:
  ui:
    entry: "index.js"

build:
  enabled: true
  tool: "vite"             # 可选元信息：vite | esbuild | custom
  command: "pnpm build"    # enabled=true 时必填
  output: "index.js"       # 必须与 capabilities.ui.entry 一致
  config: "vite.config.ts" # 可选元信息
```

约束规则：
- 未配置 `build` 或 `build.enabled=false` 时，按直写模式处理。
- `build.enabled=true` 时，CI 会在打包前执行 `build.command`。
- `build.output` 必须等于 `capabilities.ui.entry`。
- 构建失败按插件隔离：失败插件跳过，其他插件继续发布。

### 2.2 构建模式推荐目录

```text
my-plugin/
├── plugin.yaml
├── index.js              # 构建产物
├── src/
│   └── main.tsx
└── locales/
    ├── en.json
    └── zh.json
```

## 3. 核心 API 参考 (`RelayCraft`)

RelayCraft 为插件提供了两个核心全局对象：`RelayCraft.api`（功能）和 `RelayCraft.components`（标准 UI）。
此外还提供 `RelayCraft.icons`（宿主受控图标集）。

### 3.1 `RelayCraft.api` 命名空间

API 已按功能领域划分为多个子模块：

- **`api.i18n`**: 多语言支持
  - `t(key, options)`: 翻译文本
  - `language`: 当前语言代码
  - `onLanguageChange(callback)`: 监听语言变更
- **`api.theme`**: 主题管理
  - `register(theme)`: 注册新主题
  - `set(themeId)`: 切换当前主题
- **`api.ui`**: 界面交互
  - `registerPage(page)`: 注册独立页面
  - `registerSlot(id, options)`: 注册插槽组件
  - `toast(message, type)`: 显示全局提示
- **`api.ai`**: AI 能力
  - `chat(messages)`: 调用 AI 对话
  - `isEnabled()`: 检查 AI 功能是否可用
- **`api.stats`**: 系统监控
  - `getProcessStats()`: 获取进程状态
- **`api.settings`**: 插件配置
  - `get(key)`: 获取配置
  - `save(settings)`: 保存配置

### 3.2 `RelayCraft.components` (标准 UI 库)
为了保证插件与主应用的一致性，请优先使用以下内置组件：

- **基础控件**: `Button`, `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Label`.
- **布局容器**: `Card`, `ScrollArea`, `Separator`, `Badge`, `Skeleton`.
- **交互反馈**: `Tooltip`, `Popover`, `Dialog` (Modal), `Accordion`.
- **高级导航**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.

### 3.2 `RelayCraft.icons`（宿主图标）
插件可以直接使用宿主提供的图标组件：

```javascript
const { api, icons } = RelayCraft;

api.ui.registerPage({
  id: "demo",
  name: "Demo",
  route: "/demo",
  icon: icons.BookOpen, // 无需手绘 SVG
  component: DemoPage,
});
```

说明：
- 该图标集合是受控白名单，用于保障稳定性和设计一致性。
- 建议优先使用 `RelayCraft.icons`，不建议插件自行打包整套图标库。

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

### 4.2 API 调用示例
```javascript
// 获取系统状态
const stats = await api.stats.getProcessStats();

// 调用 AI
if (api.ai.isEnabled()) {
    const response = await api.ai.chat([{ role: 'user', content: '分析 JSON' }]);
}

// 国际化
const translated = api.i18n.t('hello');
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

## 7. 构建模式排障

- **`build.enabled=true` 但插件未发布**
  - 查看 `scripts/build_ui_plugins.mjs` 输出日志中的插件级错误。
  - 确认 `build.command` 本地和 CI 均返回 `0`。
- **`UI entry not found`**
  - 检查 `build.output` 是否与 `capabilities.ui.entry` 完全一致。
  - 确认构建产物文件位于插件目录内。
- **本地可构建，CI 失败**
  - 确认改动命中了 workflow 触发路径（`*.ts`、`*.tsx`、`*.js`、`plugin.yaml`、`scripts/**` 等）。
  - 确认构建依赖已在你自己的插件目录下的 `package.json` 中声明（本仓库已启用 pnpm workspace 架构，实现插件依赖隔离）。
