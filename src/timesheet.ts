import type { jsPDF } from "jspdf";
import type { Timesheet } from "../shared/types.js";

function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

function formatDateTime(minute: number): string {
  return new Date(minute * 60_000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatReportDay(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function createTimesheetPdf(report: Timesheet): Promise<jsPDF> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const title = "Daily Timesheet";
  const reportDay = formatReportDay(report.dayKey);

  doc.setProperties({
    title: `Daily Timesheet - ${report.dayKey}`,
    subject: "Time tracked by project and task",
    creator: "Time Tracker",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(31, 52, 72);
  doc.text(title, margin, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 112, 124);
  doc.text(reportDay, margin, 26);

  const addTable = (
    heading: string,
    head: string[],
    body: string[][],
    startY: number,
  ): number => {
    let y = startY;
    if (y > pageHeight - 38) {
      doc.addPage();
      y = 24;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(31, 52, 72);
    doc.text(heading, margin, y);

    autoTable(doc, {
      startY: y + 3,
      margin: { left: margin, right: margin, top: 20, bottom: 17 },
      head: [head],
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2.4,
        textColor: [48, 61, 74],
        lineColor: [222, 228, 233],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [239, 243, 246],
        textColor: [42, 63, 81],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: {
        [head.length - 1]: { halign: "right", cellWidth: 32 },
      },
    });

    return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  };

  let y = 34;
  const taskProjectRows = report.byTaskProject.map((row) => [
    row.projectName,
    row.taskName,
    formatDuration(row.minutes),
  ]);
  y = addTable(
    "Task totals by project",
    ["Project", "Task", "Time (HH:MM)"],
    taskProjectRows.length ? taskProjectRows : [["No tracked time", "", "00:00"]],
    y,
  );

  const projectRows = report.byProject.map((row) => [
    row.name,
    formatDuration(row.minutes),
  ]);
  y = addTable(
    "Total time by project",
    ["Project", "Time (HH:MM)"],
    projectRows.length ? projectRows : [["No tracked time", "00:00"]],
    y,
  );

  const taskRows = report.byTask.map((row) => [
    row.name,
    formatDuration(row.minutes),
  ]);
  y = addTable(
    "Total time by task",
    ["Task", "Time (HH:MM)"],
    taskRows.length ? taskRows : [["No tracked time", "00:00"]],
    y,
  );

  const chronologicalRows = report.entries.map((entry) => [
    formatDateTime(entry.startMinute),
    entry.isRunning
      ? "In progress"
      : entry.endMinute === null ? "In progress" : formatDateTime(entry.endMinute),
    entry.projectName,
    entry.taskName,
    formatDuration(entry.durationMinutes),
  ]);
  addTable(
    "Chronological activity",
    ["Start", "End", "Project", "Task", "Time"],
    chronologicalRows.length ? chronologicalRows : [["", "", "", "No tracked time", "00:00"]],
    y,
  );

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 140);
      doc.text(`${title} | ${report.dayKey}`, margin, 12);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 140);
    doc.text(
      `${page} / ${pageCount}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" },
    );
  }

  return doc;
}

