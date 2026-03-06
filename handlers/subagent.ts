import type { HookBase } from "./types.ts";
import { printTicket } from "../services/printer.ts";
import type { ThermalElement, ThermalTicket } from "./types.ts";

interface PreToolUseTaskHook extends HookBase {
  hook_event_name: "PreToolUse";
  tool_name: "Task";
  tool_input: {
    description?: string;
    prompt?: string;
    subagent_type?: string;
  };
}

export async function handleSubagent(hook: PreToolUseTaskHook): Promise<void> {
  const description = hook.tool_input.description ?? "tarea desconocida";
  const agentType = hook.tool_input.subagent_type ?? "general";
  const project = hook.cwd.split(/[\\/]/).filter(Boolean).pop() ?? hook.cwd;

  const elements: ThermalElement[] = [
    { type: "line", content: "-", align: "center" },
    { type: "text", content: "SUBAGENTE LANZADO", align: "center", bold: true },
    { type: "datetime", content: "HH:mm", align: "center" },
    { type: "text", content: `[${project}] ${agentType}`, align: "left", bold: true },
    { type: "text", content: wrapLines(description, 32), align: "left" },
    { type: "line", content: "-", align: "center" },
  ];

  const ticket: ThermalTicket = {
    template: { name: "Subagent", elements },
  };

  await printTicket(ticket);
  console.log(`[subagent] Printed ticket — ${agentType}: ${description}`);
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
