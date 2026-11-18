import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { after, before, test } from "node:test";
import { createServer } from "vite";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let dom;
let vite;
let React;
let createRoot;
let Modal;
let TotalList;
let previousGlobals;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  previousGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    HTMLElement: globalThis.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });

  vite = await createServer({
    configFile: path.join(projectRoot, "vite.config.js"),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  [{ Modal, TotalList }, React, { createRoot }] = await Promise.all([
    vite.ssrLoadModule("/src/main.jsx"),
    import("react"),
    import("react-dom/client"),
  ]);
});

after(async () => {
  await vite?.close();
  dom?.window.close();
  globalThis.window = previousGlobals.window;
  globalThis.document = previousGlobals.document;
  globalThis.HTMLElement = previousGlobals.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = previousGlobals.IS_REACT_ACT_ENVIRONMENT;
  if (previousGlobals.navigator) {
    Object.defineProperty(globalThis, "navigator", previousGlobals.navigator);
  } else {
    delete globalThis.navigator;
  }
});

test("modal validates names, submits entered text, and supports backdrop dismissal", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const submitted = [];
  let closeCount = 0;
  const props = {
    form: { type: "task" },
    onClose: () => { closeCount += 1; },
    onSubmit: (values) => submitted.push(values),
    isTailwind: false,
  };

  try {
    await React.act(async () => root.render(React.createElement(Modal, props)));
    const input = container.querySelector("#item-name");
    const saveButton = container.querySelector('button[type="submit"]');
    const setInputValue = (value) => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      ).set.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    };

    assert.equal(input.maxLength, 50);
    assert.equal(saveButton.disabled, true);

    await React.act(async () => setInputValue("x".repeat(51)));
    assert.equal(saveButton.disabled, true);

    await React.act(async () => setInputValue("Planning"));
    assert.equal(saveButton.disabled, false);
    assert.match(container.textContent, /Available to track under any project/);

    await React.act(async () => {
      container.querySelector("form").dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    assert.deepEqual(submitted, [{ name: "Planning" }]);

    await React.act(async () => {
      container.firstElementChild.dispatchEvent(
        new dom.window.MouseEvent("mousedown", { bubbles: true }),
      );
    });
    assert.equal(closeCount, 1);
  } finally {
    await React.act(async () => root.unmount());
    container.remove();
  }
});

test("totals component shows empty state and formats populated rows", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const commonProps = {
    className: "",
    title: "By task",
    getLabel: (row) => row.name,
    emptyText: "No tracked tasks.",
    isTailwind: false,
  };

  try {
    await React.act(async () => root.render(
      React.createElement(TotalList, { ...commonProps, rows: [] }),
    ));
    assert.match(container.textContent, /No tracked tasks\./);
    assert.match(container.textContent, /0/);

    await React.act(async () => root.render(
      React.createElement(TotalList, {
        ...commonProps,
        rows: [{ id: 1, name: "Planning", minutes: 125 }],
      }),
    ));
    assert.match(container.textContent, /Planning/);
    assert.match(container.textContent, /02:05/);
  } finally {
    await React.act(async () => root.unmount());
    container.remove();
  }
});
