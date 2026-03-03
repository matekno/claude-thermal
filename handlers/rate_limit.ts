let kv: Deno.Kv | null = null;
async function getKv(): Promise<Deno.Kv> {
  if (!kv) kv = await Deno.openKv();
  return kv;
}

// Returns true if still within the cooldown window (rate limited)
export async function checkRateLimit(key: string, cooldownMs: number): Promise<boolean> {
  if (cooldownMs <= 0) return false;
  try {
    const db = await getKv();
    const entry = await db.get<number>(["rateLimit", key]);
    if (!entry.value) return false;
    return Date.now() - entry.value < cooldownMs;
  } catch {
    return false;
  }
}

// Record that an event fired right now
export async function setRateLimit(key: string): Promise<void> {
  try {
    const db = await getKv();
    await db.set(["rateLimit", key], Date.now(), { expireIn: 60 * 60 * 1000 }); // expire in 1h
  } catch {
    // Non-critical — ignore KV errors
  }
}
