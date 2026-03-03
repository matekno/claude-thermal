#!/usr/bin/env -S deno run --allow-read --allow-net --allow-env
/**
 * stop-hook.ts — Local Claude Code hook script for the "Stop" event.
 *
 * Install: copy to ~/.claude/hooks/stop-hook.ts
 *
 * Claude Code passes the hook payload as JSON on stdin.
 * This script:
 *  1. Reads the hook payload from stdin
 *  2. Reads & parses the transcript JSONL (up to last 30 entries)
 *  3. Extracts: modified files, completed/pending tasks, last assistant message
 *  4. POSTs the enriched payload to the Deno Deploy server
 */

const DEPLOY_URL = Deno.env.get("THERMAL_HOOK_URL") ?? "";
const HOOK_SECRET = Deno.env.get("THERMAL_API_KEY") ?? "";

if (!DEPLOY_URL) {
  console.error("[stop-hook] THERMAL_HOOK_URL not set — skipping");
  Deno.exit(0);
}

// Read stdin
const rawInput = new TextDecoder().decode(await readAllStdin());
let hook: Record<string, unknown>;
try {
  hook = JSON.parse(rawInput);
} catch {
  console.error("[stop-hook] Failed to parse stdin JSON");
  Deno.exit(0);
}

const transcriptPath = hook.transcript_path as string | undefined;

// Extract context from transcript
const context = transcriptPath ? await extractTranscriptContext(transcriptPath, 30) : null;

// Send enriched payload to Deno Deploy
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
  for await (const chunk of Deno.stdin.readable) {
    chunks.push(chunk);
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

interface TranscriptEntry {
  type: string;
  role?: string;
  message?: {
    role?: string;
    content?: unknown[];
  };
  content?: unknown[];
}

interface TranscriptContext {
  modified_files: string[];
  completed_tasks: string[];
  pending_tasks: string[];
  last_assistant_message: string;
  total_tool_uses: number;
  session_started_at?: string;
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
    let entry: TranscriptEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    // Handle both top-level and nested message formats
    const content = entry.content ?? entry.message?.content ?? [];
    if (!Array.isArray(content)) continue;

    const role = entry.role ?? entry.message?.role ?? entry.type;

    for (const block of content) {
      if (typeof block !== "object" || block === null) continue;
      const b = block as Record<string, unknown>;

      // Tool use blocks
      if (b.type === "tool_use") {
        context.total_tool_uses++;
        const toolName = b.name as string ?? "";
        const input = b.input as Record<string, unknown> ?? {};

        // Track file modifications
        if (["Edit", "Write", "NotebookEdit"].includes(toolName)) {
          const fp = input.file_path as string ?? input.notebook_path as string ?? "";
          if (fp) modifiedFilesSet.add(fp);
        }

        // Track TodoWrite tasks
        if (toolName === "TodoWrite") {
          const todos = input.todos as Array<Record<string, unknown>> ?? [];
          context.completed_tasks = [];
          context.pending_tasks = [];
          for (const todo of todos) {
            const desc = String(todo.content ?? "");
            if (todo.status === "completed") {
              context.completed_tasks.push(desc);
            } else if (todo.status === "pending" || todo.status === "in_progress") {
              context.pending_tasks.push(desc);
            }
          }
        }
      }

      // Last assistant text message
      if (role === "assistant" && b.type === "text") {
        const text = String(b.text ?? "");
        if (text.trim()) context.last_assistant_message = text;
      }
    }
  }

  context.modified_files = Array.from(modifiedFilesSet);
  return context;
}
