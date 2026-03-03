import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptContext } from "../handlers/types.ts";
import { getConfig } from "../config.ts";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const { anthropicApiKey } = getConfig();
    client = new Anthropic({ apiKey: anthropicApiKey });
  }
  return client;
}

export interface SummaryResult {
  text: string;
  usage?: { input_tokens: number; output_tokens: number };
}

// Generate a 2-3 line summary of what Claude just did (for Stop tickets)
export async function generateStopSummary(
  context: TranscriptContext,
  project: string,
): Promise<SummaryResult> {
  const filesInfo = context.modified_files.length > 0
    ? context.modified_files.slice(0, 5).map((f) => f.split(/[\\/]/).pop()).join(", ")
    : "ninguno";
  const tasksInfo = context.completed_tasks.length > 0
    ? context.completed_tasks.slice(0, 3).join("; ")
    : "ninguna";

  const prompt = `Sos un asistente que resume el trabajo de una IA de desarrollo de software para una impresora de tickets física.
Escribí un resumen en 2-3 oraciones en español rioplatense (argentina), sin markdown, sin bullets, sin asteriscos.
Sé específico y útil: mencioná qué se hizo concretamente, no generalidades. Máximo 220 caracteres en total.

Proyecto: ${project}
Archivos modificados: ${filesInfo}
Tareas completadas: ${tasksInfo}
Último mensaje de Claude: ${context.last_assistant_message.slice(0, 400)}

Resumen (2-3 oraciones, español argentino, sin formato):`;

  return await callHaiku(prompt, 160);
}

// Generate a full session summary (for SessionEnd tickets)
export async function generateSessionSummary(
  context: TranscriptContext,
  project: string,
): Promise<SummaryResult> {
  const filesInfo = context.modified_files
    .slice(0, 8)
    .map((f) => f.split(/[\\/]/).pop())
    .join(", ") || "ninguno";

  const prompt = `Sos un asistente que resume una sesión de desarrollo de software para una impresora de tickets física.
Escribí un resumen en 3-4 oraciones en español rioplatense (argentina), sin markdown, sin bullets, sin asteriscos.
Mencioná qué se construyó, qué se arregló o qué se cambió. Sé concreto y útil. Máximo 320 caracteres en total.

Proyecto: ${project}
Total de acciones: ${context.total_tool_uses}
Archivos tocados (${context.modified_files.length}): ${filesInfo}
Tareas completadas (${context.completed_tasks.length}): ${context.completed_tasks.slice(0, 5).join("; ") || "ninguna"}
Último mensaje de Claude: ${context.last_assistant_message.slice(0, 400)}

Resumen de sesión (3-4 oraciones, español argentino, sin formato):`;

  return await callHaiku(prompt, 220);
}

async function callHaiku(prompt: string, maxTokens: number): Promise<SummaryResult> {
  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    return {
      text: content.type === "text" ? content.text.trim() : "Summary unavailable.",
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  } catch (err) {
    console.error("Claude Haiku error:", err);
    return { text: "Summary unavailable." };
  }
}
