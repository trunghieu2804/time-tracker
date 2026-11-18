import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";
import { chromium, type Browser } from "playwright";
import { createServer as createViteServer } from "vite";
import type { ViteDevServer } from "vite";
import { createApp } from "../../server/app.js";
import { createDatabase } from "../../server/db.js";
import { createStore } from "../../server/store.js";
import { closeServer, listen } from "../helpers/server.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("browser workflow creates a project and task, tracks time, shows totals, and downloads PDF", async (t: TestContext) => {
  const dataDirectory = mkdtempSync(path.join(os.tmpdir(), "time-tracker-e2e-"));
  const db = createDatabase(path.join(dataDirectory, "test.sqlite"));
  let now = Math.floor(Date.now() / 60_000);
  const { server: apiServer, url: apiUrl } = await listen(
    createApp(createStore(db, { now: () => now })),
  );
  let vite: ViteDevServer | undefined;
  let browser: Browser | undefined;
  t.after(async () => {
    await browser?.close();
    await vite?.close();
    await closeServer(apiServer);
    db.close();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  vite = await createViteServer({
    configFile: path.join(projectRoot, "vite.config.ts"),
    logLevel: "silent",
    server: {
      host: "127.0.0.1",
      port: 0,
      proxy: { "/api": { target: apiUrl, changeOrigin: true } },
    },
  });
  await vite.listen();
  const httpServer = vite.httpServer;
  if (!httpServer) {
    throw new Error("Vite did not create an HTTP server.");
  }
  const webAddress = httpServer.address();
  if (!webAddress || typeof webAddress === "string") {
    throw new Error("Vite did not bind to a TCP port.");
  }
  browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({ acceptDownloads: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${webAddress.port}`);
  await page.getByRole("heading", { name: "Projects" }).waitFor();
  await page.getByText("No Project", { exact: false }).first().waitFor();

  await page.getByRole("button", { name: "Add project" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.locator("#item-name").fill("Project North");
  await dialog.getByRole("button", { name: "Save project" }).click();
  await page.getByRole("button", { name: "Project North", exact: false }).first().waitFor();

  await page.locator(".project-select").filter({ hasText: "Project North" }).click();
  await page.getByRole("button", { name: "Add task" }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator("#item-name").fill("Planning");
  await dialog.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("button", { name: "Planning", exact: false }).first().waitFor();

  await page.locator(".task-select").filter({ hasText: "Planning" }).click();
  await page.getByRole("heading", { name: "Timer running" }).waitFor();
  now += 3;
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("heading", { name: "Timer paused" }).waitFor();
  now += 2;
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("heading", { name: "Timer running" }).waitFor();
  now += 2;
  await page.getByRole("button", { name: "End task" }).click();
  await page.getByRole("heading", { name: "Ready when you are" }).waitFor();
  await page.locator(".card")
    .filter({ has: page.getByRole("heading", { name: "By task" }) })
    .getByText("00:05", { exact: true })
    .waitFor();
  assert.deepEqual(pageErrors, []);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Generate PDF timesheet" }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^timesheet-\d{4}-\d{2}-\d{2}\.pdf$/);

  await page.locator("#ui-framework").selectOption("tailwind");
  await page.locator('[data-framework="tailwind"]').waitFor();
  await page.reload();
  await page.locator('[data-framework="tailwind"]').waitFor();
});
