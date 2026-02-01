# RelayCraft Community Plugins

[🇺🇸 English](./README.md) | [🇨🇳 中文](./README.zh-CN.md)

Welcome to the official repository for RelayCraft plugins! This repository serves as the central hub for the Plugin Market.

## 🚀 Getting Started

### Browsing Plugins
Each plugin in this repository is distributed as a `.zip` file for easy installation. You can find the list of available plugins in the **Plugin Market** within the RelayCraft application.

### Contributing
We welcome contributions from the community! To submit a new plugin:
1. Fork this repository.
2. Create a new directory for your plugin under `plugins/`.
3. Follow the [Plugin Development Guide](https://github.com/relaycraft/relaycraft/blob/main/docs/plugin-development.md).
4. Submit a Pull Request.

## 📦 Repository Structure
- `plugins/`: Source code for all official and community plugins.
- `plugins.json`: The **Marketplace Manifest**. This is the single source of truth for the RelayCraft plugin market. The application fetches this file to discover, display, and update plugins.
- `assets/`: Icons and screenshots for the plugins.

## 🚀 Market Sync Logic
When the RelayCraft application "syncs with the market," it performs the following:
1. **Fetch Manifest**: Downloads the latest `plugins.json` from the root of this repository.
2. **Metadata Parsing**: Parses the list to display available plugins, versions, and descriptions in the UI.
3. **Installation**: When a user clicks "Install," the app uses the `download_url` specified in the manifest to retrieve the plugin contents.

## 📜 Naming & Packaging
- **Plugin IDs**: Use kebab-case with an optional reverse domain prefix (e.g., `com.user.my-plugin`).
- **Distribution Format**: Plugins are distributed as `.rcplugin` files. This is a standard ZIP archive containing the plugin source.
- **Filenames**: All scripts and configuration files should use `kebab-case`.

## 🛡️ Security
All plugins submitted via Pull Request are reviewed for security and performance. Please ensure your plugin only requests the permissions it strictly requires.

---
Part of the [RelayCraft](https://github.com/relaycraft/relaycraft) ecosystem.
