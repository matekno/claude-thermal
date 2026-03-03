import type { ThermalElement, ThermalTicket, Pasuk, TokenUsage } from "../handlers/types.ts";

// ── Token cost calculation ────────────────────────────────────────────────────
// Prices per million tokens
const SONNET_IN  = 3.00;
const SONNET_OUT = 15.00;
const SONNET_CACHE = 0.30;
const HAIKU_IN   = 0.80;
const HAIKU_OUT  = 4.00;

function calcCost(usage: TokenUsage): number {
  const main =
    (usage.input_tokens / 1_000_000) * SONNET_IN +
    (usage.output_tokens / 1_000_000) * SONNET_OUT +
    (usage.cache_read_tokens / 1_000_000) * SONNET_CACHE;
  const haiku =
    ((usage.haiku_input_tokens ?? 0) / 1_000_000) * HAIKU_IN +
    ((usage.haiku_output_tokens ?? 0) / 1_000_000) * HAIKU_OUT;
  return main + haiku;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function header(title: string): ThermalElement[] {
  return [
    { type: "line", content: "=", align: "center" },
    { type: "text", content: title, align: "center", bold: true, large: true },
    { type: "line", content: "=", align: "center" },
  ];
}

function footer(pasuk: Pasuk): ThermalElement[] {
  return [
    { type: "line", content: "-", align: "center" },
    { type: "text", content: pasuk.text, align: "center" },
    { type: "text", content: `\u2014 ${pasuk.ref}`, align: "center", bold: false },
    { type: "line", content: "=", align: "center" },
  ];
}

function projectLine(cwd: string): string {
  return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;
}

function wrapLines(text: string, maxLen = 32): string {
  if (!text) return "";
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxLen) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

// ── Notification ticket ───────────────────────────────────────────────────────

export function buildNotificationTicket(
  message: string,
  notificationType: string | undefined,
  cwd: string,
  pasuk: Pasuk,
): ThermalTicket {
  const elements: ThermalElement[] = [
    ...header("*** ATENCION ***"),
    { type: "datetime", content: "DD/MM/YYYY HH:mm", align: "center" },
    { type: "text", content: `Proyecto: ${projectLine(cwd)}`, align: "left" },
    { type: "separator" },
    {
      type: "box",
      content: wrapLines(message, 28),
      align: "center",
      bold: true,
    },
    { type: "separator" },
  ];

  if (notificationType) {
    elements.push({
      type: "text",
      content: `Tipo: ${notificationType.replace("_", " ")}`,
      align: "left",
    });
  }

  elements.push(...footer(pasuk));

  return { template: { name: "Notification", elements } };
}

// ── TaskCompleted ticket ──────────────────────────────────────────────────────

export function buildTaskCompletedTicket(
  taskDescription: string,
  cwd: string,
  pasuk: Pasuk,
): ThermalTicket {
  const elements: ThermalElement[] = [
    ...header("TAREA COMPLETADA"),
    { type: "datetime", content: "DD/MM/YYYY HH:mm", align: "center" },
    { type: "text", content: `Proyecto: ${projectLine(cwd)}`, align: "left" },
    { type: "separator" },
    {
      type: "text",
      content: wrapLines(taskDescription, 30),
      align: "left",
      bold: true,
    },
    { type: "separator" },
    ...footer(pasuk),
  ];

  return { template: { name: "TaskCompleted", elements } };
}

// ── Stop ticket ───────────────────────────────────────────────────────────────

export function buildStopTicket(
  summary: string,
  modifiedFiles: string[],
  completedTasks: string[],
  pendingTasks: string[],
  cwd: string,
  pasuk: Pasuk,
  tokenUsage?: TokenUsage,
): ThermalTicket {
  const elements: ThermalElement[] = [
    ...header("CLAUDE TERMINO"),
    { type: "datetime", content: "DD/MM/YYYY HH:mm", align: "center" },
    { type: "text", content: `Proyecto: ${projectLine(cwd)}`, align: "left" },
    { type: "separator" },
  ];

  // AI summary
  if (summary && summary !== "Summary unavailable.") {
    elements.push(
      { type: "text", content: "RESUMEN:", align: "left", bold: true },
      { type: "text", content: wrapLines(summary, 30), align: "left" },
      { type: "separator" },
    );
  }

  // Modified files
  if (modifiedFiles.length > 0) {
    elements.push({ type: "text", content: "ARCHIVOS:", align: "left", bold: true });
    for (const f of modifiedFiles.slice(0, 5)) {
      const name = f.split(/[\\/]/).pop() ?? f;
      elements.push({ type: "text", content: `  * ${name}`, align: "left" });
    }
    if (modifiedFiles.length > 5) {
      elements.push({
        type: "text",
        content: `  ... y ${modifiedFiles.length - 5} mas`,
        align: "left",
      });
    }
    elements.push({ type: "separator" });
  }

  // Tasks
  const allTasks = [
    ...completedTasks.map((t) => `[x] ${t}`),
    ...pendingTasks.map((t) => `[ ] ${t}`),
  ];
  if (allTasks.length > 0) {
    elements.push({ type: "text", content: "TAREAS:", align: "left", bold: true });
    for (const t of allTasks.slice(0, 6)) {
      elements.push({ type: "text", content: wrapLines(t, 30), align: "left" });
    }
    elements.push({ type: "separator" });
  }

  // Token usage & cost
  if (tokenUsage && (tokenUsage.input_tokens > 0 || tokenUsage.output_tokens > 0)) {
    const cost = calcCost(tokenUsage);
    elements.push(
      { type: "text", content: "TOKENS:", align: "left", bold: true },
      {
        type: "table",
        tableColumns: ["", "in", "out"],
        tableRows: [
          ["Sonnet", fmtK(tokenUsage.input_tokens), fmtK(tokenUsage.output_tokens)],
          ...(tokenUsage.haiku_input_tokens
            ? [["Haiku", fmtK(tokenUsage.haiku_input_tokens), fmtK(tokenUsage.haiku_output_tokens ?? 0)]]
            : []),
        ],
      },
      { type: "text", content: `Costo est.: ${formatCost(cost)}`, align: "right", bold: true },
      { type: "separator" },
    );
  }

  elements.push(...footer(pasuk));

  return { template: { name: "Stop", elements } };
}

// ── SessionEnd ticket ─────────────────────────────────────────────────────────

export function buildSessionEndTicket(
  summary: string,
  modifiedFiles: string[],
  completedTasks: string[],
  totalToolUses: number,
  cwd: string,
  startedAt: string | undefined,
  pasuk: Pasuk,
  tokenUsage?: TokenUsage,
): ThermalTicket {
  const elements: ThermalElement[] = [
    ...header("FIN DE SESION"),
    { type: "datetime", content: "DD/MM/YYYY HH:mm", align: "center" },
    { type: "text", content: `Proyecto: ${projectLine(cwd)}`, align: "left" },
    { type: "separator" },
  ];

  if (startedAt) {
    const start = new Date(startedAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    elements.push({
      type: "text",
      content: `Inicio: ${pad(start.getHours())}:${pad(start.getMinutes())}`,
      align: "left",
    });
  }

  elements.push(
    { type: "text", content: `Acciones: ${totalToolUses}`, align: "left" },
    { type: "separator" },
  );

  if (summary && summary !== "Summary unavailable.") {
    elements.push(
      { type: "text", content: "RESUMEN DE SESION:", align: "left", bold: true },
      { type: "text", content: wrapLines(summary, 30), align: "left" },
      { type: "separator" },
    );
  }

  if (completedTasks.length > 0) {
    elements.push({ type: "text", content: "LOGROS:", align: "left", bold: true });
    for (const t of completedTasks.slice(0, 6)) {
      elements.push({ type: "text", content: `* ${wrapLines(t, 28)}`, align: "left" });
    }
    elements.push({ type: "separator" });
  }

  elements.push(
    { type: "text", content: `Archivos: ${modifiedFiles.length}`, align: "left" },
  );

  // Token usage & cost
  if (tokenUsage && (tokenUsage.input_tokens > 0 || tokenUsage.output_tokens > 0)) {
    const cost = calcCost(tokenUsage);
    elements.push(
      { type: "separator" },
      { type: "text", content: "TOKENS SESION:", align: "left", bold: true },
      {
        type: "table",
        tableColumns: ["", "in", "out"],
        tableRows: [
          ["Sonnet", fmtK(tokenUsage.input_tokens), fmtK(tokenUsage.output_tokens)],
          ...(tokenUsage.haiku_input_tokens
            ? [["Haiku", fmtK(tokenUsage.haiku_input_tokens), fmtK(tokenUsage.haiku_output_tokens ?? 0)]]
            : []),
        ],
      },
      { type: "text", content: `Total est.: ${formatCost(cost)}`, align: "right", bold: true },
    );
  }

  elements.push(...footer(pasuk));

  return { template: { name: "SessionEnd", elements } };
}
