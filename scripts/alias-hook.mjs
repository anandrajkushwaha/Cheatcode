/**
 * Resolve the project's `@/` alias for plain `node --experimental-strip-types`.
 *
 * Exists so a pure function in lib/ can be unit-tested without a bundler, a
 * test runner or a server. Node has no idea about tsconfig paths, and the
 * alternative — relative imports in the files under test, or a second copy of
 * the logic in the test — is worse than a dozen lines of resolver.
 *
 *   node --experimental-strip-types --import ./scripts/alias-hook.mjs x.test.ts
 *
 * Only for files that are pure. Anything importing `server-only`, a database
 * client or the llm client will fail here, and should: those want a running
 * app, not a unit test.
 */
import { pathToFileURL } from "node:url";
import { register } from "node:module";

process.env.ALIAS_ROOT = pathToFileURL(`${process.cwd()}/`).href;
register("./alias-resolver.mjs", import.meta.url);
