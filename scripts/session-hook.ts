#!/usr/bin/env -S deno run --allow-read --allow-net --allow-env
/**
 * session-hook.ts — Local Claude Code hook script for the "SessionEnd" event.
 * Install: copy to ~/.claude/hooks/session-hook.ts
 */

const DEPLOY_URL = Deno.env.get("THERMAL_HOOK_URL") ?? "";
const HOOK_SECRET = Deno.env.get("THERMAL_API_KEY") ?? "";

if (!DEPLOY_URL) {
  console.error("[session-hook] THERMAL_HOOK_URL not set — skipping");
  Deno.exit(0);
}

const rawInput = new TextDecoder().decode(await readAllStdin());
let hook: Record<string, unknown>;
try {
  hook = JSON.parse(rawInput);
} catch {
  console.error("[session-hook] Failed to parse stdin JSON");
  Deno.exit(0);
}

const transcriptPath = hook.transcript_path as string | undefined;
const context = transcriptPath ? await extractFullTranscriptContext(transcriptPath) : null;

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
    console.error(`[session-hook] Server error ${res.status}: ${text}`);
  }
} catch (err) {
  console.error("[session-hook] Fetch error:", err);
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

async function extractFullTranscriptContext(transcriptPath: string): Promise<TranscriptContext> {
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
  const modifiedFilesSet = new Set<string>();

  if (lines.length > 0) {
    try {
      const firstEntry = JSON.parse(lines[0]) as Record<string, unknown>;
      const ts = firstEntry.timestamp as string ?? firstEntry.created_at as string ?? "";
      if (ts) context.session_started_at = ts;
    } catch { /* ignore */ }
  }

  for (const line of lines) {
    let entry: Record<string, unknown>;
    try { entry = JSON.parse(line); } catch { continue; }

    const msg = entry.message as Record<string, unknown> | undefined;
    const content = (entry.content ?? msg?.content ?? []) as unknown[];
    const role = entry.role ?? msg?.role ?? entry.type;

    // Accumulate token usage from every assistant turn
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
          const completed: string[] = [];
          const pending: string[] = [];
          for (const todo of todos) {
            const desc = String(todo.content ?? "");
            if (todo.status === "completed") completed.push(desc);
            else pending.push(desc);
          }
          context.completed_tasks = completed;
          context.pending_tasks = pending;
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
