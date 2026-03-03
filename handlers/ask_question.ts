import type { HookBase } from "./types.ts";
import { getRandomPasuk } from "../services/sefaria.ts";
import { printTicket } from "../services/printer.ts";
import type { ThermalElement, ThermalTicket } from "./types.ts";

interface PreToolUseHook extends HookBase {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: {
    questions?: Array<{
      question: string;
      header?: string;
      options?: Array<{ label: string; description?: string }>;
      multiSelect?: boolean;
    }>;
  };
}

export async function handleAskQuestion(hook: PreToolUseHook): Promise<void> {
  const questions = hook.tool_input.questions ?? [];
  const project = hook.cwd.split(/[\\/]/).filter(Boolean).pop() ?? hook.cwd;
  const pasuk = await getRandomPasuk();

  const elements: ThermalElement[] = [
    { type: "line", content: "=", align: "center" },
    { type: "text", content: "CLAUDE TIENE UNA PREGUNTA", align: "center", bold: true, large: true },
    { type: "line", content: "=", align: "center" },
    { type: "datetime", content: "DD/MM/YYYY HH:mm", align: "center" },
    { type: "text", content: `Proyecto: ${project}`, align: "left" },
    { type: "separator" },
  ];

  for (const q of questions.slice(0, 3)) {
    elements.push({
      type: "text",
      content: wrapLines(q.question, 30),
      align: "left",
      bold: true,
    });

    if (q.options && q.options.length > 0) {
      for (const opt of q.options.slice(0, 4)) {
        elements.push({
          type: "text",
          content: `  > ${opt.label}`,
          align: "left",
        });
      }
    }

    elements.push({ type: "separator" });
  }

  elements.push(
    { type: "line", content: "-", align: "center" },
    { type: "text", content: pasuk.text, align: "center" },
    { type: "text", content: `\u2014 ${pasuk.ref}`, align: "center" },
    { type: "line", content: "=", align: "center" },
  );

  const ticket: ThermalTicket = {
    template: { name: "AskQuestion", elements },
  };

  await printTicket(ticket);
  console.log(`[ask_question] Printed ticket — ${questions.length} question(s)`);
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
