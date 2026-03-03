import type { SessionEndHook } from "./types.ts";
import { getRandomPasuk } from "../services/sefaria.ts";
import { printTicket } from "../services/printer.ts";
import { buildSessionEndTicket } from "../templates/tickets.ts";
import { generateSessionSummary } from "../services/claude.ts";
import { getConfig } from "../config.ts";
import type { TokenUsage } from "./types.ts";

export async function handleSessionEnd(hook: SessionEndHook): Promise<void> {
  const context = hook.transcript_context;
  const project = hook.cwd.split(/[\\/]/).filter(Boolean).pop() ?? hook.cwd;

  let summary = "";
  let tokenUsage: TokenUsage | undefined = context?.token_usage;
  if (context && getConfig().anthropicApiKey) {
    const result = await generateSessionSummary(context, project);
    summary = result.text;
    if (tokenUsage && result.usage) {
      tokenUsage = {
        ...tokenUsage,
        haiku_input_tokens: result.usage.input_tokens,
        haiku_output_tokens: result.usage.output_tokens,
      };
    }
  }

  const pasuk = await getRandomPasuk();
  const ticket = buildSessionEndTicket(
    summary,
    context?.modified_files ?? [],
    context?.completed_tasks ?? [],
    context?.total_tool_uses ?? 0,
    hook.cwd,
    hook.session_started_at ?? context?.session_started_at,
    pasuk,
    tokenUsage,
  );

  await printTicket(ticket);
  console.log(`[session_end] Printed ticket — project: ${project}`);
}
