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

## 3. Comprehensive API Reference (`RelayCraft`)

RelayCraft provides a global `RelayCraft` object with two main sections: `api` (functions) and `components` (UI elements).

### `RelayCraft.components` (Standard UI)

These are basic building blocks provided for a consistent look and feel:
- **`Button`**: Standard interactive button.
- **`Input`**: Single-line text input.
- **`Textarea`**: Multi-line text area.
- **`Select`**: Dropdown selection.
- **`Switch`**: Toggle switch.
- **`Skeleton`**: Loading placeholder.
- **`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`**: Flexible tabbed interface.

### `RelayCraft.api.ui.components` (Complex UI)

Specialized components for technical tasks:
- **`Editor`**: CodeMirror 6 based code editor.
- **`DiffEditor`**: Side-by-side comparison editor.
- **`Markdown`**: Robust Markdown renderer.

### `RelayCraft.api` (Functionality)

#### UI Extensions
- **`registerPage(page)`**: Adds a full-page view to the main navigation.
- **`registerSlot(slotId, options)`**: Injects a component into a predefined slot (e.g., `status-bar-left`, `flow-detail-tabs`).
- **`registerTheme(theme)`**: Registers a custom color palette.
- **`registerLocale(lang, resources)`**: Manually registers i18n bundles.
- **`t(key, options)`**: Translates a key using the plugin's namespace.
- **`toast(message, type)`**: Shows a notification (`info`, `success`, `error`).
- **`onLanguageChange(callback)`**: Listens for system language changes. Returns an unsubscribe function.

#### AI & System
- **`ai.chat(messages)`**: Interface with the configured AI provider.
  - `messages`: `[{ role: 'user' | 'assistant' | 'system', content: string }]`.
- **`stats.getProcessStats()`**: CPU, memory, and uptime metrics.
- **`settings.get(key)`**: Access plugin-specific settings.
- **`log`**: Scoped logging (`info`, `warn`, `error`).

## 4. Traffic Logic (Python)

If your plugin has a `logic` capability, it can intercept traffic using standard mitmproxy hooks.

```python
from relaycraft import ctx

def request(flow):
    if "example.com" in flow.request.pretty_url:
        ctx.log.info("Intercepting example.com")
        flow.request.headers["X-Plugin-Status"] = "Processed"
```

## 5. Best Practices & Naming

- **Icons**: While the core app uses `lucide-react`, plugins are encouraged to bundle or define their own icon sets for stability.
- **IDs**: Use reverse domain notation (e.g., `com.user.plugin-name`). The directory name MUST match the final segment.
- **Styling**: Use the provided CSS variables (e.g., `var(--color-primary)`, `var(--color-border)`) to match the system theme.
