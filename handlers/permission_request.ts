import type { HookBase } from "./types.ts";
import { printTicket } from "../services/printer.ts";
import type { ThermalElement, ThermalTicket } from "./types.ts";

interface PermissionRequestHook extends HookBase {
  hook_event_name: "PermissionRequest";
  tool_name: string;
  tool_input?: Record<string, unknown>;
}

export async function handlePermissionRequest(hook: PermissionRequestHook): Promise<void> {
  const tool = hook.tool_name ?? "herramienta desconocida";
  const project = hook.cwd.split(/[\\/]/).filter(Boolean).pop() ?? hook.cwd;
  const inputSummary = summarizeInput(tool, hook.tool_input ?? {});

  const elements: ThermalElement[] = [
    { type: "line", content: "-", align: "center" },
    { type: "text", content: "PERMISO REQUERIDO", align: "center", bold: true },
    { type: "datetime", content: "HH:mm", align: "center" },
    { type: "text", content: `[${project}] ${tool}`, align: "left", bold: true },
    { type: "text", content: wrapLines(inputSummary, 32), align: "left" },
    { type: "line", content: "-", align: "center" },
  ];

  const ticket: ThermalTicket = {
    template: { name: "PermissionRequest", elements },
  };

  await printTicket(ticket);
  console.log(`[permission_request] Printed ticket — tool: ${tool}`);
}

function summarizeInput(tool: string, input: Record<string, unknown>): string {
  if (tool === "Bash" && typeof input.command === "string") {
    return input.command.slice(0, 80);
  }
  if ((tool === "Read" || tool === "Write" || tool === "Edit") && typeof input.file_path === "string") {
    return input.file_path.slice(0, 80);
  }
  if (tool === "Glob" && typeof input.pattern === "string") {
    return input.pattern.slice(0, 80);
  }
  if (tool === "Grep" && typeof input.pattern === "string") {
    return `"${input.pattern}"`.slice(0, 80);
  }
  // Generic fallback: first string value found
  for (const val of Object.values(input)) {
    if (typeof val === "string") return val.slice(0, 80);
  }
  return JSON.stringify(input).slice(0, 80);
}

function wrapLines(text: string, maxLen: number): string {
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
