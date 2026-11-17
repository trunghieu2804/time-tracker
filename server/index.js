import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";
import { createDatabase } from "./db.js";
import { createStore } from "./store.js";

function getDataDirectory() {
  if (process.env.APP_DATA_DIR) {
    return path.resolve(process.env.APP_DATA_DIR);
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || os.homedir(), "time-tracker");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "time-tracker");
  }
  return path.join(os.homedir(), ".local", "share", "time-tracker");
}

const dataDirectory = getDataDirectory();
fs.mkdirSync(dataDirectory, { recursive: true });

const db = createDatabase(path.join(dataDirectory, "time-tracker.sqlite"));
const store = createStore(db);
const app = createApp(store, { serveClient: true });
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Time Tracker is available at http://127.0.0.1:${port}`);
  console.log(`Local database: ${path.join(dataDirectory, "time-tracker.sqlite")}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
