import {
  minuteNow,
  trackingDayKey,
  trackingDayWindow,
} from "./time.js";

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const NO_PROJECT_ID = 1;

function validateName(value, itemType) {
  if (typeof value !== "string") {
    throw new AppError(`${itemType} name is required.`);
  }

  const name = value.trim();
  if (!name) {
    throw new AppError(`${itemType} name is required.`);
  }
  if (name.length > 50) {
    throw new AppError(`${itemType} name must be 50 characters or fewer.`);
  }
  return name;
}

export function createStore(db, { now = minuteNow } = {}) {
  const getTimerState = db.prepare(`
    SELECT status, task_id AS taskId, project_id AS projectId,
           elapsed_minutes AS elapsedMinutes
    FROM timer_state WHERE id = 1
  `);
  const setTimerState = db.prepare(`
    UPDATE timer_state
    SET status = ?, task_id = ?, project_id = ?, elapsed_minutes = ?
    WHERE id = 1
  `);

  function ensureProject(projectId) {
    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
    if (!project) {
      throw new AppError("Project not found.", 404);
    }
  }

  function ensureTask(taskId) {
    const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
    if (!task) {
      throw new AppError("Task not found.", 404);
    }
  }

  function ensureTaskProject(taskId, projectId) {
    const association = db.prepare(`
      SELECT 1 FROM task_projects WHERE task_id = ? AND project_id = ?
    `).get(taskId, projectId);
    if (!association) {
      throw new AppError("The task is not associated with the selected project.");
    }
  }

  function getTimer() {
    const state = getTimerState.get();
    if (state.status !== "running") {
      return state;
    }

    const entry = db.prepare(`
      SELECT id AS entryId, start_minute AS startMinute
      FROM time_entries WHERE end_minute IS NULL
    `).get();
    if (!entry) {
      throw new Error("Running timer has no open time entry.");
    }
    return { ...state, ...entry };
  }

  function closeOpenEntry(endMinute) {
    const entry = db.prepare(`
      SELECT id, start_minute AS startMinute
      FROM time_entries WHERE end_minute IS NULL
    `).get();
    if (!entry) {
      throw new Error("Running timer has no open time entry.");
    }

    const duration = Math.max(0, endMinute - entry.startMinute);
    if (duration <= 1) {
      db.prepare("DELETE FROM time_entries WHERE id = ?").run(entry.id);
      return 0;
    } else {
      db.prepare("UPDATE time_entries SET end_minute = ? WHERE id = ?")
        .run(Math.max(endMinute, entry.startMinute), entry.id);
      return duration;
    }
  }

  function openEntry(taskId, projectId, startMinute) {
    ensureTask(taskId);
    ensureProject(projectId);
    ensureTaskProject(taskId, projectId);
    db.prepare(`
      INSERT INTO time_entries (task_id, project_id, start_minute)
      VALUES (?, ?, ?)
    `).run(taskId, projectId, startMinute);
  }

  function getTotals(dayKey = trackingDayKey(now())) {
    const { startMinute, endMinute } = trackingDayWindow(dayKey);
    const currentMinute = now();
    const entries = db.prepare(`
      SELECT e.task_id AS taskId, t.name AS taskName,
             e.project_id AS projectId, p.name AS projectName,
             e.start_minute AS startMinute, e.end_minute AS endMinute
      FROM time_entries e
      JOIN tasks t ON t.id = e.task_id
      JOIN projects p ON p.id = e.project_id
      WHERE e.start_minute >= ? AND e.start_minute < ?
    `).all(startMinute, endMinute);

    const byTask = new Map();
    const byProject = new Map();
    const byTaskProject = new Map();

    for (const entry of entries) {
      const end = entry.endMinute ?? currentMinute;
      const durationMinutes = Math.max(0, end - entry.startMinute);
      if (entry.endMinute !== null && durationMinutes <= 1) {
        continue;
      }

      byTask.set(entry.taskId, {
        id: entry.taskId,
        name: entry.taskName,
        minutes: (byTask.get(entry.taskId)?.minutes ?? 0) + durationMinutes,
      });
      byProject.set(entry.projectId, {
        id: entry.projectId,
        name: entry.projectName,
        minutes: (byProject.get(entry.projectId)?.minutes ?? 0) + durationMinutes,
      });

      const key = `${entry.taskId}:${entry.projectId}`;
      byTaskProject.set(key, {
        taskId: entry.taskId,
        taskName: entry.taskName,
        projectId: entry.projectId,
        projectName: entry.projectName,
        minutes: (byTaskProject.get(key)?.minutes ?? 0) + durationMinutes,
      });
    }

    const toList = (map, compare) =>
      [...map.values()].sort(compare);
    const byName = (a, b) => a.name.localeCompare(b.name);

    return {
      dayKey,
      byTask: toList(byTask, byName),
      byProject: toList(byProject, byName),
      byTaskProject: toList(byTaskProject, (a, b) =>
        a.projectName.localeCompare(b.projectName) ||
        a.taskName.localeCompare(b.taskName)),
    };
  }

  const createProjectTransaction = db.transaction((name) => {
    const result = db.prepare("INSERT INTO projects (name) VALUES (?)").run(name);
    return { id: Number(result.lastInsertRowid), name, isBuiltin: false };
  });

  const deleteProjectTransaction = db.transaction((projectId) => {
    const project = db.prepare(`
      SELECT id, is_builtin AS isBuiltin FROM projects WHERE id = ?
    `).get(projectId);
    if (!project) {
      throw new AppError("Project not found.", 404);
    }
    if (project.isBuiltin) {
      throw new AppError("The No Project project cannot be deleted.", 409);
    }

    const inUse = db.prepare(`
      SELECT 1 FROM task_projects WHERE project_id = ?
      UNION ALL
      SELECT 1 FROM time_entries WHERE project_id = ?
      LIMIT 1
    `).get(projectId, projectId);
    if (inUse) {
      throw new AppError("Remove this project from its tasks before deleting it.", 409);
    }
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  });

  const createTaskTransaction = db.transaction((name, projectIds) => {
    const result = db.prepare("INSERT INTO tasks (name) VALUES (?)").run(name);
    const taskId = Number(result.lastInsertRowid);
    const addProject = db.prepare(`
      INSERT INTO task_projects (task_id, project_id) VALUES (?, ?)
    `);
    for (const projectId of projectIds) {
      ensureProject(projectId);
      addProject.run(taskId, projectId);
    }
    return { id: taskId, name, projectIds };
  });

  const updateTaskTransaction = db.transaction((taskId, name, projectIds) => {
    ensureTask(taskId);
    const oldProjectIds = db.prepare(`
      SELECT project_id AS projectId FROM task_projects WHERE task_id = ?
    `).all(taskId).map((row) => row.projectId);
    const nextProjectIds = [...new Set(projectIds)];
    if (nextProjectIds.length === 0) {
      throw new AppError("A task must be associated with at least one project.");
    }
    for (const projectId of nextProjectIds) {
      ensureProject(projectId);
    }

    const removedProjectIds = oldProjectIds.filter((id) => !nextProjectIds.includes(id));
    for (const projectId of removedProjectIds) {
      const hasEntries = db.prepare(`
        SELECT 1 FROM time_entries
        WHERE task_id = ? AND project_id = ? LIMIT 1
      `).get(taskId, projectId);
      const timer = getTimerState.get();
      if (hasEntries || (timer.taskId === taskId && timer.projectId === projectId)) {
        throw new AppError("A project association with tracked time cannot be removed.", 409);
      }
    }

    db.prepare("UPDATE tasks SET name = ? WHERE id = ?").run(name, taskId);
    db.prepare("DELETE FROM task_projects WHERE task_id = ?").run(taskId);
    const addProject = db.prepare(`
      INSERT INTO task_projects (task_id, project_id) VALUES (?, ?)
    `);
    for (const projectId of nextProjectIds) {
      addProject.run(taskId, projectId);
    }
    return { id: taskId, name, projectIds: nextProjectIds };
  });

  const deleteTaskTransaction = db.transaction((taskId) => {
    ensureTask(taskId);
    const hasEntries = db.prepare(`
      SELECT 1 FROM time_entries WHERE task_id = ? LIMIT 1
    `).get(taskId);
    const timer = getTimerState.get();
    if (hasEntries || timer.taskId === taskId) {
      throw new AppError("A task with tracked time or an active timer cannot be deleted.", 409);
    }
    db.prepare("DELETE FROM task_projects WHERE task_id = ?").run(taskId);
    db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  });

  const timerActionTransaction = db.transaction((action, taskId, projectId) => {
    const state = getTimerState.get();
    const currentMinute = now();

    if (action === "pause") {
      if (state.status !== "running") {
        throw new AppError("There is no running timer to pause.", 409);
      }
      const savedMinutes = closeOpenEntry(currentMinute);
      setTimerState.run(
        "paused",
        state.taskId,
        state.projectId,
        state.elapsedMinutes + savedMinutes,
      );
      return getTimer();
    }

    if (action === "resume") {
      if (state.status !== "paused") {
        throw new AppError("There is no paused timer to resume.", 409);
      }
      openEntry(state.taskId, state.projectId, currentMinute);
      setTimerState.run("running", state.taskId, state.projectId, state.elapsedMinutes);
      return getTimer();
    }

    if (action === "end") {
      if (state.status === "running") {
        closeOpenEntry(currentMinute);
      }
      setTimerState.run("idle", null, null, 0);
      return getTimer();
    }

    if (action === "start" || action === "switch") {
      if (!Number.isInteger(taskId) || !Number.isInteger(projectId)) {
        throw new AppError("Select a task and project to start tracking.");
      }
      ensureTaskProject(taskId, projectId);
      if (state.status === "running" &&
          state.taskId === taskId &&
          state.projectId === projectId) {
        return getTimer();
      }
      if (state.status === "running") {
        closeOpenEntry(currentMinute);
      }
      openEntry(taskId, projectId, currentMinute);
      setTimerState.run("running", taskId, projectId, 0);
      return getTimer();
    }

    throw new AppError("Unknown timer action.");
  });

  return {
    noProjectId: NO_PROJECT_ID,
    getBootstrap() {
      const projectRows = db.prepare(`
        SELECT id, name, is_builtin AS isBuiltin FROM projects ORDER BY is_builtin DESC, name COLLATE NOCASE
      `).all();
      const projects = projectRows.map((project) => ({
        ...project,
        isBuiltin: Boolean(project.isBuiltin),
      }));
      const taskRows = db.prepare(`
        SELECT t.id, t.name, tp.project_id AS projectId
        FROM tasks t
        JOIN task_projects tp ON tp.task_id = t.id
        ORDER BY t.name COLLATE NOCASE
      `).all();
      const taskMap = new Map();
      for (const row of taskRows) {
        const task = taskMap.get(row.id) ?? { id: row.id, name: row.name, projectIds: [] };
        task.projectIds.push(row.projectId);
        taskMap.set(row.id, task);
      }
      return {
        projects,
        tasks: [...taskMap.values()],
        timer: getTimer(),
        totals: getTotals(),
      };
    },
    getTotals,
    createProject(nameValue) {
      return createProjectTransaction(validateName(nameValue, "Project"));
    },
    updateProject(projectId, nameValue) {
      const project = db.prepare(`
        SELECT is_builtin AS isBuiltin FROM projects WHERE id = ?
      `).get(projectId);
      if (!project) {
        throw new AppError("Project not found.", 404);
      }
      if (project.isBuiltin) {
        throw new AppError("The No Project project cannot be renamed.", 409);
      }
      const name = validateName(nameValue, "Project");
      db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(name, projectId);
      return { id: projectId, name };
    },
    deleteProject(projectId) {
      deleteProjectTransaction(projectId);
    },
    createTask(nameValue, projectIdsValue) {
      const name = validateName(nameValue, "Task");
      const projectIds = Array.isArray(projectIdsValue) && projectIdsValue.length > 0
        ? projectIdsValue.map(Number)
        : [NO_PROJECT_ID];
      if (projectIds.some((id) => !Number.isInteger(id))) {
        throw new AppError("Select a valid project.");
      }
      return createTaskTransaction(name, [...new Set(projectIds)]);
    },
    updateTask(taskId, nameValue, projectIdsValue) {
      const name = validateName(nameValue, "Task");
      if (!Array.isArray(projectIdsValue) || projectIdsValue.length === 0) {
        throw new AppError("A task must be associated with at least one project.");
      }
      const projectIds = projectIdsValue.map(Number);
      if (projectIds.some((id) => !Number.isInteger(id))) {
        throw new AppError("Select valid projects.");
      }
      return updateTaskTransaction(taskId, name, projectIds);
    },
    deleteTask(taskId) {
      deleteTaskTransaction(taskId);
    },
    timerAction(action, taskIdValue, projectIdValue) {
      const taskId = taskIdValue === undefined ? undefined : Number(taskIdValue);
      const projectId = projectIdValue === undefined ? undefined : Number(projectIdValue);
      return timerActionTransaction(action, taskId, projectId);
    },
  };
}
