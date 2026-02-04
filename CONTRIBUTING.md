# RelayCraft Plugin Development Guide

[🇺🇸 English](./CONTRIBUTING.md) | [🇨🇳 中文](./CONTRIBUTING.zh-CN.md)

RelayCraft plugins allow you to extend the application's functionality with custom UI, traffic processing logic, and localization.

## 1. Directory Structure

A standard plugin consists of a folder containing:
- `plugin.yaml`: The manifest file (required).
- `index.js`: Main UI entry point (optional).
- `locales/`: Localization files (optional).

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

## 3. Core API Reference (`RelayCraft`)

RelayCraft provides plugins with two core global objects: `RelayCraft.api` (functionality) and `RelayCraft.components` (standard UI).

### 3.1 `RelayCraft.components` (Standard UI Library)
To ensure consistency with the main application, please prioritize using the following built-in components:

- **Basic Controls**: `Button`, `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Label`.
- **Layout Containers**: `Card`, `ScrollArea`, `Separator`, `Badge`, `Skeleton`.
- **Interaction**: `Tooltip`, `Popover`, `Dialog` (Modal), `Accordion`.
- **Advanced Navigation**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.

### 3.2 `RelayCraft.api.ui.components` (Complex Components)
- **`Editor`**: A fully functional code editor based on CodeMirror 6, supporting syntax highlighting (JSON, JavaScript, Python, etc.).
- **`DiffEditor`**: Side-by-side comparison editor.
- **`Markdown`**: Deeply optimized Markdown rendering component.

### 3.3 Slots
Plugins can inject UI into the following locations via `api.ui.registerSlot(slotId, options)`:

| Slot ID | Description |
| :--- | :--- |
| `status-bar-left` | Left side of the status bar, suitable for displaying global status. |
| `status-bar-right` | Right side of the status bar (next to system clock), suitable for monitoring metrics. |
| `sidebar-bottom` | Bottom of the sidebar. |
| `flow-detail-tabs` | Tabs in the request detail panel, suitable for displaying parsed custom data. |
| `tools-box` | Shortcut icons within the toolbox. |

---

## 4. Permission System & Backend Interaction

RelayCraft adopts a "Declare then Audit" permission model.

### 4.1 Permission Manifest (`permissions`)
Declare the following permissions in `plugin.yaml` to enable restricted APIs:

- `stats:read`: Allows calling `api.stats.getProcessStats()` to get system metrics.
- `ai:chat`: Allows calling `api.ai.chat()` to use built-in AI capabilities.
- `proxy:read`: Allows reading real-time intercepted traffic summaries.
- `proxy:write`: Allows modifying request or response data (requires `logic` capability).
- `network:outbound`: Allows plugins to initiate outbound network requests (coming soon).

### 4.2 Backend API Calls
```javascript
// Core built-in features
const stats = await api.stats.getProcessStats();
const response = await api.ai.chat([{ role: 'user', content: 'Analyze this JSON' }]);

// Generic backend calls (audited by permissions whitelist)
const result = await api.invoke('some_backend_command', { arg1: 'val' });
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
