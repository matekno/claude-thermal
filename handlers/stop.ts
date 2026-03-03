import type { StopHook } from "./types.ts";
import { getRandomPasuk } from "../services/sefaria.ts";
import { printTicket } from "../services/printer.ts";
import { buildStopTicket } from "../templates/tickets.ts";
import { generateStopSummary } from "../services/claude.ts";
import type { TokenUsage } from "./types.ts";
import { checkRateLimit, setRateLimit } from "./rate_limit.ts";
import { getConfig } from "../config.ts";

export async function handleStop(hook: StopHook): Promise<void> {
  const { rateLimits } = getConfig();
  const cooldown = rateLimits["Stop"] ?? 3 * 60 * 1000;
  const key = `Stop:${hook.session_id}`;

  if (cooldown > 0) {
    const limited = await checkRateLimit(key, cooldown);
    if (limited) {
      console.log(`[stop] Rate limited — skipping print`);
      return;
    }
  }

  const context = hook.transcript_context;
  const project = hook.cwd.split(/[\\/]/).filter(Boolean).pop() ?? hook.cwd;

  // Generate AI summary if we have context and ANTHROPIC_API_KEY
  let summary = "";
  let tokenUsage: TokenUsage | undefined = context?.token_usage;
  if (context && getConfig().anthropicApiKey) {
    const result = await generateStopSummary(context, project);
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
  const ticket = buildStopTicket(
    summary,
    context?.modified_files ?? [],
    context?.completed_tasks ?? [],
    context?.pending_tasks ?? [],
    hook.cwd,
    pasuk,
    tokenUsage,
  );

  await printTicket(ticket);
  await setRateLimit(key);
  console.log(`[stop] Printed ticket — project: ${project}`);
}
