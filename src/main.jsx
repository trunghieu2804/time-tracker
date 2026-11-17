import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
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
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{form.id ? "Edit" : "Add"} {form.type}</p>
            <h2 id="modal-title">{form.id ? "Update" : "Create"} {form.type}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="item-name">Name</label>
          <input
            id="item-name"
            autoFocus
            maxLength={50}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={`${form.type} name`}
            required
          />
          <div className="character-count">{name.length}/50</div>
          {isTask && <p className="field-help task-scope-note">Available to track under any project.</p>}
          <div className="modal-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={!name.trim() || name.length > 50}>
              Save {form.type}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TotalList({ title, rows, getLabel, emptyText }) {
  return (
    <section className="total-card">
      <div className="total-heading">
        <h3>{title}</h3>
        <span>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty-note">{emptyText}</p>
      ) : (
        <ul className="total-list">
          {rows.map((row, index) => (
            <li key={`${row.id ?? `${row.taskId}-${row.projectId}`}-${index}`}>
              <span>{getLabel(row)}</span>
              <strong>{formatDuration(row.minutes)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
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
      <main className="loading-screen">
        <div className="loading-mark">T</div>
        <p>{error || "Opening your time tracker…"}</p>
        {error && <button className="button button-primary" onClick={() => refresh().catch((cause) => setError(cause.message))}>Try again</button>}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Time Tracker home">
          <span className="brand-mark">T</span>
          <span>time<span className="brand-light">track</span></span>
        </a>
        <div className="tracking-day">
          <span className="day-dot" />
          <span>Tracking day</span>
          <strong>{formatDay(totals.dayKey)}</strong>
          <span className="day-boundary">4:00 AM – 3:59 AM</span>
        </div>
      </header>

      <main className="workspace">
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button className="icon-button" onClick={() => setError("")} aria-label="Dismiss error">×</button>
          </div>
        )}

        <div className="workspace-grid">
          <aside className="project-panel panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Organize</p>
                <h1>Projects</h1>
              </div>
              <button className="icon-button add-button" onClick={() => setModal({ type: "project" })} aria-label="Add project" title="Add project">+</button>
            </div>
            <div className="project-list">
              {projects.map((project) => (
                <div className={`project-row ${project.id === selectedProjectId ? "selected" : ""}`} key={project.id}>
                  <button className="project-select" onClick={() => selectProject(project.id)}>
                    <span className={`project-icon ${project.isBuiltin ? "project-icon-muted" : ""}`} />
                    <span>{project.name}</span>
                    {project.isBuiltin && <span className="built-in-tag">Default</span>}
                  </button>
                  {!project.isBuiltin && (
                    <div className="row-actions">
                      <button className="icon-button tiny" title="Rename project" aria-label={`Rename ${project.name}`} onClick={() => setModal({ type: "project", id: project.id, name: project.name })}>···</button>
                      <button className="icon-button tiny danger-hover" title="Delete project" aria-label={`Delete ${project.name}`} onClick={() => deleteEntity("project", project.id, project.name)}>×</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="project-footnote">
              <span className="info-icon">i</span>
              <span>Any task can be tracked under any project.</span>
            </div>
          </aside>

          <section className="task-panel panel">
            <div className="panel-heading task-heading">
              <div>
                <p className="eyebrow">Choose what to work on</p>
                <h1>{selectedProject?.name || "Tasks"}</h1>
              </div>
              <button className="button button-secondary" onClick={() => setModal({ type: "task" })}>
                <span className="button-plus">+</span> Add task
              </button>
            </div>
            {visibleTasks.length === 0 ? (
              <div className="empty-tasks">
                <div className="empty-illustration"><span>✓</span></div>
                <h2>No tasks here yet</h2>
                <p>Define a task once, then track it under any project.</p>
                <button className="button button-primary" onClick={() => setModal({ type: "task" })}>Create your first task</button>
              </div>
            ) : (
              <div className="task-list">
                {visibleTasks.map((task) => {
                  const isRunning = timer?.status === "running" &&
                    timer.taskId === task.id &&
                    timer.projectId === selectedProjectId;
                  return (
                    <div className={`task-row ${isRunning ? "task-running" : ""}`} key={task.id}>
                      <button
                        className="task-select"
                        disabled={busy}
                        onClick={() => timerAction(timer?.status === "running" ? "switch" : "start", task.id, selectedProjectId)}
                      >
                        <span className="task-play">{isRunning ? <span className="playing-bars"><i /><i /><i /></span> : <span className="play-triangle" />}</span>
                        <span className="task-name">{task.name}</span>
                        <span className="task-action">{isRunning ? "Tracking" : timer?.status === "running" ? "Switch to task" : "Start task"}</span>
                      </button>
                      <div className="row-actions">
                        <button className="icon-button tiny" title="Edit task" aria-label={`Edit ${task.name}`} onClick={() => setModal({
                          type: "task",
                          id: task.id,
                          name: task.name,
                        })}>···</button>
                        <button className="icon-button tiny danger-hover" title="Delete task" aria-label={`Delete ${task.name}`} onClick={() => deleteEntity("task", task.id, task.name)}>×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="timer-panel panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Current activity</p>
                <h2>{timer?.status === "running" ? "Timer running" : timer?.status === "paused" ? "Timer paused" : "Ready when you are"}</h2>
              </div>
              <span className={`status-pill status-${timer?.status || "idle"}`}>
                <span />{timer?.status === "running" ? "LIVE" : timer?.status === "paused" ? "PAUSED" : "IDLE"}
              </span>
            </div>
            <div className="current-activity">
              {timerTask ? (
                <>
                  <div className="current-task-name">{timerTask.name}</div>
                  <div className="current-project-name"><span className="project-icon" />{timerProject?.name}</div>
                </>
              ) : (
                <div className="current-task-placeholder">Select a task to begin tracking</div>
              )}
              <div className="elapsed-time" aria-live="off">{formatDuration(activeElapsed)}</div>
              <div className="elapsed-caption">{timer?.status === "running" ? "elapsed this session" : "HH:MM"}</div>
            </div>
            <div className="timer-controls">
              {timer?.status === "running" ? (
                <>
                  <button className="button button-secondary control-button" disabled={busy} onClick={() => timerAction("pause")}>
                    <span className="pause-icon">Ⅱ</span> Pause
                  </button>
                  <button className="button button-primary control-button" disabled={busy} onClick={() => timerAction("end")}>
                    <span className="stop-icon" /> End task
                  </button>
                </>
              ) : timer?.status === "paused" ? (
                <>
                  <button className="button button-primary control-button" disabled={busy} onClick={() => timerAction("resume")}>
                    <span className="resume-icon">▶</span> Resume
                  </button>
                  <button className="button button-quiet control-button" disabled={busy} onClick={() => timerAction("end")}>End task</button>
                </>
              ) : (
                <span className="idle-hint">Choose a task to start your timer.</span>
              )}
            </div>
            <div className="timer-note"><span className="shield-icon">✓</span> Your time is saved on this computer.</div>
          </section>
        </div>

        <section className="totals-section">
          <div className="totals-title">
            <div>
              <p className="eyebrow">Your day at a glance</p>
              <h2>Time totals</h2>
            </div>
            <span className="totals-day">{formatDay(totals.dayKey)}</span>
          </div>
          <div className="totals-grid">
            <TotalList
              title="By task"
              rows={totals.byTask}
              getLabel={(row) => row.name}
              emptyText="Tracked task time will appear here."
            />
            <TotalList
              title="By project"
              rows={totals.byProject}
              getLabel={(row) => row.name}
              emptyText="Tracked project time will appear here."
            />
            <TotalList
              title="Task per project"
              rows={totals.byTaskProject}
              getLabel={(row) => <><span className="breakdown-project">{row.projectName}</span><span className="breakdown-separator">/</span>{row.taskName}</>}
              emptyText="Task and project totals will appear here."
            />
          </div>
        </section>
        <footer className="page-footer">Time is recorded to the minute · Tracking day starts at 4:00 AM</footer>
      </main>
      {modal && (
        <Modal
          form={modal}
          onClose={() => setModal(null)}
          onSubmit={saveEntity}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
