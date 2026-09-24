/**
 * The handful of very new JavaScript APIs pdf.js 6 assumes, filled in for the
 * browsers our readers actually have.
 *
 * pdf.js 6 targets current desktop browsers. On the phones that arrive from an
 * ad it calls four things that do not exist yet:
 *
 *   Promise.withResolvers   Safari 17.4, Chrome 119
 *   Promise.try             Safari 18.2, Chrome 128
 *   URL.parse               Safari 18.4, Chrome 126
 *   AbortSignal.any         Safari 17.4, Chrome 116
 *
 * So the library threw before reading a byte, and every upload from an iPhone
 * a year or two old ended in "something went wrong" while the same file
 * worked on a laptop. Each of these is a few lines to provide; none of them
 * changes behaviour where the browser already has its own.
 *
 * Exported as a string as well, because the worker has its own global scope
 * and needs the same treatment (public/pdf.worker.shim.mjs).
 */
export function installModernPolyfills() {
  const g = globalThis as unknown as Record<string, unknown>;

  const P = Promise as unknown as {
    withResolvers?: unknown;
    try?: unknown;
  };

  if (typeof P.withResolvers !== "function") {
    P.withResolvers = function <T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  if (typeof P.try !== "function") {
    P.try = function (fn: (...args: unknown[]) => unknown, ...args: unknown[]) {
      return new Promise((resolve) => resolve(fn(...args)));
    };
  }

  const U = g.URL as unknown as {
    parse?: unknown;
    canParse?: unknown;
    new (url: string, base?: string): URL;
  };

  if (U && typeof U.parse !== "function") {
    U.parse = function (url: string, base?: string) {
      try {
        return base === undefined ? new URL(url) : new URL(url, base);
      } catch {
        return null;
      }
    };
  }

  if (U && typeof U.canParse !== "function") {
    U.canParse = function (url: string, base?: string) {
      try {
        void (base === undefined ? new URL(url) : new URL(url, base));
        return true;
      } catch {
        return false;
      }
    };
  }

  const AS = g.AbortSignal as unknown as {
    any?: unknown;
    prototype?: unknown;
  };

  if (AS && typeof AS.any !== "function") {
    AS.any = function (signals: AbortSignal[]) {
      const controller = new AbortController();
      for (const signal of signals) {
        if (signal.aborted) {
          controller.abort(signal.reason);
          break;
        }
        signal.addEventListener("abort", () => controller.abort(signal.reason), {
          once: true,
        });
      }
      return controller.signal;
    };
  }
}
