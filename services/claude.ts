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
  const prompt = `You are summarizing a software development AI assistant's work for a physical receipt printer.
Write a 2-3 line plain text summary (no markdown, no bullets) of what was accomplished.
Be specific and concise. Max 200 characters total.

Project: ${project}
Files modified: ${context.modified_files.length > 0 ? context.modified_files.slice(0, 5).join(", ") : "none"}
Tasks completed: ${context.completed_tasks.length > 0 ? context.completed_tasks.slice(0, 3).join(", ") : "none"}
Last message excerpt: ${context.last_assistant_message.slice(0, 300)}

Summary (2-3 lines, no markdown):`;

  return await callHaiku(prompt, 150);
}

// Generate a full session summary (for SessionEnd tickets)
export async function generateSessionSummary(
  context: TranscriptContext,
  project: string,
): Promise<SummaryResult> {
  const prompt = `You are summarizing a software development session for a physical receipt printer.
Write a 3-4 line plain text summary (no markdown, no bullets) of the full session.
Be specific about what was built/fixed/changed. Max 300 characters total.

Project: ${project}
Total tool uses: ${context.total_tool_uses}
Files modified (${context.modified_files.length}): ${context.modified_files.slice(0, 8).join(", ")}
Tasks completed (${context.completed_tasks.length}): ${context.completed_tasks.slice(0, 5).join(", ")}
Final message: ${context.last_assistant_message.slice(0, 400)}

Session summary (3-4 lines, no markdown):`;

  return await callHaiku(prompt, 200);
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
