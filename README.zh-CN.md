# RelayCraft 社区插件

[🇺🇸 English](./README.md) | [🇨🇳 中文](./README.zh-CN.md)

欢迎来到 RelayCraft 插件官方仓库！本仓库是插件市场的中心枢纽。

## 🚀 入门指南

### 浏览插件
本仓库中的每个插件都以 `.zip` 文件的形式发布，便于安装。你可以在 RelayCraft 应用程序内的 **插件市场** 中找到可用插件列表。

### 贡献
我们欢迎社区的贡献！提交新插件的步骤如下：
1. Fork 本仓库。
2. 在 `plugins/` 目录下为你的插件创建一个新目录。
3. 遵循 [插件开发指南](./CONTRIBUTING.zh-CN.md)。
4. 提交 Pull Request。

## 📦 仓库结构
- `plugins/`: 所有官方和社区插件的源代码。
- `plugins.json`: **市场清单 (Marketplace Manifest)**。这是 RelayCraft 插件市场的单一事实来源。应用程序会获取此文件以发现、显示和更新插件。
- `assets/`: 插件的图标和截图。

## 🚀 市场同步逻辑
当 RelayCraft 应用程序“与市场同步”时，它执行以下操作：
1. **获取清单**: 从本仓库根目录下载最新的 `plugins.json`。
2. **元数据解析**: 解析列表以在 UI 中显示可用插件、版本和描述。
3. **安装**: 当用户点击“安装”时，应用程序使用清单中指定的 `download_url` 检索插件内容。

## 📜 命名与打包
- **插件 ID**: 使用 kebab-case，可选反向域名作为前缀（例如 `com.user.my-plugin`）。
- **分发格式**: 插件作为 `.rcplugin` 文件分发。这是一个包含插件源代码的标准 ZIP 归档文件。
- **文件名**: 所有脚本和配置文件应使用 `kebab-case`。

## 🛡️ 安全
所有通过 Pull Request 提交的插件都会经过安全和性能审查。请确保你的插件仅申请其严格需要的权限。

---
[RelayCraft](https://github.com/relaycraft/relaycraft) 生态系统的一部分。
