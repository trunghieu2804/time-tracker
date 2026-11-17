import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "./store.js";
import { createTimesheetPdf } from "../src/timesheet.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createApp(store, { serveClient = false } = {}) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/bootstrap", (_req, res) => {
    res.json(store.getBootstrap());
  });

  app.get("/api/timesheet.pdf", async (_req, res) => {
    const report = store.getTimesheet();
    const pdf = await createTimesheetPdf(report);
    res.type("application/pdf");
    res.attachment(`timesheet-${report.dayKey}.pdf`);
    res.send(Buffer.from(pdf.output("arraybuffer")));
  });

  app.post("/api/projects", (req, res) => {
    res.status(201).json(store.createProject(req.body?.name));
  });
  app.patch("/api/projects/:id", (req, res) => {
    res.json(store.updateProject(Number(req.params.id), req.body?.name));
  });
  app.delete("/api/projects/:id", (req, res) => {
    store.deleteProject(Number(req.params.id));
    res.status(204).end();
  });

  app.post("/api/tasks", (req, res) => {
    res.status(201).json(store.createTask(req.body?.name));
  });
  app.patch("/api/tasks/:id", (req, res) => {
    res.json(store.updateTask(Number(req.params.id), req.body?.name));
  });
  app.delete("/api/tasks/:id", (req, res) => {
    store.deleteTask(Number(req.params.id));
    res.status(204).end();
  });

  app.post("/api/timer/:action", (req, res) => {
    res.json(store.timerAction(
      req.params.action,
      req.body?.taskId,
      req.body?.projectId,
    ));
  });

  app.use((error, _req, res, _next) => {
    const status = error instanceof AppError ? error.status : 500;
    if (status === 500) {
      console.error(error);
    }
    res.status(status).json({
      error: status === 500 ? "An unexpected server error occurred." : error.message,
    });
  });

  if (serveClient) {
    const clientDist = path.join(projectRoot, "dist");
    app.use(express.static(clientDist));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}
