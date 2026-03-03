export interface Config {
  thermalUrl: string;
  thermalApiKey: string;
  anthropicApiKey: string;
  hookSecret: string;
  rateLimits: Record<string, number>; // event → cooldown in ms
}

// Rate limits per event (cooldown in milliseconds; 0 = always print)
export const DEFAULT_RATE_LIMITS: Record<string, number> = {
  Notification: 0,            // always print — it's urgent
  TaskCompleted: 0,           // always print — milestone
  Stop: 3 * 60 * 1000,        // max 1 per 3 minutes
  SessionEnd: 0,              // always print — one per session
};

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;

  const thermalUrl = Deno.env.get("THERMAL_URL") ?? "https://deno-thermal.deno.dev/print/json";
  const thermalApiKey = Deno.env.get("THERMAL_API_KEY") ?? "";
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const hookSecret = Deno.env.get("HOOK_SECRET") ?? "";

  if (!thermalApiKey) console.warn("[config] THERMAL_API_KEY not set");
  if (!anthropicApiKey) console.warn("[config] ANTHROPIC_API_KEY not set — summaries disabled");

  // Allow env overrides for rate limits (in seconds)
  const rateLimits = { ...DEFAULT_RATE_LIMITS };
  const stopCooldown = Deno.env.get("RATE_STOP_SECONDS");
  if (stopCooldown) rateLimits["Stop"] = parseInt(stopCooldown) * 1000;

  _config = { thermalUrl, thermalApiKey, anthropicApiKey, hookSecret, rateLimits };
  return _config;
}
