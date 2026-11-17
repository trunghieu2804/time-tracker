import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) {
    return null;
  }
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "The request could not be completed.");
  }
  return body;
}

function formatDuration(minutes) {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatDay(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function Modal({ form, onClose, onSubmit }) {
  const [name, setName] = useState(form.name || "");
  const isTask = form.type === "task";

  function submit(event) {
    event.preventDefault();
    onSubmit({ name });
  }

  return (
    <div className="modal d-block" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="modal-dialog modal-dialog-centered">
        <section className="modal-content border-0 shadow" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-header">
            <div>
              <p className="text-uppercase text-secondary small fw-semibold mb-1">{form.id ? "Edit" : "Add"} {form.type}</p>
              <h2 className="modal-title fs-5 fw-semibold" id="modal-title">{form.id ? "Update" : "Create"} {form.type}</h2>
            </div>
            <button className="btn-close" type="button" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={submit}>
            <div className="modal-body">
              <label className="form-label fw-semibold" htmlFor="item-name">Name</label>
              <input
                id="item-name"
                className="form-control"
                autoFocus
                maxLength={50}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={`${form.type} name`}
                required
              />
              <div className="form-text text-end">{name.length}/50 characters</div>
              {isTask && <p className="form-text mb-0 mt-2">Available to track under any project.</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" type="button" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary px-4" type="submit" disabled={!name.trim() || name.length > 50}>
                Save {form.type}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function TotalList({ className, title, rows, getLabel, emptyText }) {
  return (
    <div className={className}>
      <section className="card h-100 shadow-sm border-0">
        <div className="card-header bg-white d-flex align-items-center justify-content-between py-3">
          <h3 className="h6 fw-semibold mb-0">{title}</h3>
          <span className="badge text-bg-light border fw-medium">{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-secondary small text-center my-auto py-4">{emptyText}</p>
        ) : (
          <ul className="list-group list-group-flush">
            {rows.map((row, index) => (
              <li className="list-group-item d-flex justify-content-between align-items-center gap-3 py-2" key={`${row.id ?? `${row.taskId}-${row.projectId}`}-${index}`}>
                <span className="text-truncate small">{getLabel(row)}</span>
                <strong className="font-monospace small flex-shrink-0">{formatDuration(row.minutes)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const next = await request("/api/bootstrap");
    setData(next);
    setSelectedProjectId((current) => {
      const currentExists = next.projects.some((project) => project.id === current);
      if (currentExists) return current;
      if (next.timer.projectId) return next.timer.projectId;
      return next.projects.find((project) => project.isBuiltin)?.id ?? null;
    });
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause.message));
    const interval = window.setInterval(() => setClock(Date.now()), 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const projects = data?.projects ?? [];
  const tasks = data?.tasks ?? [];
  const timer = data?.timer;
  const totals = data?.totals;
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const visibleTasks = tasks;
  const timerTask = tasks.find((task) => task.id === timer?.taskId);
  const timerProject = projects.find((project) => project.id === timer?.projectId);
  const activeElapsed = timer?.status === "running" && timer.startMinute
    ? timer.elapsedMinutes + Math.max(0, Math.floor(clock / 60_000) - timer.startMinute)
    : timer?.status === "paused" ? timer.elapsedMinutes : 0;

  async function perform(action) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function timerAction(action, taskId, projectId) {
    return perform(async () => {
      await request(`/api/timer/${action}`, {
        method: "POST",
        body: JSON.stringify({ taskId, projectId }),
      });
    });
  }

  function selectProject(projectId) {
    setSelectedProjectId(projectId);
    if (timer?.status === "running" && timer.projectId !== projectId) {
      timerAction("switch", timer.taskId, projectId);
    }
  }

  function saveEntity(values) {
    const form = modal;
    perform(async () => {
      if (form.type === "project") {
        await request(form.id ? `/api/projects/${form.id}` : "/api/projects", {
          method: form.id ? "PATCH" : "POST",
          body: JSON.stringify({ name: values.name }),
        });
      } else {
        await request(form.id ? `/api/tasks/${form.id}` : "/api/tasks", {
          method: form.id ? "PATCH" : "POST",
          body: JSON.stringify({ name: values.name }),
        });
      }
      setModal(null);
    });
  }

  function deleteEntity(type, id, name) {
    if (!window.confirm(`Delete ${type.toLowerCase()} "${name}"?`)) return;
    perform(async () => {
      await request(`/api/${type.toLowerCase()}s/${id}`, { method: "DELETE" });
    });
  }

  if (!data) {
    return (
      <main className="container min-vh-100 d-flex flex-column align-items-center justify-content-center gap-3">
        <div className="spinner-border text-primary" role="status" aria-label="Loading" />
        <p className="text-secondary mb-0">{error || "Opening your time tracker…"}</p>
        {error && <button className="btn btn-primary" onClick={() => refresh().catch((cause) => setError(cause.message))}>Try again</button>}
      </main>
    );
  }

  return (
    <div className="app-shell min-vh-100">
      <header className="app-header bg-white border-bottom">
        <div className="container-xxl d-flex align-items-center justify-content-between py-3">
          <a className="brand d-flex align-items-center gap-2 text-decoration-none" href="/" aria-label="Time Tracker home">
            <span className="brand-mark d-inline-flex align-items-center justify-content-center rounded-2 fw-bold">T</span>
            <span className="fw-semibold text-dark">Time Tracker</span>
          </a>
          <div className="text-end">
            <div className="small text-secondary">Tracking day</div>
            <div className="d-flex align-items-center gap-2">
              <strong className="text-dark">{formatDay(totals.dayKey)}</strong>
              <span className="badge rounded-pill text-bg-light border fw-normal">4:00 AM – 3:59 AM</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container-xxl py-4 py-lg-5">
        {error && (
          <div className="alert alert-danger alert-dismissible d-flex align-items-center gap-2" role="alert">
            <span className="flex-grow-1">{error}</span>
            <button type="button" className="btn-close" onClick={() => setError("")} aria-label="Dismiss error" />
          </div>
        )}

        <div className="row g-3 g-xl-4 align-items-stretch">
          <aside className="col-12 col-lg-3">
            <section className="card h-100 shadow-sm border-0">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center pt-4 px-4 pb-2">
                <div>
                  <p className="text-uppercase text-secondary small fw-semibold mb-1">Workspace</p>
                  <h1 className="h5 fw-semibold mb-0">Projects</h1>
                </div>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setModal({ type: "project" })} aria-label="Add project" title="Add project">
                  <span aria-hidden="true">+</span> Add
                </button>
              </div>
              <div className="card-body pt-2 px-3">
                <div className="list-group list-group-flush gap-1">
                  {projects.map((project) => (
                    <div className={`project-row list-group-item d-flex align-items-center gap-2 border-0 rounded-2 px-2 py-2 ${project.id === selectedProjectId ? "active-project" : ""}`} key={project.id}>
                      <button
                        className={`btn project-select flex-grow-1 text-start px-2 py-1 ${project.id === selectedProjectId ? "text-primary fw-semibold" : "text-body-secondary"}`}
                        onClick={() => selectProject(project.id)}
                        aria-current={project.id === selectedProjectId ? "page" : undefined}
                      >
                        <span className="project-marker me-2" aria-hidden="true" />
                        {project.name}
                        {project.isBuiltin && <span className="badge text-bg-light border fw-normal ms-2">Default</span>}
                      </button>
                      {!project.isBuiltin && (
                        <div className="project-actions btn-group btn-group-sm">
                          <button className="btn btn-light border-0" title="Rename project" aria-label={`Rename ${project.name}`} onClick={() => setModal({ type: "project", id: project.id, name: project.name })}>Edit</button>
                          <button className="btn btn-light border-0 text-danger" title="Delete project" aria-label={`Delete ${project.name}`} onClick={() => deleteEntity("project", project.id, project.name)}>×</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-footer bg-white border-0 px-4 pb-4 pt-2">
                <p className="small text-secondary mb-0">Every task is available under every project.</p>
              </div>
            </section>
          </aside>

          <section className="col-12 col-lg-5">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between pt-4 px-4 pb-3">
                <div>
                  <p className="text-uppercase text-secondary small fw-semibold mb-1">Select an activity</p>
                  <h2 className="h5 fw-semibold mb-0">{selectedProject?.name || "Tasks"}</h2>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: "task" })}>
                  <span aria-hidden="true">+</span> Add task
                </button>
              </div>
              {visibleTasks.length === 0 ? (
                <div className="card-body d-flex flex-column align-items-center justify-content-center text-center py-5">
                  <div className="empty-icon rounded-circle d-flex align-items-center justify-content-center mb-3">✓</div>
                  <h3 className="h6 fw-semibold">No tasks yet</h3>
                  <p className="text-secondary small mb-3">Create a task once, then use it with any project.</p>
                  <button className="btn btn-outline-primary btn-sm" onClick={() => setModal({ type: "task" })}>Create your first task</button>
                </div>
              ) : (
                <div className="card-body pt-0 px-3 pb-3">
                  <div className="list-group task-list">
                    {visibleTasks.map((task) => {
                      const isRunning = timer?.status === "running" &&
                        timer.taskId === task.id &&
                        timer.projectId === selectedProjectId;
                      return (
                        <div className={`list-group-item task-row d-flex align-items-center gap-2 rounded-2 mb-2 px-2 py-2 ${isRunning ? "task-running" : ""}`} key={task.id}>
                          <button
                            className="btn task-select flex-grow-1 d-flex align-items-center gap-3 text-start border-0 px-2 py-1"
                            disabled={busy}
                            onClick={() => timerAction(timer?.status === "running" ? "switch" : "start", task.id, selectedProjectId)}
                          >
                            <span className={`task-play d-inline-flex align-items-center justify-content-center rounded-2 ${isRunning ? "is-playing" : ""}`} aria-hidden="true">
                              {isRunning ? <span className="playing-bars"><i /><i /><i /></span> : <span className="play-triangle" />}
                            </span>
                            <span className="task-name fw-medium">{task.name}</span>
                            <span className={`task-action badge ms-auto ${isRunning ? "text-bg-success" : "text-bg-light border text-secondary"}`}>
                              {isRunning ? "Tracking" : timer?.status === "running" ? "Switch" : "Start"}
                            </span>
                          </button>
                          <div className="task-actions btn-group btn-group-sm">
                            <button className="btn btn-light border-0" title="Edit task" aria-label={`Edit ${task.name}`} onClick={() => setModal({ type: "task", id: task.id, name: task.name })}>Edit</button>
                            <button className="btn btn-light border-0 text-danger" title="Delete task" aria-label={`Delete ${task.name}`} onClick={() => deleteEntity("task", task.id, task.name)}>×</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="col-12 col-lg-4">
            <div className="card timer-card h-100 shadow-sm border-0">
              <div className="card-header bg-white border-0 d-flex align-items-start justify-content-between pt-4 px-4 pb-2">
                <div>
                  <p className="text-uppercase text-secondary small fw-semibold mb-1">Current activity</p>
                  <h2 className="h6 fw-semibold mb-0">{timer?.status === "running" ? "Timer running" : timer?.status === "paused" ? "Timer paused" : "Ready when you are"}</h2>
                </div>
                <span className={`badge rounded-pill ${timer?.status === "running" ? "text-bg-success" : timer?.status === "paused" ? "text-bg-warning" : "text-bg-light border text-secondary"}`}>
                  {timer?.status === "running" ? "LIVE" : timer?.status === "paused" ? "PAUSED" : "IDLE"}
                </span>
              </div>
              <div className="card-body d-flex flex-column pt-2 px-4 pb-4">
                <div className="timer-display text-center d-flex flex-column align-items-center justify-content-center flex-grow-1 py-4">
                  {timerTask ? (
                    <>
                      <div className="current-task-name fw-semibold">{timerTask.name}</div>
                      <div className="text-secondary small mt-1">{timerProject?.name}</div>
                    </>
                  ) : (
                    <div className="text-secondary small mb-2">Select a task to begin tracking</div>
                  )}
                  <div className="elapsed-time font-monospace fw-semibold mt-3" aria-live="off">{formatDuration(activeElapsed)}</div>
                  <div className="text-uppercase text-secondary small timer-caption">{timer?.status === "running" ? "Elapsed this session" : "Hours : minutes"}</div>
                </div>
                <div className="d-flex flex-wrap justify-content-center gap-2">
                  {timer?.status === "running" ? (
                    <>
                      <button className="btn btn-outline-secondary" disabled={busy} onClick={() => timerAction("pause")}>Pause</button>
                      <button className="btn btn-primary" disabled={busy} onClick={() => timerAction("end")}>End task</button>
                    </>
                  ) : timer?.status === "paused" ? (
                    <>
                      <button className="btn btn-primary" disabled={busy} onClick={() => timerAction("resume")}>Resume</button>
                      <button className="btn btn-outline-secondary" disabled={busy} onClick={() => timerAction("end")}>End task</button>
                    </>
                  ) : (
                    <span className="text-secondary small">Choose a task to start your timer.</span>
                  )}
                </div>
                <div className="border-top mt-4 pt-3 text-center text-secondary small">Your time is saved on this computer.</div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-4 mt-lg-5">
          <div className="d-flex align-items-end justify-content-between mb-3">
            <div>
              <p className="text-uppercase text-secondary small fw-semibold mb-1">Daily summary</p>
              <h2 className="h5 fw-semibold mb-0">Time totals</h2>
            </div>
            <span className="small text-secondary">{formatDay(totals.dayKey)}</span>
          </div>
          <div className="row g-3">
            <TotalList
              className="col-12 col-md-4"
              title="By task"
              rows={totals.byTask}
              getLabel={(row) => row.name}
              emptyText="Tracked task time will appear here."
            />
            <TotalList
              className="col-12 col-md-4"
              title="By project"
              rows={totals.byProject}
              getLabel={(row) => row.name}
              emptyText="Tracked project time will appear here."
            />
            <TotalList
              className="col-12 col-md-4"
              title="Task per project"
              rows={totals.byTaskProject}
              getLabel={(row) => <><span className="breakdown-project">{row.projectName}</span><span className="breakdown-separator">/</span>{row.taskName}</>}
              emptyText="Task and project totals will appear here."
            />
          </div>
        </section>
        <footer className="border-top mt-4 pt-3 text-center text-secondary small">Time is recorded to the minute · Tracking day starts at 4:00 AM</footer>
      </main>
      {modal && (
        <Modal
          form={modal}
          onClose={() => setModal(null)}
          onSubmit={saveEntity}
        />
      )}
      {modal && <div className="modal-backdrop show" />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
