import { handleNotification } from "./handlers/notification.ts";
import { handleTaskCompleted } from "./handlers/task_completed.ts";
import { handleStop } from "./handlers/stop.ts";
import { handleSessionEnd } from "./handlers/session_end.ts";
import { getConfig } from "./config.ts";
import type { AnyHook } from "./handlers/types.ts";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Health check
  if (req.method === "GET" && url.pathname === "/") {
    return new Response(JSON.stringify({ status: "ok", service: "claude-thermal" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Hook endpoint
  if (req.method === "POST" && url.pathname === "/hook") {
    return await handleHookRequest(req);
  }

  return new Response("Not Found", { status: 404 });
});

async function handleHookRequest(req: Request): Promise<Response> {
  const { hookSecret } = getConfig();

  // Verify shared secret if configured
  if (hookSecret) {
    const provided =
      req.headers.get("X-Thermal-Key") ?? req.headers.get("X-Hook-Secret") ?? "";
    if (provided !== hookSecret) {
      console.warn("[main] Unauthorized hook request");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  const hook = body as AnyHook;
  const event = hook.hook_event_name;

  console.log(`[main] Received hook: ${event} | session: ${hook.session_id} | cwd: ${hook.cwd}`);

  try {
    switch (event) {
      case "Notification":
        await handleNotification(hook as Parameters<typeof handleNotification>[0]);
        break;
      case "TaskCompleted":
        await handleTaskCompleted(hook as Parameters<typeof handleTaskCompleted>[0]);
        break;
      case "Stop":
        await handleStop(hook as Parameters<typeof handleStop>[0]);
        break;
      case "SessionEnd":
        await handleSessionEnd(hook as Parameters<typeof handleSessionEnd>[0]);
        break;
      default:
        console.log(`[main] Ignoring unhandled event: ${event}`);
    }
  } catch (err) {
    console.error(`[main] Handler error for ${event}:`, err);
    // Return 200 anyway — we don't want to block Claude Code on printer errors
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
