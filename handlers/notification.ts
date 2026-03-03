import type { NotificationHook } from "./types.ts";
import { getRandomPasuk } from "../services/sefaria.ts";
import { printTicket } from "../services/printer.ts";
import { buildNotificationTicket } from "../templates/tickets.ts";
import { checkRateLimit, setRateLimit } from "./rate_limit.ts";

export async function handleNotification(hook: NotificationHook): Promise<void> {
  const key = `Notification:${hook.session_id}:${hook.notification_type ?? "default"}`;

  // Notification rate limit: allow same type at most once per 30 seconds per session
  const limited = await checkRateLimit(key, 30 * 1000);
  if (limited) {
    console.log(`[notification] Rate limited: ${key}`);
    return;
  }

  const pasuk = await getRandomPasuk();
  const ticket = buildNotificationTicket(
    hook.message,
    hook.notification_type,
    hook.cwd,
    pasuk,
  );

  await printTicket(ticket);
  await setRateLimit(key);
  console.log(`[notification] Printed ticket — ${hook.notification_type ?? "unknown"}`);
}
