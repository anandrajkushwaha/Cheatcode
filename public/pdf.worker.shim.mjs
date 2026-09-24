// pdf.js 6's worker calls Promise.withResolvers, which Safari only learned in
// 17.4 — and every in-app browser (Instagram, Facebook) is Safari on iOS.
// Module workers arrived in 16.4, so on 16.4–17.3 the worker starts happily
// and then throws on the first page, which is why "Choose a file" ended in
// "something went wrong" on phones and worked on laptops. The polyfill has to
// live inside the worker: its global scope is not the page's.
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

await import("/pdf.worker.min.mjs");
