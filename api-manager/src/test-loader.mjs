// Node resolve hook for strip-types tests: repo source uses extensionless
// relative imports (bundler-style), which Node ESM does not resolve. Appends
// ".ts" so `node --experimental-strip-types --experimental-loader` can import
// them directly in tests. Test infrastructure only — never bundled.
export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(ts|tsx|mjs|js|json|d\.ts)$/.test(specifier)
  ) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier}.ts`, context);
    }
  }
  return nextResolve(specifier, context);
}
