/**
 * The resolver half of alias-hook.mjs. See that file for why this exists.
 *
 * A real file rather than a `data:` URL: newlines and comments inside a data
 * URL get cut, and the module arrives half-written as "Unexpected end of
 * input" from a stack trace that names no file.
 */
const root = process.env.ALIAS_ROOT;

export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  const base = root + specifier.slice(2);
  // tsconfig paths resolve extensionless; node does not.
  for (const ext of [".ts", ".tsx", "/index.ts", ""]) {
    try {
      return await next(base + ext, context);
    } catch {
      // Try the next spelling.
    }
  }
  return next(base, context);
}
