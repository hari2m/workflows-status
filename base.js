(() => {
  "use strict";
  // GitHub Pages serves this app at /<repo>/; self-hosted serves it at /.
  // base.js lives in the app root, so its own URL reveals the base path.
  let p = new URL(document.currentScript.src).pathname;
  p = p.slice(0, p.indexOf("base.js"));
  if (!p.endsWith("/")) p += "/";
  window.APP_BASE = p;
})();
