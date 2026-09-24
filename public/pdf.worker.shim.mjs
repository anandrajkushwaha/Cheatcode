// The worker has its own global scope, so the polyfills the page installs do
// not reach it. Same four APIs as lib/tools/modern-polyfills.ts — pdf.js 6
// assumes browsers newer than most phones in India are running.
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Promise.try !== "function") {
  Promise.try = function (fn, ...args) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

if (typeof URL.parse !== "function") {
  URL.parse = function (url, base) {
    try {
      return base === undefined ? new URL(url) : new URL(url, base);
    } catch {
      return null;
    }
  };
}

if (typeof URL.canParse !== "function") {
  URL.canParse = function (url, base) {
    try {
      base === undefined ? new URL(url) : new URL(url, base);
      return true;
    } catch {
      return false;
    }
  };
}

if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any !== "function") {
  AbortSignal.any = function (signals) {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        break;
      }
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
    return controller.signal;
  };
}

await import("/pdf.worker.min.mjs");
