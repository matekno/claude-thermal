import type { HookBase } from "./types.ts";
import { getRandomPasuk } from "../services/sefaria.ts";
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
  const pasuk = await getRandomPasuk();

  const elements: ThermalElement[] = [
    { type: "line", content: "=", align: "center" },
    { type: "text", content: "SUBAGENTE LANZADO", align: "center", bold: true, large: true },
    { type: "line", content: "=", align: "center" },
    { type: "datetime", content: "DD/MM/YYYY HH:mm", align: "center" },
    { type: "text", content: `Proyecto: ${project}`, align: "left" },
    { type: "separator" },
    { type: "text", content: `Tipo: ${agentType}`, align: "left", bold: true },
    { type: "text", content: wrapLines(description, 30), align: "left" },
    { type: "separator" },
    { type: "line", content: "-", align: "center" },
    { type: "text", content: pasuk.text, align: "center" },
    { type: "text", content: `\u2014 ${pasuk.ref}`, align: "center" },
    { type: "line", content: "=", align: "center" },
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
