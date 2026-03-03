#!/usr/bin/env -S deno run --allow-read --allow-net --allow-env
/**
 * stop-hook.ts — Local Claude Code hook script for the "Stop" event.
 * Install: copy to ~/.claude/hooks/stop-hook.ts
 */

const DEPLOY_URL = Deno.env.get("THERMAL_HOOK_URL") ?? "";
const HOOK_SECRET = Deno.env.get("THERMAL_API_KEY") ?? "";

if (!DEPLOY_URL) {
  console.error("[stop-hook] THERMAL_HOOK_URL not set — skipping");
  Deno.exit(0);
}

const rawInput = new TextDecoder().decode(await readAllStdin());
let hook: Record<string, unknown>;
try {
  hook = JSON.parse(rawInput);
} catch {
  console.error("[stop-hook] Failed to parse stdin JSON");
  Deno.exit(0);
}

const transcriptPath = hook.transcript_path as string | undefined;
const context = transcriptPath ? await extractTranscriptContext(transcriptPath, 40) : null;

const payload = { ...hook, transcript_context: context };

try {
  const res = await fetch(`${DEPLOY_URL}/hook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(HOOK_SECRET ? { "X-Thermal-Key": HOOK_SECRET } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[stop-hook] Server error ${res.status}: ${text}`);
  }
} catch (err) {
  console.error("[stop-hook] Fetch error:", err);
}

Deno.exit(0);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readAllStdin(): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Deno.stdin.readable) chunks.push(chunk);
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
}

interface TranscriptContext {
  modified_files: string[];
  completed_tasks: string[];
  pending_tasks: string[];
  last_assistant_message: string;
  total_tool_uses: number;
  session_started_at?: string;
  token_usage?: TokenUsage;
}

async function extractTranscriptContext(
  transcriptPath: string,
  maxEntries: number,
): Promise<TranscriptContext> {
  const context: TranscriptContext = {
    modified_files: [],
    completed_tasks: [],
    pending_tasks: [],
    last_assistant_message: "",
    total_tool_uses: 0,
    token_usage: { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0 },
  };

  let text: string;
  try {
    text = await Deno.readTextFile(transcriptPath);
  } catch {
    return context;
  }

  const lines = text.trim().split("\n").filter(Boolean);
  const recentLines = lines.slice(-maxEntries);
  const modifiedFilesSet = new Set<string>();

  for (const line of recentLines) {
    let entry: Record<string, unknown>;
    try { entry = JSON.parse(line); } catch { continue; }

    const msg = entry.message as Record<string, unknown> | undefined;
    const content = (entry.content ?? msg?.content ?? []) as unknown[];
    const role = entry.role ?? msg?.role ?? entry.type;

    // Extract token usage from assistant messages
    if (role === "assistant" && msg?.usage) {
      const u = msg.usage as Record<string, number>;
      context.token_usage!.input_tokens += u.input_tokens ?? 0;
      context.token_usage!.output_tokens += u.output_tokens ?? 0;
      context.token_usage!.cache_read_tokens += u.cache_read_input_tokens ?? 0;
    }

    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (typeof block !== "object" || block === null) continue;
      const b = block as Record<string, unknown>;

      if (b.type === "tool_use") {
        context.total_tool_uses++;
        const toolName = b.name as string ?? "";
        const input = b.input as Record<string, unknown> ?? {};

        if (["Edit", "Write", "NotebookEdit"].includes(toolName)) {
          const fp = input.file_path as string ?? input.notebook_path as string ?? "";
          if (fp) modifiedFilesSet.add(fp);
        }

        if (toolName === "TodoWrite") {
          const todos = input.todos as Array<Record<string, unknown>> ?? [];
          context.completed_tasks = [];
          context.pending_tasks = [];
          for (const todo of todos) {
            const desc = String(todo.content ?? "");
            if (todo.status === "completed") context.completed_tasks.push(desc);
            else if (todo.status === "pending" || todo.status === "in_progress") context.pending_tasks.push(desc);
          }
        }
      }

      if (role === "assistant" && b.type === "text") {
        const t = String(b.text ?? "");
        if (t.trim()) context.last_assistant_message = t;
      }
    }
  }

  context.modified_files = Array.from(modifiedFilesSet);
  return context;
}
