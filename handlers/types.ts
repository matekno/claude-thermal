// Base fields present in all Claude Code hook payloads
export interface HookBase {
  session_id: string;
  transcript_path?: string;
  cwd: string;
  permission_mode?: string;
  hook_event_name: HookEventName;
}

export type HookEventName =
  | "Notification"
  | "TaskCompleted"
  | "Stop"
  | "SessionEnd"
  | "PreToolUse"
  | "PostToolUse"
  | "SessionStart";

// Notification hook payload
export interface NotificationHook extends HookBase {
  hook_event_name: "Notification";
  message: string;
  title?: string;
  notification_type?: "permission_prompt" | "idle_prompt" | "auth_success" | "elicitation_dialog";
}

// TaskCompleted hook payload
export interface TaskCompletedHook extends HookBase {
  hook_event_name: "TaskCompleted";
  task?: string;
  // TodoWrite tool output — passed from our local script or directly
  task_description?: string;
}

// Stop hook payload — enriched by local script with transcript context
export interface StopHook extends HookBase {
  hook_event_name: "Stop";
  // Injected by local stop-hook.ts script
  transcript_context?: TranscriptContext;
}

// SessionEnd hook payload — enriched by local script
export interface SessionEndHook extends HookBase {
  hook_event_name: "SessionEnd";
  // Injected by local session-hook.ts script
  transcript_context?: TranscriptContext;
  session_started_at?: string; // ISO timestamp
}

// Extracted context from local transcript JSONL parsing
export interface TranscriptContext {
  modified_files: string[];
  completed_tasks: string[];
  pending_tasks: string[];
  last_assistant_message: string;
  total_tool_uses: number;
  session_started_at?: string;
}

// Union type for all supported hooks
export type AnyHook =
  | NotificationHook
  | TaskCompletedHook
  | StopHook
  | SessionEndHook;

// Pirkei Avot pasuk from Sefaria
export interface Pasuk {
  text: string;       // English translation
  ref: string;        // e.g. "Avot 2:4"
  chapter: number;
  verse: number;
}

// Thermal printer element types (from deno-thermal API)
export type ThermalElement =
  | { type: "text"; content: string; align?: "left" | "center" | "right"; bold?: boolean; large?: boolean }
  | { type: "line"; content?: string; align?: "center" }
  | { type: "separator" }
  | { type: "datetime"; content?: string; align?: "center" }
  | { type: "variable"; content: string; align?: "left" | "center" | "right"; bold?: boolean; large?: boolean }
  | { type: "box"; content: string; align?: "center"; bold?: boolean }
  | { type: "table"; tableColumns: string[]; tableRows: string[][] };

export interface ThermalTicket {
  template: {
    name: string;
    elements: ThermalElement[];
  };
  variables?: Record<string, string>;
}
