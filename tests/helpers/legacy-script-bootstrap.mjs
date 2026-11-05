import { runInNewContext } from 'node:vm';

// Minimal DOM/storage/timer fixture, never a graphics or live-service substitute.
// Rendering/timers stay idle; every shipped classic script executes unchanged.
export async function bootstrapLegacyPage(html, readAsset) {
  const nodes = new Map();
  const listeners = [];
  const contexts = [];
  const scripts = [];
  const element = () => ({
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    value: '',
    textContent: '',
    options: [],
    getContext(type) {
      contexts.push(type);
      return null;
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener(name, callback) {
      listeners.push({ name, callback });
    },
    removeAttribute() {},
    append() {},
    insertAdjacentHTML() {},
  });
  const querySelector = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  const storage = { getItem: () => null, setItem() {} };
  const context = {
    document: {
      querySelector,
      querySelectorAll: () => [],
      documentElement: element(),
      body: element(),
      createElement: element,
    },
    location: { protocol: 'file:', hash: '' },
    localStorage: storage,
    sessionStorage: storage,
    navigator: {},
    performance: { now: () => 0 },
    addEventListener() {},
    requestAnimationFrame() {},
    setTimeout() {},
    clearTimeout() {},
    setInterval() {},
    clearInterval() {},
    Intl,
    URL,
    console,
  };
  context.window = context;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)) {
    const src = /\bsrc="\.\/([^"]+)"/u.exec(match[1]);
    const source = src ? await readAsset(src[1]) : match[2];
    scripts.push(src?.[1] || 'inline');
    runInNewContext(source, context, { timeout: 1000, filename: src?.[1] || 'inline' });
  }
  await new Promise((resolve) => setImmediate(resolve));
  return { context, nodes, listeners, contexts, scripts };
}
