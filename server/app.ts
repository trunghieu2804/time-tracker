import express from "express";
import type { ErrorRequestHandler } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "./store.js";
import type { TimeTrackerStore } from "./store.js";
import { createTimesheetPdf } from "../src/timesheet.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createApp(
  store: TimeTrackerStore,
  { serveClient = false }: { serveClient?: boolean } = {},
) {
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

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const details: Error & { statusCode?: unknown; type?: unknown } = error instanceof Error
      ? error as Error & { statusCode?: unknown; type?: unknown }
      : new Error("Unknown server error.");
    const statusCode = details.statusCode;
    const clientErrorStatus = typeof statusCode === "number" &&
      Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500
      ? statusCode
      : null;
    const status = details instanceof AppError ? details.status : clientErrorStatus ?? 500;
    if (status === 500) {
      console.error(error);
    }
    const message = status === 500
      ? "An unexpected server error occurred."
      : details.type === "entity.parse.failed"
        ? "Request body must contain valid JSON."
        : details.type === "entity.too.large"
          ? "Request body is too large."
          : details.message;
    res.status(status).json({
      error: message,
    });
  };
  app.use(errorHandler);

  if (serveClient) {
    const clientDist = path.join(projectRoot, "dist");
    app.use(express.static(clientDist));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}
