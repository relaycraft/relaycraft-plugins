# RelayCraft Plugin Development Guide

[🇺🇸 English](./CONTRIBUTING.md) | [🇨🇳 中文](./CONTRIBUTING.zh-CN.md)

RelayCraft plugins allow you to extend the application's functionality with custom UI, traffic processing logic, and localization.

## 1. Directory Structure

A standard plugin consists of a folder containing:
- `plugin.yaml`: The manifest file (required).
- `index.js`: Main UI entry point (optional).
- `locales/`: Localization files (optional).

Plugins support two development modes:
- **Direct mode (no build)**: Write `index.js` directly (best for simple plugins).
- **Build mode (optional)**: Use TypeScript/Vite/esbuild in `src/`, then build into `index.js`.

```text
my-plugin/
├── plugin.yaml
├── index.js
├── locales/
│   ├── en.json
│   └── zh.json
└── icon.svg
```

## 2. The Manifest (`plugin.yaml`)

The manifest defines the plugin's metadata, capabilities, and permissions.

```yaml
schema_version: "v2"
id: com.example.my-plugin
name: "My Awesome Plugin"
version: "1.0.0"
description: "A brief description of what this plugin does."
author: "Author Name"
icon: "Sparkles" # Lucide icon name or local SVG filename

capabilities:
  ui:
    entry: "index.js"
    settings_schema: "settings.json" # Optional auto-generated settings UI
  logic:
    entry: "process.py" # For Python-based traffic interception
  i18n:
    namespace: my_plugin_namespace
    locales:
      en: locales/en.json
      zh: locales/zh.json

permissions:
  - "ai:chat"
  - "proxy:write"
```

### 2.1 Optional Build Configuration

For complex plugins, you can enable per-plugin build steps in `plugin.yaml`:

```yaml
capabilities:
  ui:
    entry: "index.js"

build:
  enabled: true
  tool: "vite"            # Optional metadata: vite | esbuild | custom
  command: "pnpm build"   # Required when enabled=true
  output: "index.js"      # Must match capabilities.ui.entry
  config: "vite.config.ts" # Optional metadata
```

Rules:
- If `build.enabled` is omitted or `false`, the plugin is treated as direct mode.
- If `build.enabled=true`, CI runs `build.command` before packaging.
- `build.output` must match `capabilities.ui.entry`.
- Build failures are isolated per plugin (failed plugin is skipped; others still package/release).

### 2.2 Recommended Structure for Build Mode

```text
my-plugin/
├── plugin.yaml
├── index.js              # build output
├── src/
│   └── main.tsx
└── locales/
    ├── en.json
    └── zh.json
```

## 3. Core API Reference (`RelayCraft`)

RelayCraft exposes two core global objects: `RelayCraft.api` (functionality) and `RelayCraft.components` (standard UI).

### 3.1 `RelayCraft.api` Namespaces

The API is organized into domain-specific namespaces:

- **`api.i18n`**: Internationalization
  - `t(key, options)`: Translate text
  - `language`: Current language code
  - `onLanguageChange(callback)`: Listen for language changes
- **`api.theme`**: Theme Management
  - `register(theme)`: Register a new theme
  - `set(themeId)`: Switch current theme
- **`api.ui`**: User Interface
  - `registerPage(page)`: Register a standalone page
  - `registerSlot(id, options)`: Register a slot component
  - `toast(message, type)`: Show global toast notification
- **`api.ai`**: AI Capabilities
  - `chat(messages)`: Invoke AI chat completion
  - `isEnabled()`: Check if AI features are enabled
- **`api.stats`**: System Monitoring
  - `getProcessStats()`: Get process statistics
- **`api.settings`**: Plugin Configuration
  - `get(key)`: Get settings
  - `save(settings)`: Save settings

### 3.2 `RelayCraft.components` (Standard UI Library)
To ensure consistency with the main application, please prioritize using the following built-in components:

- **Basic Controls**: `Button`, `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Label`.
- **Layout Containers**: `Card`, `ScrollArea`, `Separator`, `Badge`, `Skeleton`.
- **Interaction**: `Tooltip`, `Popover`, `Dialog` (Modal), `Accordion`.
- **Advanced Navigation**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.

### 3.2 `RelayCraft.api.ui.components` (Complex Components)
- **`Editor`**: A fully functional code editor based on CodeMirror 6, supporting syntax highlighting (JSON, JavaScript, Python, etc.).
- **`DiffEditor`**: Side-by-side comparison editor.
- **`Markdown`**: Deeply optimized Markdown rendering component.

### 3.3 Injection Points (Slots)
Plugins can inject UI into the following locations using `api.ui.registerSlot(slotId, options)`:

| Slot ID | Description |
| :--- | :--- |
| `status-bar-left` | Left side of status bar. |
| `status-bar-right` | Right side of status bar. |
| `sidebar-bottom` | Bottom of the sidebar. |
| `tools-box` | Shortcut icons in the toolbox. |

---

## 4. Permissions & Backend Interaction

### 4.1 Permission Manifest (`permissions`)
Declare the following permissions in `plugin.yaml`:

- `stats:read`: Allows calling `api.stats.getProcessStats()`.
- `ai:chat`: Allows calling `api.ai.chat()`.
- `proxy:read`: Allows reading intercepted traffic.
- `proxy:write`: Allows modifying traffic.

### 4.2 API Usage
```javascript
// Get system stats
const stats = await api.stats.getProcessStats();

// AI Chat
if (api.ai.isEnabled()) {
    const response = await api.ai.chat([{ role: 'user', content: 'Analyze this' }]);
}

// i18n
const translated = api.i18n.t('hello');
```

---

## 5. Roadmap & Upcoming Features

RelayCraft's plugin system is evolving rapidly. The following features will be released progressively:

- [ ] **Custom Settings UI (v2)**: Advanced settings interface generation based on JSON Schema.
- [ ] **Interceptor API**: Allow JavaScript plugins to define lightweight filtering rules directly without Python sidecars.
- [ ] **Storage API**: Provide encrypted local key-value storage for persisting plugin configurations.

---

## 6. Best Practices & Styling

- **Consistent Styling**: Use Tailwind CSS with built-in application variables:
  - Background: `bg-background`, `bg-muted/20`
  - Text: `text-foreground`, `text-muted-foreground`
  - Border: `border-border/40`
- **Lifecycle**: Remember to handle resources released by `api.ui.onLanguageChange`.
- **ID Conventions**: Use reverse domain notation, e.g., `com.yourname.tools`.

## 7. Troubleshooting Build Mode

- **`build.enabled=true` but plugin not released**
  - Check build logs in `scripts/build_ui_plugins.mjs` output.
  - Confirm `build.command` exits with code `0`.
- **`UI entry not found`**
  - Ensure `build.output` equals `capabilities.ui.entry`.
  - Ensure the output file exists inside the plugin directory before packaging.
- **Build works locally but not in CI**
  - Make sure your changes touch workflow-trigger paths (`*.ts`, `*.tsx`, `*.js`, `plugin.yaml`, `scripts/**`, etc.).
  - Ensure required build dependencies are declared in repository `package.json`.
