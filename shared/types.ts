export type FrameworkPreference = "bootstrap" | "tailwind";
export type ItemType = "project" | "task";
export type TimerStatus = "idle" | "running" | "paused";
export type TimerAction = "start" | "switch" | "pause" | "resume" | "end";

export interface Project {
  id: number;
  name: string;
  isBuiltin: boolean;
}

export interface Task {
  id: number;
  name: string;
}

export interface TimerState {
  status: TimerStatus;
  taskId: number | null;
  projectId: number | null;
  elapsedMinutes: number;
  entryId?: number;
  startMinute?: number;
}

export interface TotalRow {
  id: number;
  name: string;
  minutes: number;
}

export interface TaskProjectTotal {
  taskId: number;
  taskName: string;
  projectId: number;
  projectName: string;
  minutes: number;
}

export interface DailyTotals {
  dayKey: string;
  byTask: TotalRow[];
  byProject: TotalRow[];
  byTaskProject: TaskProjectTotal[];
}

export interface TimesheetEntry {
  taskId: number;
  taskName: string;
  projectId: number;
  projectName: string;
  startMinute: number;
  endMinute: number | null;
  durationMinutes: number;
  isRunning: boolean;
}

export interface Timesheet extends DailyTotals {
  entries: TimesheetEntry[];
}

export interface BootstrapData {
  projects: Project[];
  tasks: Task[];
  timer: TimerState;
  totals: DailyTotals;
}

export interface EntityForm {
  type: ItemType;
  id?: number;
  name?: string;
}
