import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";

const IGNORED_DIRS = new Set([".git", ".github", "scripts", "dist", "node_modules"]);
const RESULTS_FILE = "build_results.json";

function isPluginDir(rootDir, itemName) {
  if (itemName.startsWith(".") || IGNORED_DIRS.has(itemName)) {
    return false;
  }
  const full = path.join(rootDir, itemName);
  if (!fs.statSync(full).isDirectory()) {
    return false;
  }
  return fs.existsSync(path.join(full, "plugin.yaml"));
}

function discoverPlugins(rootDir) {
  return fs
    .readdirSync(rootDir)
    .filter((item) => isPluginDir(rootDir, item))
    .sort();
}

function loadManifest(pluginDir) {
  const manifestPath = path.join(pluginDir, "plugin.yaml");
  const raw = fs.readFileSync(manifestPath, "utf8");
  return yaml.load(raw);
}

function toRelative(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).replaceAll("\\", "/");
}

function runBuild(pluginDir, command) {
  const result = spawnSync(command, {
    cwd: pluginDir,
    shell: true,
    stdio: "pipe",
    encoding: "utf8",
  });

  return {
    success: result.status === 0,
    exitCode: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function main() {
  const rootDir = process.cwd();
  const pluginDirs = discoverPlugins(rootDir);
  const results = {
    generatedAt: new Date().toISOString(),
    plugins: {},
  };

  let failedCount = 0;

  console.log(`[build:ui] Found plugin directories: ${pluginDirs.join(", ")}`);

  for (const pluginName of pluginDirs) {
    const pluginDir = path.join(rootDir, pluginName);
    const manifestPath = path.join(pluginDir, "plugin.yaml");
    const key = toRelative(rootDir, pluginDir);

    let manifest;
    try {
      manifest = loadManifest(pluginDir);
    } catch (error) {
      failedCount += 1;
      results.plugins[key] = {
        pluginId: null,
        pluginDir: key,
        enabled: false,
        status: "manifest_error",
        error: `Failed to parse plugin.yaml: ${String(error)}`,
      };
      continue;
    }

    const pluginId = manifest?.id || null;
    const uiEntry = manifest?.capabilities?.ui?.entry || null;
    const build = manifest?.build || {};
    const enabled = build?.enabled === true;
    const output = build?.output || uiEntry;

    if (!uiEntry) {
      results.plugins[key] = {
        pluginId,
        pluginDir: key,
        enabled,
        status: "no_ui_entry",
        output,
      };
      continue;
    }

    if (!enabled) {
      const entryPath = path.join(pluginDir, uiEntry);
      const exists = fs.existsSync(entryPath);
      results.plugins[key] = {
        pluginId,
        pluginDir: key,
        enabled: false,
        status: exists ? "skipped" : "missing_entry",
        output: uiEntry,
        error: exists ? null : `UI entry not found: ${uiEntry}`,
      };
      if (!exists) {
        failedCount += 1;
      }
      continue;
    }

    if (!output) {
      failedCount += 1;
      results.plugins[key] = {
        pluginId,
        pluginDir: key,
        enabled: true,
        status: "build_failed",
        output: null,
        error: "Missing build.output (or capabilities.ui.entry fallback)",
      };
      continue;
    }

    if (output !== uiEntry) {
      failedCount += 1;
      results.plugins[key] = {
        pluginId,
        pluginDir: key,
        enabled: true,
        status: "build_failed",
        output,
        error: `build.output (${output}) must match capabilities.ui.entry (${uiEntry})`,
      };
      continue;
    }

    const command = build?.command || null;
    if (!command) {
      failedCount += 1;
      results.plugins[key] = {
        pluginId,
        pluginDir: key,
        enabled: true,
        status: "build_failed",
        output,
        error: "build.enabled=true but build.command is empty",
      };
      continue;
    }

    console.log(`[build:ui] Building ${pluginId || key}: ${command}`);
    const run = runBuild(pluginDir, command);
    const outputPath = path.join(pluginDir, output);
    const outputExists = fs.existsSync(outputPath);

    if (!run.success || !outputExists) {
      failedCount += 1;
      results.plugins[key] = {
        pluginId,
        pluginDir: key,
        enabled: true,
        status: "build_failed",
        output,
        command,
        exitCode: run.exitCode,
        outputExists,
        error: !run.success
          ? `Build command failed (exit ${run.exitCode})`
          : `Build output not found: ${output}`,
        stdout: run.stdout,
        stderr: run.stderr,
      };
      continue;
    }

    results.plugins[key] = {
      pluginId,
      pluginDir: key,
      enabled: true,
      status: "built",
      output,
      command,
      exitCode: run.exitCode,
      outputExists: true,
      stdout: run.stdout,
      stderr: run.stderr,
    };
  }

  fs.writeFileSync(path.join(rootDir, RESULTS_FILE), JSON.stringify(results, null, 2), "utf8");
  console.log(`[build:ui] Wrote ${RESULTS_FILE}`);

  if (failedCount > 0) {
    console.log(`[build:ui] Completed with ${failedCount} plugin(s) failed (non-blocking)`);
  } else {
    console.log("[build:ui] Completed successfully");
  }
}

main();
