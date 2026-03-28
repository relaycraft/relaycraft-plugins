import { defineConfig } from "vite";
import { resolve } from "node:path";
import cssInjectedByJs from "vite-plugin-css-injected-by-js";
import tailwindcss from "@tailwindcss/postcss";

/**
 * PostCSS plugin: isolate plugin CSS from the host application.
 *
 * After Tailwind processes the CSS, this plugin:
 *  1. Removes `@layer properties { * { ... } }` (host provides it)
 *  2. Removes `:root { ... }` theme variable declarations (host owns them)
 *  3. Scopes every remaining rule under `.api-manager-root` so plugin CSS
 *     NEVER affects host elements outside the plugin container.
 */
function isolatePluginCss() {
  return {
    postcssPlugin: "isolate-plugin-css",

    OnceExit(root: any) {
      root.walk((node: any) => {
        // 1. Strip @layer properties (host provides Tailwind internals)
        if (node.type === "atrule" && node.name === "layer" && node.params.trim() === "properties") {
          node.remove();
          return;
        }

        // 2. Strip :root / :host variable declarations
        if (node.type === "rule" && /^:root\b/.test(node.selector)) {
          node.remove();
          return;
        }

        // 3. Scope all rules under .api-manager-root
        if (node.type === "rule") {
          // Skip rules inside @keyframes (they use % / from / to selectors)
          if (node.parent?.type === "atrule" && node.parent.name === "keyframes") return;

          node.selectors = node.selectors.map((sel: string) => {
            if (sel.startsWith(".api-manager-root")) return sel;
            return `.api-manager-root ${sel}`;
          });
        }
      });
    },
  };
}
isolatePluginCss.postcss = true;

export default defineConfig({
  plugins: [cssInjectedByJs()],
  css: {
    postcss: {
      plugins: [tailwindcss(), isolatePluginCss()],
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "ApiManagerPlugin",
      fileName: () => "index.js",
      formats: ["iife"],
    },
    outDir: __dirname,
    emptyOutDir: false,
    minify: "esbuild",
    target: "es2020",
    cssMinify: "esbuild",
  },
});
