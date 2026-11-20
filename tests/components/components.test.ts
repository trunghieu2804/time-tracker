import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { after, before, test } from "node:test";
import type * as ReactTypes from "react";
import type { App as AppComponent, ModalProps, TotalListProps, TotalRowDataItem } from "../../src/main.js";
import type { ViteDevServer } from "vite";
import { createServer } from "vite";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let dom: JSDOM;
let vite: ViteDevServer;
let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let Modal: ReactTypes.ComponentType<ModalProps>;
let TotalList: ReactTypes.ComponentType<TotalListProps<TotalRowDataItem>>;
let App: typeof AppComponent;
let previousGlobals: Record<string, PropertyDescriptor | undefined>;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const globalNames = ["window", "document", "navigator", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
  previousGlobals = Object.fromEntries(globalNames.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]));
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
    navigator: {
      configurable: true,
      value: dom.window.navigator,
    },
  });

  vite = await createServer({
    configFile: path.join(projectRoot, "vite.config.ts"),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  [{ App, Modal, TotalList }, React, { createRoot }] = await Promise.all([
    vite.ssrLoadModule("/src/main.tsx"),
    import("react"),
    import("react-dom/client"),
  ]);
});

after(async () => {
  await vite?.close();
  dom?.window.close();
  for (const [name, descriptor] of Object.entries(previousGlobals)) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  }
});

test("dark mode applies immediately and restores the saved choice after remount", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    projects: [{ id: 1, name: "No Project", isBuiltin: true }],
    tasks: [],
    timer: { status: "idle", taskId: null, projectId: null, elapsedMinutes: 0 },
    totals: { dayKey: "2026-01-01", byTask: [], byProject: [], byTaskProject: [] },
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let restoredRoot: ReturnType<typeof createRoot> | undefined;

  try {
    window.localStorage.clear();
    await React.act(async () => root.render(React.createElement(App)));
    const toggle = container.querySelector<HTMLInputElement>("#dark-mode");
    const appShell = container.querySelector<HTMLElement>(".app-shell");
    assert.ok(toggle);
    assert.ok(appShell);
    assert.equal(toggle.checked, false);
    assert.equal(appShell.dataset.theme, "light");

    await React.act(async () => toggle.click());
    assert.equal(window.localStorage.getItem("time-tracker-dark-mode"), "true");
    assert.equal(appShell.dataset.theme, "dark");
    assert.equal(appShell.dataset.bsTheme, "dark");

    await React.act(async () => root.unmount());
    restoredRoot = createRoot(container);
    await React.act(async () => restoredRoot?.render(React.createElement(App)));
    const restoredToggle = container.querySelector<HTMLInputElement>("#dark-mode");
    assert.ok(restoredToggle);
    assert.equal(restoredToggle.checked, true);
    assert.equal(container.querySelector(".app-shell")?.getAttribute("data-theme"), "dark");
  } finally {
    await React.act(async () => {
      if (restoredRoot) {
        restoredRoot.unmount();
      } else {
        root.unmount();
      }
    });
    container.remove();
    globalThis.fetch = originalFetch;
    window.localStorage.clear();
  }
});

test("modal validates names, submits entered text, and supports backdrop dismissal", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const submitted: Array<{ name: string }> = [];
  let closeCount = 0;
  const props: ModalProps = {
    form: { type: "task" },
    onClose: () => { closeCount += 1; },
    onSubmit: (values: { name: string }) => { submitted.push(values); },
    isTailwind: false,
  };

  try {
    await React.act(async () => root.render(React.createElement(Modal, props)));
    const input = container.querySelector<HTMLInputElement>("#item-name");
    const saveButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    assert.ok(input);
    assert.ok(saveButton);
    const setInputValue = (value: string) => {
      const inputValueSetter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )?.set;
      assert.ok(inputValueSetter);
      inputValueSetter.call(input, value);
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
      container.querySelector("form")?.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    assert.deepEqual(submitted, [{ name: "Planning" }]);

    await React.act(async () => {
      container.firstElementChild?.dispatchEvent(
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
    getLabel: (row: TotalRowDataItem) => (
      "name" in row ? row.name : `${row.projectName} / ${row.taskName}`
    ),
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
