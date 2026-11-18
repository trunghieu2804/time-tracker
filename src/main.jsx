import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./frameworks.css";

const frameworkPreferenceKey = "time-tracker-framework";

function getInitialFrameworkPreference() {
  try {
    return {
      framework: window.localStorage.getItem(frameworkPreferenceKey) === "tailwind"
        ? "tailwind"
        : "bootstrap",
      error: "",
    };
  } catch (cause) {
    return {
      framework: "bootstrap",
      error: `Could not read the saved interface preference: ${cause.message}`,
    };
  }
}

function frameworkClass(isTailwind, bootstrap, tailwind) {
  return isTailwind ? tailwind : bootstrap;
}

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

export function Modal({ form, onClose, onSubmit, isTailwind }) {
  const [name, setName] = useState(form.name || "");
  const isTask = form.type === "task";

  function submit(event) {
    event.preventDefault();
    onSubmit({ name });
  }

  return (
    <div className={frameworkClass(isTailwind, "modal d-block", "tw:fixed tw:inset-0 tw:z-[60] tw:flex tw:items-center tw:justify-center tw:overflow-y-auto tw:bg-slate-950/40 tw:p-4")} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={frameworkClass(isTailwind, "modal-dialog modal-dialog-centered", "tw:w-full tw:max-w-lg")}>
        <section className={frameworkClass(isTailwind, "modal-content border-0 shadow", "tw:overflow-hidden tw:rounded-2xl tw:border tw:border-slate-200 tw:bg-white tw:shadow-2xl")} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className={frameworkClass(isTailwind, "modal-header", "tw:flex tw:items-start tw:justify-between tw:border-b tw:border-slate-200 tw:px-6 tw:py-5")}>
            <div>
              <p className={frameworkClass(isTailwind, "text-uppercase text-secondary small fw-semibold mb-1", "tw:mb-1 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-[0.14em] tw:text-slate-500")}>{form.id ? "Edit" : "Add"} {form.type}</p>
              <h2 className={frameworkClass(isTailwind, "modal-title fs-5 fw-semibold", "tw:text-xl tw:font-semibold tw:text-slate-900")} id="modal-title">{form.id ? "Update" : "Create"} {form.type}</h2>
            </div>
            <button className={frameworkClass(isTailwind, "btn-close", "tw:rounded-md tw:p-2 tw:text-slate-500 tw:transition tw:hover:bg-slate-100 tw:hover:text-slate-800")} type="button" onClick={onClose} aria-label="Close">{isTailwind ? "×" : null}</button>
          </div>
          <form onSubmit={submit}>
            <div className={frameworkClass(isTailwind, "modal-body", "tw:px-6 tw:py-5")}>
              <label className={frameworkClass(isTailwind, "form-label fw-semibold", "tw:mb-2 tw:block tw:text-sm tw:font-medium tw:text-slate-700")} htmlFor="item-name">Name</label>
              <input
                id="item-name"
                className={frameworkClass(isTailwind, "form-control", "tw:block tw:w-full tw:rounded-lg tw:border tw:border-slate-300 tw:bg-white tw:px-3 tw:py-2.5 tw:text-slate-900 tw:outline-none tw:focus:border-sky-600 tw:focus:ring-2 tw:focus:ring-sky-100")}
                autoFocus
                maxLength={50}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={`${form.type} name`}
                required
              />
              <div className={frameworkClass(isTailwind, "form-text text-end", "tw:mt-1 tw:text-right tw:text-xs tw:text-slate-500")}>{name.length}/50 characters</div>
              {isTask && <p className={frameworkClass(isTailwind, "form-text mb-0 mt-2", "tw:mt-3 tw:text-sm tw:text-slate-500")}>Available to track under any project.</p>}
            </div>
            <div className={frameworkClass(isTailwind, "modal-footer", "tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-slate-200 tw:bg-slate-50 tw:px-6 tw:py-4")}>
              <button className={frameworkClass(isTailwind, "btn btn-outline-secondary", "tw:rounded-lg tw:border tw:border-slate-300 tw:px-4 tw:py-2 tw:text-sm tw:font-medium tw:text-slate-700 tw:transition tw:hover:bg-slate-100")} type="button" onClick={onClose}>Cancel</button>
              <button className={frameworkClass(isTailwind, "btn btn-primary px-4", "tw:rounded-lg tw:bg-sky-700 tw:px-4 tw:py-2 tw:text-sm tw:font-semibold tw:text-white tw:transition tw:hover:bg-sky-800 tw:disabled:cursor-not-allowed tw:disabled:opacity-50")} type="submit" disabled={!name.trim() || name.length > 50}>
                Save {form.type}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export function TotalList({ className, title, rows, getLabel, emptyText, isTailwind }) {
  return (
    <div className={className}>
      <section className={frameworkClass(isTailwind, "card h-100 shadow-sm border-0", "tw:h-full tw:overflow-hidden tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:shadow-sm")}>
        <div className={frameworkClass(isTailwind, "card-header bg-white d-flex align-items-center justify-content-between py-3", "tw:flex tw:items-center tw:justify-between tw:border-b tw:border-slate-100 tw:bg-white tw:px-4 tw:py-3")}>
          <h3 className={frameworkClass(isTailwind, "h6 fw-semibold mb-0", "tw:text-sm tw:font-semibold tw:text-slate-800")}>{title}</h3>
          <span className={frameworkClass(isTailwind, "badge text-bg-light border fw-medium", "tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:text-slate-600")}>{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <p className={frameworkClass(isTailwind, "text-secondary small text-center my-auto py-4", "tw:my-auto tw:py-6 tw:text-center tw:text-sm tw:text-slate-500")}>{emptyText}</p>
        ) : (
          <ul className={frameworkClass(isTailwind, "list-group list-group-flush", "tw:divide-y tw:divide-slate-100")}>
            {rows.map((row, index) => (
              <li className={frameworkClass(isTailwind, "list-group-item d-flex justify-content-between align-items-center gap-3 py-2", "tw:flex tw:items-center tw:justify-between tw:gap-3 tw:px-4 tw:py-3")} key={`${row.id ?? `${row.taskId}-${row.projectId}`}-${index}`}>
                <span className={frameworkClass(isTailwind, "text-truncate small", "tw:min-w-0 tw:truncate tw:text-sm tw:text-slate-700")}>{getLabel(row)}</span>
                <strong className={frameworkClass(isTailwind, "font-monospace small flex-shrink-0", "tw:shrink-0 tw:font-mono tw:text-sm tw:font-semibold tw:text-slate-800")}>{formatDuration(row.minutes)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function App() {
  const [initialPreference] = useState(getInitialFrameworkPreference);
  const [framework, setFramework] = useState(initialPreference.framework);
  const [data, setData] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState(initialPreference.error);
  const [clock, setClock] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const isTailwind = framework === "tailwind";

  function changeFramework(event) {
    const nextFramework = event.target.value;
    setFramework(nextFramework);
    try {
      window.localStorage.setItem(frameworkPreferenceKey, nextFramework);
      setError("");
    } catch (cause) {
      setError(`Interface changed, but the preference could not be saved: ${cause.message}`);
    }
  }

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
      <main
        data-framework={framework}
        className={frameworkClass(isTailwind,
          "container min-vh-100 d-flex flex-column align-items-center justify-content-center gap-3",
          "tw:mx-auto tw:flex tw:min-h-screen tw:max-w-7xl tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:px-4 tw:text-slate-700")}
      >
        <div className={frameworkClass(isTailwind, "spinner-border text-primary", "tw:size-8 tw:animate-spin tw:rounded-full tw:border-4 tw:border-slate-200 tw:border-t-sky-700")} role="status" aria-label="Loading" />
        <p className={frameworkClass(isTailwind, "text-secondary mb-0", "tw:mb-0 tw:text-sm tw:text-slate-500")}>{error || "Opening your time tracker…"}</p>
        {error && <button className={frameworkClass(isTailwind, "btn btn-primary", "tw:rounded-lg tw:bg-sky-700 tw:px-4 tw:py-2 tw:text-sm tw:font-semibold tw:text-white tw:hover:bg-sky-800")} onClick={() => refresh().catch((cause) => setError(cause.message))}>Try again</button>}
      </main>
    );
  }

  return (
    <div
      data-framework={framework}
      className={frameworkClass(isTailwind, "app-shell min-vh-100", "tw:min-h-screen tw:bg-slate-50 tw:text-slate-800")}
    >
      <header className={frameworkClass(isTailwind, "app-header bg-white border-bottom", "tw:border-b tw:border-slate-200 tw:bg-white tw:shadow-sm")}>
        <div className={frameworkClass(isTailwind, "container-xxl d-flex align-items-center justify-content-between py-3", "tw:mx-auto tw:flex tw:max-w-screen-2xl tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:px-4 tw:py-3 tw:sm:px-6 tw:lg:px-8")}>
          <a className={frameworkClass(isTailwind, "brand d-flex align-items-center gap-2 text-decoration-none", "tw:flex tw:items-center tw:gap-2 tw:no-underline")} href="/" aria-label="Time Tracker home">
            <span className={frameworkClass(isTailwind, "brand-mark d-inline-flex align-items-center justify-content-center rounded-2 fw-bold", "tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lg tw:bg-slate-900 tw:text-sm tw:font-bold tw:text-white")}>T</span>
            <span className={frameworkClass(isTailwind, "fw-semibold text-dark", "tw:font-semibold tw:text-slate-900")}>Time Tracker</span>
          </a>
          <div className={frameworkClass(isTailwind, "d-flex align-items-center gap-4", "tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-4")}>
            <div className={frameworkClass(isTailwind, "text-end", "tw:text-right")}>
              <div className={frameworkClass(isTailwind, "small text-secondary", "tw:text-xs tw:text-slate-500")}>Tracking day</div>
              <div className={frameworkClass(isTailwind, "d-flex align-items-center gap-2", "tw:flex tw:items-center tw:gap-2")}>
                <strong className={frameworkClass(isTailwind, "text-dark", "tw:text-sm tw:font-semibold tw:text-slate-800")}>{formatDay(totals.dayKey)}</strong>
                <span className={frameworkClass(isTailwind, "badge rounded-pill text-bg-light border fw-normal", "tw:rounded-full tw:border tw:border-slate-200 tw:bg-slate-50 tw:px-2 tw:py-1 tw:text-xs tw:font-normal tw:text-slate-600")}>4:00 AM – 3:59 AM</span>
              </div>
            </div>
            <label className={frameworkClass(isTailwind, "d-flex align-items-center gap-2 small text-secondary", "tw:flex tw:items-center tw:gap-2 tw:text-xs tw:font-medium tw:text-slate-600")} htmlFor="ui-framework">
              <span>Interface</span>
              <select
                id="ui-framework"
                className={frameworkClass(isTailwind, "form-select form-select-sm", "tw:rounded-lg tw:border tw:border-slate-300 tw:bg-white tw:px-2 tw:py-1.5 tw:text-sm tw:text-slate-700 tw:focus:border-sky-600 tw:focus:outline-none tw:focus:ring-2 tw:focus:ring-sky-100")}
                value={framework}
                onChange={changeFramework}
              >
                <option value="bootstrap">Bootstrap</option>
                <option value="tailwind">Tailwind 4</option>
              </select>
            </label>
          </div>
        </div>
      </header>

      <main className={frameworkClass(isTailwind, "container-xxl py-4 py-lg-5", "tw:mx-auto tw:max-w-screen-2xl tw:px-4 tw:py-6 tw:sm:px-6 tw:lg:px-8 tw:lg:py-10")}>
        {error && (
          <div className={frameworkClass(isTailwind, "alert alert-danger alert-dismissible d-flex align-items-center gap-2", "tw:mb-4 tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-rose-200 tw:bg-rose-50 tw:px-4 tw:py-3 tw:text-sm tw:text-rose-800")} role="alert">
            <span className={frameworkClass(isTailwind, "flex-grow-1", "tw:flex-1")}>{error}</span>
            <button type="button" className={frameworkClass(isTailwind, "btn-close", "tw:rounded-md tw:px-2 tw:py-1 tw:text-rose-700 tw:hover:bg-rose-100")} onClick={() => setError("")} aria-label="Dismiss error">{isTailwind ? "×" : null}</button>
          </div>
        )}

        <div className={frameworkClass(isTailwind, "row g-3 g-xl-4 align-items-stretch", "tw:grid tw:grid-cols-1 tw:items-stretch tw:gap-4 tw:lg:grid-cols-12")}>
          <aside className={frameworkClass(isTailwind, "col-12 col-lg-3", "tw:lg:col-span-3")}>
            <section className={frameworkClass(isTailwind, "card h-100 shadow-sm border-0", "tw:flex tw:h-full tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:border tw:border-slate-200 tw:bg-white tw:shadow-sm")}>
              <div className={frameworkClass(isTailwind, "card-header bg-white border-0 d-flex justify-content-between align-items-center pt-4 px-4 pb-2", "tw:flex tw:items-center tw:justify-between tw:px-5 tw:pb-2 tw:pt-5")}>
                <div>
                  <p className={frameworkClass(isTailwind, "text-uppercase text-secondary small fw-semibold mb-1", "tw:mb-1 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-[0.14em] tw:text-slate-500")}>Workspace</p>
                  <h1 className={frameworkClass(isTailwind, "h5 fw-semibold mb-0", "tw:mb-0 tw:text-lg tw:font-semibold tw:text-slate-900")}>Projects</h1>
                </div>
                <button className={frameworkClass(isTailwind, "btn btn-sm btn-outline-primary", "tw:rounded-lg tw:border tw:border-slate-300 tw:px-3 tw:py-1.5 tw:text-sm tw:font-medium tw:text-slate-700 tw:transition tw:hover:border-sky-700 tw:hover:bg-sky-700 tw:hover:text-white")} onClick={() => setModal({ type: "project" })} aria-label="Add project" title="Add project">
                  <span aria-hidden="true">+</span> Add
                </button>
              </div>
              <div className={frameworkClass(isTailwind, "card-body pt-2 px-3", "tw:flex-1 tw:px-4 tw:pb-4 tw:pt-2")}>
                <div className={frameworkClass(isTailwind, "list-group list-group-flush gap-1", "tw:flex tw:flex-col tw:gap-1")}>
                  {projects.map((project) => (
                    <div className={frameworkClass(isTailwind,
                      `project-row list-group-item d-flex align-items-center gap-2 border-0 rounded-2 px-2 py-2 ${project.id === selectedProjectId ? "active-project" : ""}`,
                      `tw:group tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:px-2 tw:py-2 tw:transition ${project.id === selectedProjectId ? "tw:border-sky-100 tw:bg-sky-50" : "tw:border-transparent tw:hover:bg-slate-50"}`)} key={project.id}>
                      <button
                        className={frameworkClass(isTailwind,
                          `btn project-select flex-grow-1 text-start px-2 py-1 ${project.id === selectedProjectId ? "text-primary fw-semibold" : "text-body-secondary"}`,
                          `tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:rounded-md tw:px-2 tw:py-1 tw:text-left tw:text-sm tw:transition ${project.id === selectedProjectId ? "tw:font-semibold tw:text-sky-800" : "tw:text-slate-600 tw:hover:text-slate-900"}`)}
                        onClick={() => selectProject(project.id)}
                        aria-current={project.id === selectedProjectId ? "page" : undefined}
                      >
                        <span className={frameworkClass(isTailwind, "project-marker me-2", "tw:mr-2 tw:inline-block tw:size-2 tw:shrink-0 tw:rounded-sm tw:bg-slate-400")} aria-hidden="true" />
                        {project.name}
                        {project.isBuiltin && <span className={frameworkClass(isTailwind, "badge text-bg-light border fw-normal ms-2", "tw:ml-2 tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-[0.65rem] tw:font-normal tw:text-slate-600")}>Default</span>}
                      </button>
                      {!project.isBuiltin && (
                        <div className={frameworkClass(isTailwind, "project-actions btn-group btn-group-sm", "tw:flex tw:shrink-0 tw:gap-1 tw:opacity-100 tw:transition-opacity tw:md:opacity-0 tw:md:group-hover:opacity-100 tw:md:group-focus-within:opacity-100")}>
                          <button className={frameworkClass(isTailwind, "btn btn-light border-0", "tw:rounded-md tw:px-2 tw:py-1 tw:text-xs tw:text-slate-600 tw:hover:bg-white tw:hover:text-slate-900")} title="Rename project" aria-label={`Rename ${project.name}`} onClick={() => setModal({ type: "project", id: project.id, name: project.name })}>Edit</button>
                          <button className={frameworkClass(isTailwind, "btn btn-light border-0 text-danger", "tw:rounded-md tw:px-2 tw:py-1 tw:text-xs tw:text-rose-600 tw:hover:bg-rose-50")} title="Delete project" aria-label={`Delete ${project.name}`} onClick={() => deleteEntity("project", project.id, project.name)}>×</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className={frameworkClass(isTailwind, "card-footer bg-white border-0 px-4 pb-4 pt-2", "tw:border-t tw:border-slate-100 tw:px-5 tw:pb-5 tw:pt-3")}>
                <p className={frameworkClass(isTailwind, "small text-secondary mb-0", "tw:mb-0 tw:text-xs tw:leading-5 tw:text-slate-500")}>Every task is available under every project.</p>
              </div>
            </section>
          </aside>

          <section className={frameworkClass(isTailwind, "col-12 col-lg-5", "tw:lg:col-span-5")}>
            <div className={frameworkClass(isTailwind, "card h-100 shadow-sm border-0", "tw:flex tw:h-full tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:border tw:border-slate-200 tw:bg-white tw:shadow-sm")}>
              <div className={frameworkClass(isTailwind, "card-header bg-white border-0 d-flex align-items-center justify-content-between pt-4 px-4 pb-3", "tw:flex tw:items-center tw:justify-between tw:px-5 tw:pb-4 tw:pt-5")}>
                <div>
                  <p className={frameworkClass(isTailwind, "text-uppercase text-secondary small fw-semibold mb-1", "tw:mb-1 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-[0.14em] tw:text-slate-500")}>Select an activity</p>
                  <h2 className={frameworkClass(isTailwind, "h5 fw-semibold mb-0", "tw:mb-0 tw:text-lg tw:font-semibold tw:text-slate-900")}>{selectedProject?.name || "Tasks"}</h2>
                </div>
                <button className={frameworkClass(isTailwind, "btn btn-primary btn-sm", "tw:rounded-lg tw:bg-sky-700 tw:px-3 tw:py-2 tw:text-sm tw:font-semibold tw:text-white tw:transition tw:hover:bg-sky-800")} onClick={() => setModal({ type: "task" })}>
                  <span aria-hidden="true">+</span> Add task
                </button>
              </div>
              {visibleTasks.length === 0 ? (
                <div className={frameworkClass(isTailwind, "card-body d-flex flex-column align-items-center justify-content-center text-center py-5", "tw:flex tw:flex-col tw:items-center tw:justify-center tw:px-6 tw:py-12 tw:text-center")}>
                  <div className={frameworkClass(isTailwind, "empty-icon rounded-circle d-flex align-items-center justify-content-center mb-3", "tw:mb-3 tw:flex tw:size-11 tw:items-center tw:justify-center tw:rounded-full tw:bg-sky-50 tw:text-lg tw:font-semibold tw:text-sky-800")}>✓</div>
                  <h3 className={frameworkClass(isTailwind, "h6 fw-semibold", "tw:text-base tw:font-semibold tw:text-slate-900")}>No tasks yet</h3>
                  <p className={frameworkClass(isTailwind, "text-secondary small mb-3", "tw:mb-3 tw:text-sm tw:text-slate-500")}>Create a task once, then use it with any project.</p>
                  <button className={frameworkClass(isTailwind, "btn btn-outline-primary btn-sm", "tw:rounded-lg tw:border tw:border-slate-300 tw:px-3 tw:py-2 tw:text-sm tw:font-medium tw:text-slate-700 tw:hover:bg-slate-50")} onClick={() => setModal({ type: "task" })}>Create your first task</button>
                </div>
              ) : (
                <div className={frameworkClass(isTailwind, "card-body pt-0 px-3 pb-3", "tw:flex-1 tw:px-4 tw:pb-4")}>
                  <div className={frameworkClass(isTailwind, "list-group task-list", "tw:flex tw:max-h-none tw:flex-col tw:gap-2 tw:overflow-y-auto tw:lg:max-h-[22rem]")}>
                    {visibleTasks.map((task) => {
                      const isRunning = timer?.status === "running" &&
                        timer.taskId === task.id &&
                        timer.projectId === selectedProjectId;
                      return (
                        <div className={frameworkClass(isTailwind,
                          `list-group-item task-row d-flex align-items-center gap-2 rounded-2 mb-2 px-2 py-2 ${isRunning ? "task-running" : ""}`,
                          `tw:group tw:flex tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:px-2 tw:py-2 tw:transition ${isRunning ? "tw:border-sky-200 tw:bg-sky-50" : "tw:border-slate-200 tw:hover:border-slate-300 tw:hover:bg-slate-50"}`)} key={task.id}>
                          <button
                            className={frameworkClass(isTailwind, "btn task-select flex-grow-1 d-flex align-items-center gap-3 text-start border-0 px-2 py-1", "tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3 tw:rounded-lg tw:px-2 tw:py-1 tw:text-left tw:transition tw:disabled:cursor-wait tw:disabled:opacity-60")}
                            disabled={busy}
                            onClick={() => timerAction(timer?.status === "running" ? "switch" : "start", task.id, selectedProjectId)}
                          >
                            <span className={frameworkClass(isTailwind,
                              `task-play d-inline-flex align-items-center justify-content-center rounded-2 ${isRunning ? "is-playing" : ""}`,
                              `tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg ${isRunning ? "tw:bg-sky-700 tw:text-white" : "tw:bg-slate-100 tw:text-slate-600"}`)} aria-hidden="true">
                              {isRunning ? <span className="playing-bars"><i /><i /><i /></span> : <span className="play-triangle" />}
                            </span>
                            <span className={frameworkClass(isTailwind, "task-name fw-medium", "tw:min-w-0 tw:truncate tw:font-medium tw:text-slate-800")}>{task.name}</span>
                            <span className={frameworkClass(isTailwind,
                              `task-action badge ms-auto ${isRunning ? "text-bg-success" : "text-bg-light border text-secondary"}`,
                              `tw:ml-auto tw:shrink-0 tw:rounded-full tw:px-2 tw:py-1 tw:text-[0.68rem] tw:font-medium tw:tracking-wide ${isRunning ? "tw:bg-emerald-100 tw:text-emerald-800" : "tw:bg-slate-100 tw:text-slate-600"}`)}>
                              {isRunning ? "Tracking" : timer?.status === "running" ? "Switch" : "Start"}
                            </span>
                          </button>
                          <div className={frameworkClass(isTailwind, "task-actions btn-group btn-group-sm", "tw:flex tw:shrink-0 tw:gap-1 tw:opacity-100 tw:transition-opacity tw:md:opacity-0 tw:md:group-hover:opacity-100 tw:md:group-focus-within:opacity-100")}>
                            <button className={frameworkClass(isTailwind, "btn btn-light border-0", "tw:rounded-md tw:px-2 tw:py-1 tw:text-xs tw:text-slate-600 tw:hover:bg-white tw:hover:text-slate-900")} title="Edit task" aria-label={`Edit ${task.name}`} onClick={() => setModal({ type: "task", id: task.id, name: task.name })}>Edit</button>
                            <button className={frameworkClass(isTailwind, "btn btn-light border-0 text-danger", "tw:rounded-md tw:px-2 tw:py-1 tw:text-xs tw:text-rose-600 tw:hover:bg-rose-50")} title="Delete task" aria-label={`Delete ${task.name}`} onClick={() => deleteEntity("task", task.id, task.name)}>×</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={frameworkClass(isTailwind, "col-12 col-lg-4", "tw:lg:col-span-4")}>
            <div className={frameworkClass(isTailwind, "card timer-card h-100 shadow-sm border-0", "tw:flex tw:min-h-80 tw:h-full tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:border tw:border-slate-200 tw:bg-white tw:shadow-sm")}>
              <div className={frameworkClass(isTailwind, "card-header bg-white border-0 d-flex align-items-start justify-content-between pt-4 px-4 pb-2", "tw:flex tw:items-start tw:justify-between tw:px-5 tw:pb-2 tw:pt-5")}>
                <div>
                  <p className={frameworkClass(isTailwind, "text-uppercase text-secondary small fw-semibold mb-1", "tw:mb-1 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-[0.14em] tw:text-slate-500")}>Current activity</p>
                  <h2 className={frameworkClass(isTailwind, "h6 fw-semibold mb-0", "tw:mb-0 tw:text-sm tw:font-semibold tw:text-slate-900")}>{timer?.status === "running" ? "Timer running" : timer?.status === "paused" ? "Timer paused" : "Ready when you are"}</h2>
                </div>
                <span className={frameworkClass(isTailwind,
                  `badge rounded-pill ${timer?.status === "running" ? "text-bg-success" : timer?.status === "paused" ? "text-bg-warning" : "text-bg-light border text-secondary"}`,
                  `tw:rounded-full tw:px-2.5 tw:py-1 tw:text-[0.65rem] tw:font-semibold tw:tracking-wider ${timer?.status === "running" ? "tw:bg-emerald-100 tw:text-emerald-800" : timer?.status === "paused" ? "tw:bg-amber-100 tw:text-amber-800" : "tw:bg-slate-100 tw:text-slate-600"}`)}>
                  {timer?.status === "running" ? "LIVE" : timer?.status === "paused" ? "PAUSED" : "IDLE"}
                </span>
              </div>
              <div className={frameworkClass(isTailwind, "card-body d-flex flex-column pt-2 px-4 pb-4", "tw:flex tw:flex-1 tw:flex-col tw:px-5 tw:pb-5 tw:pt-2")}>
                <div className={frameworkClass(isTailwind, "timer-display text-center d-flex flex-column align-items-center justify-content-center flex-grow-1 py-4", "tw:flex tw:min-h-48 tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:py-6 tw:text-center")}>
                  {timerTask ? (
                    <>
                      <div className={frameworkClass(isTailwind, "current-task-name fw-semibold", "tw:max-w-full tw:truncate tw:text-base tw:font-semibold tw:text-slate-900")}>{timerTask.name}</div>
                      <div className={frameworkClass(isTailwind, "text-secondary small mt-1", "tw:mt-1 tw:text-sm tw:text-slate-500")}>{timerProject?.name}</div>
                    </>
                  ) : (
                    <div className={frameworkClass(isTailwind, "text-secondary small mb-2", "tw:mb-2 tw:text-sm tw:text-slate-500")}>Select a task to begin tracking</div>
                  )}
                  <div className={frameworkClass(isTailwind, "elapsed-time font-monospace fw-semibold mt-3", "tw:mt-3 tw:font-mono tw:text-5xl tw:font-semibold tw:tracking-tight tw:text-slate-900")} aria-live="off">{formatDuration(activeElapsed)}</div>
                  <div className={frameworkClass(isTailwind, "text-uppercase text-secondary small timer-caption", "tw:mt-1 tw:text-[0.65rem] tw:uppercase tw:tracking-[0.18em] tw:text-slate-500")}>{timer?.status === "running" ? "Elapsed this session" : "Hours : minutes"}</div>
                </div>
                <div className={frameworkClass(isTailwind, "d-flex flex-wrap justify-content-center gap-2", "tw:flex tw:flex-wrap tw:justify-center tw:gap-2")}>
                  {timer?.status === "running" ? (
                    <>
                      <button className={frameworkClass(isTailwind, "btn btn-outline-secondary", "tw:rounded-lg tw:border tw:border-slate-300 tw:px-4 tw:py-2 tw:text-sm tw:font-medium tw:text-slate-700 tw:hover:bg-slate-50 tw:disabled:opacity-50")} disabled={busy} onClick={() => timerAction("pause")}>Pause</button>
                      <button className={frameworkClass(isTailwind, "btn btn-primary", "tw:rounded-lg tw:bg-sky-700 tw:px-4 tw:py-2 tw:text-sm tw:font-semibold tw:text-white tw:hover:bg-sky-800 tw:disabled:opacity-50")} disabled={busy} onClick={() => timerAction("end")}>End task</button>
                    </>
                  ) : timer?.status === "paused" ? (
                    <>
                      <button className={frameworkClass(isTailwind, "btn btn-primary", "tw:rounded-lg tw:bg-sky-700 tw:px-4 tw:py-2 tw:text-sm tw:font-semibold tw:text-white tw:hover:bg-sky-800 tw:disabled:opacity-50")} disabled={busy} onClick={() => timerAction("resume")}>Resume</button>
                      <button className={frameworkClass(isTailwind, "btn btn-outline-secondary", "tw:rounded-lg tw:border tw:border-slate-300 tw:px-4 tw:py-2 tw:text-sm tw:font-medium tw:text-slate-700 tw:hover:bg-slate-50 tw:disabled:opacity-50")} disabled={busy} onClick={() => timerAction("end")}>End task</button>
                    </>
                  ) : (
                    <span className={frameworkClass(isTailwind, "text-secondary small", "tw:text-sm tw:text-slate-500")}>Choose a task to start your timer.</span>
                  )}
                </div>
                <div className={frameworkClass(isTailwind, "border-top mt-4 pt-3 text-center text-secondary small", "tw:mt-4 tw:border-t tw:border-slate-100 tw:pt-3 tw:text-center tw:text-xs tw:text-slate-500")}>Your time is saved on this computer.</div>
              </div>
            </div>
          </section>
        </div>

        <section className={frameworkClass(isTailwind, "mt-4 mt-lg-5", "tw:mt-8")}>
          <div className={frameworkClass(isTailwind, "d-flex align-items-end justify-content-between gap-3 mb-3", "tw:mb-4 tw:flex tw:flex-wrap tw:items-end tw:justify-between tw:gap-3")}>
            <div>
              <p className={frameworkClass(isTailwind, "text-uppercase text-secondary small fw-semibold mb-1", "tw:mb-1 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-[0.14em] tw:text-slate-500")}>Daily summary</p>
              <h2 className={frameworkClass(isTailwind, "h5 fw-semibold mb-0", "tw:mb-0 tw:text-lg tw:font-semibold tw:text-slate-900")}>Time totals</h2>
            </div>
            <div className={frameworkClass(isTailwind, "d-flex align-items-center gap-3", "tw:flex tw:flex-wrap tw:items-center tw:gap-3")}>
              <span className={frameworkClass(isTailwind, "small text-secondary", "tw:text-xs tw:text-slate-500")}>{formatDay(totals.dayKey)}</span>
              <a
                href="/api/timesheet.pdf"
                className={frameworkClass(isTailwind, "btn btn-outline-primary btn-sm", "tw:inline-flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-slate-300 tw:px-3 tw:py-2 tw:text-sm tw:font-medium tw:text-slate-700 tw:transition tw:hover:border-sky-700 tw:hover:bg-sky-700 tw:hover:text-white tw:disabled:cursor-wait tw:disabled:opacity-60")}
              >
                <span aria-hidden="true">↓</span>
                Generate PDF timesheet
              </a>
            </div>
          </div>
          <div className={frameworkClass(isTailwind, "row g-3", "tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-3")}>
            <TotalList
              className={frameworkClass(isTailwind, "col-12 col-md-4", "")}
              isTailwind={isTailwind}
              title="By task"
              rows={totals.byTask}
              getLabel={(row) => row.name}
              emptyText="Tracked task time will appear here."
            />
            <TotalList
              className={frameworkClass(isTailwind, "col-12 col-md-4", "")}
              isTailwind={isTailwind}
              title="By project"
              rows={totals.byProject}
              getLabel={(row) => row.name}
              emptyText="Tracked project time will appear here."
            />
            <TotalList
              className={frameworkClass(isTailwind, "col-12 col-md-4", "")}
              isTailwind={isTailwind}
              title="Task per project"
              rows={totals.byTaskProject}
              getLabel={(row) => <><span className={frameworkClass(isTailwind, "breakdown-project", "tw:text-slate-500")}>{row.projectName}</span><span className={frameworkClass(isTailwind, "breakdown-separator", "tw:px-2 tw:text-slate-400")}>/</span>{row.taskName}</>}
              emptyText="Task and project totals will appear here."
            />
          </div>
        </section>
        <footer className={frameworkClass(isTailwind, "border-top mt-4 pt-3 text-center text-secondary small", "tw:mt-6 tw:border-t tw:border-slate-200 tw:pt-4 tw:text-center tw:text-xs tw:text-slate-500")}>Time is recorded to the minute · Tracking day starts at 4:00 AM</footer>
      </main>
      {modal && (
        <Modal
          form={modal}
          onClose={() => setModal(null)}
          onSubmit={saveEntity}
          isTailwind={isTailwind}
        />
      )}
      {modal && !isTailwind && <div className="modal-backdrop show" />}
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
